"""
Projection quality metrics module
Vectorized implementations for performance with large datasets
"""
import numpy as np
from scipy.spatial import Delaunay
from scipy.spatial.distance import squareform, pdist
from typing import List, Dict, Tuple, Optional, Any
import logging

logger = logging.getLogger(__name__)


class ProjectionQualityMetrics:
    """
    Core class for computing projection quality metrics
    All operations are vectorized for performance
    """

    @staticmethod
    def compute_projection_errors(D_high: np.ndarray, D_low: np.ndarray) -> Tuple[np.ndarray, Dict[str, float]]:
        """
        Compute normalized projection errors matrix e_ij ∈ [-1, 1]

        e_ij = (d_low_ij - d_high_ij) / max(d_high_ij, d_low_ij)

        Positive values: expansion (distances increased)
        Negative values: compression (distances decreased)

        Returns:
            errors: NxN matrix of normalized errors
            stats: Dictionary with error statistics
        """
        n = D_high.shape[0]
        errors = np.zeros((n, n))

        # Vectorized computation avoiding division by zero
        with np.errstate(divide='ignore', invalid='ignore'):
            max_distances = np.maximum(D_high, D_low)
            mask = max_distances > 1e-10
            errors[mask] = (D_low[mask] - D_high[mask]) / max_distances[mask]

        # Ensure diagonal is zero
        np.fill_diagonal(errors, 0)

        # Compute statistics
        upper_tri = np.triu_indices(n, k=1)
        error_values = errors[upper_tri]

        stats = {
            'mean_error': float(np.mean(error_values)),
            'std_error': float(np.std(error_values)),
            'min_error': float(np.min(error_values)),
            'max_error': float(np.max(error_values)),
            'median_error': float(np.median(error_values)),
            'compression_ratio': float(np.sum(error_values < 0) / len(error_values)),
            'expansion_ratio': float(np.sum(error_values > 0) / len(error_values)),
            'rmse': float(np.sqrt(np.mean(error_values ** 2)))
        }

        return errors, stats

    @staticmethod
    def find_k_nearest_neighbors(D: np.ndarray, k: int) -> np.ndarray:
        """
        Find k nearest neighbors for each point

        Returns:
            neighbors: (N, k) array of neighbor indices
        """
        n = D.shape[0]
        neighbors = np.zeros((n, k), dtype=int)

        for i in range(n):
            # Get distances from point i, convert to float to handle inf
            distances = D[i].astype(np.float64)
            # Set self-distance to infinity to exclude it
            distances[i] = np.inf
            # Find k nearest neighbors (argpartition returns indices of k smallest)
            neighbors[i] = np.argpartition(distances, k)[:k]

        return neighbors

    @staticmethod
    def compute_false_neighbors(
        D_high: np.ndarray,
        D_low: np.ndarray,
        points_2d: np.ndarray,
        k: int = 10
    ) -> Tuple[List[Dict], List[Tuple[int, int]], Dict[str, float]]:
        """
        Identify false neighbors using k-NN comparison and Delaunay triangulation

        False neighbors: points that are neighbors in low-D but not in high-D

        Returns:
            false_neighbors: List of false neighbor pairs with details
            delaunay_edges: Edges from Delaunay triangulation
            metrics: False neighbors metrics
        """
        n = D_high.shape[0]

        # Find k-nearest neighbors in both spaces
        neighbors_high = ProjectionQualityMetrics.find_k_nearest_neighbors(D_high, k)
        neighbors_low = ProjectionQualityMetrics.find_k_nearest_neighbors(D_low, k)

        # Find false neighbors
        false_neighbors = []
        false_count = 0

        for i in range(n):
            high_set = set(neighbors_high[i])
            low_set = set(neighbors_low[i])

            # False neighbors: in low_set but not in high_set
            false_for_i = low_set - high_set

            for j in false_for_i:
                false_count += 1
                false_neighbors.append({
                    'source': int(i),
                    'target': int(j),
                    'rank_high': int(np.where(D_high[i].argsort() == j)[0][0]) if j < n else -1,
                    'rank_low': int(np.where(D_low[i].argsort() == j)[0][0]) if j < n else -1,
                    'distance_high': float(D_high[i, j]),
                    'distance_low': float(D_low[i, j]),
                    'error': float((D_low[i, j] - D_high[i, j]) / max(D_high[i, j], D_low[i, j]))
                })

        # Compute Delaunay triangulation for visualization
        delaunay_edges = []
        if points_2d.shape[0] >= 3:
            try:
                tri = Delaunay(points_2d)
                edges_set = set()

                for simplex in tri.simplices:
                    for i in range(3):
                        edge = tuple(sorted([simplex[i], simplex[(i + 1) % 3]]))
                        edges_set.add(edge)

                delaunay_edges = list(edges_set)
            except Exception as e:
                logger.warning(f"Delaunay triangulation failed: {e}")

        # Compute metrics
        total_neighbors = n * k
        metrics = {
            'total_false_neighbors': false_count,
            'false_neighbors_ratio': false_count / total_neighbors if total_neighbors > 0 else 0,
            'avg_false_per_point': false_count / n if n > 0 else 0,
            'n_delaunay_edges': len(delaunay_edges)
        }

        return false_neighbors, delaunay_edges, metrics

    @staticmethod
    def compute_missing_neighbors_graph(
        D_high: np.ndarray,
        D_low: np.ndarray,
        k: int = 10,
        threshold: float = 0.5
    ) -> Tuple[Dict[int, List[int]], Dict[int, int], Dict[str, float]]:
        """
        Build graph of missing neighbors

        Missing neighbors: points that are neighbors in high-D but far in low-D

        Returns:
            graph: Adjacency list of missing neighbors
            missing_count: Count of missing neighbors per point
            stats: Missing neighbors statistics
        """
        n = D_high.shape[0]

        # Find k-nearest neighbors in high-D
        neighbors_high = ProjectionQualityMetrics.find_k_nearest_neighbors(D_high, k)

        # Build missing neighbors graph
        graph = {i: [] for i in range(n)}
        missing_count = {i: 0 for i in range(n)}
        total_missing = 0

        for i in range(n):
            for j in neighbors_high[i]:
                # Check if j is far in low-D (above threshold percentile)
                low_distances = D_low[i].copy()
                low_distances[i] = np.inf
                percentile_rank = np.sum(low_distances <= D_low[i, j]) / (n - 1)

                if percentile_rank > threshold:
                    graph[i].append(int(j))
                    missing_count[i] += 1
                    total_missing += 1

        # Compute statistics
        missing_values = list(missing_count.values())
        stats = {
            'total_missing_neighbors': total_missing,
            'missing_neighbors_ratio': total_missing / (n * k) if n * k > 0 else 0,
            'avg_missing_per_point': np.mean(missing_values) if missing_values else 0,
            'max_missing_per_point': max(missing_values) if missing_values else 0,
            'points_with_missing': sum(1 for v in missing_values if v > 0)
        }

        return graph, missing_count, stats

    @staticmethod
    def analyze_groups(
        D_high: np.ndarray,
        D_low: np.ndarray,
        groups: np.ndarray
    ) -> Tuple[List[Dict], np.ndarray, Dict[str, float]]:
        """
        Analyze projection quality per group

        Returns:
            group_metrics: List of metrics for each group
            confusion_matrix: Group confusion matrix
            global_metrics: Global quality metrics
        """
        unique_groups = np.unique(groups)
        n_groups = len(unique_groups)
        group_metrics = []

        # Compute projection errors
        errors, _ = ProjectionQualityMetrics.compute_projection_errors(D_high, D_low)

        for group_id in unique_groups:
            mask = groups == group_id
            indices = np.where(mask)[0]
            size = len(indices)

            if size == 0:
                continue

            # Intra-group metrics
            intra_errors = []
            intra_high = []
            intra_low = []

            for i in range(size):
                for j in range(i + 1, size):
                    idx_i, idx_j = indices[i], indices[j]
                    intra_errors.append(errors[idx_i, idx_j])
                    intra_high.append(D_high[idx_i, idx_j])
                    intra_low.append(D_low[idx_i, idx_j])

            # Inter-group metrics
            inter_errors = []
            inter_high = []
            inter_low = []

            other_indices = np.where(groups != group_id)[0]
            for i in indices:
                for j in other_indices:
                    inter_errors.append(errors[i, j])
                    inter_high.append(D_high[i, j])
                    inter_low.append(D_low[i, j])

            # Cohesion (avg intra-group distance) and Separation (avg inter-group distance)
            cohesion_high = np.mean(intra_high) if intra_high else 0
            cohesion_low = np.mean(intra_low) if intra_low else 0
            separation_high = np.mean(inter_high) if inter_high else 0
            separation_low = np.mean(inter_low) if inter_low else 0

            group_metrics.append({
                'group_id': int(group_id),
                'size': int(size),
                'intra_group_error': float(np.mean(intra_errors)) if intra_errors else 0,
                'inter_group_error': float(np.mean(inter_errors)) if inter_errors else 0,
                'cohesion_high': float(cohesion_high),
                'cohesion_low': float(cohesion_low),
                'separation_high': float(separation_high),
                'separation_low': float(separation_low)
            })

        # Build confusion matrix based on nearest group assignment
        confusion_matrix = np.zeros((n_groups, n_groups))

        for i, true_group in enumerate(groups):
            # Find nearest group centroid in low-D
            min_dist = np.inf
            pred_group = true_group

            for group_id in unique_groups:
                group_indices = np.where(groups == group_id)[0]
                if len(group_indices) > 0:
                    avg_dist = np.mean([D_low[i, j] for j in group_indices])
                    if avg_dist < min_dist:
                        min_dist = avg_dist
                        pred_group = group_id

            true_idx = np.where(unique_groups == true_group)[0][0]
            pred_idx = np.where(unique_groups == pred_group)[0][0]
            confusion_matrix[true_idx, pred_idx] += 1

        # Normalize confusion matrix
        row_sums = confusion_matrix.sum(axis=1, keepdims=True)
        confusion_matrix = np.divide(confusion_matrix, row_sums, where=row_sums != 0)

        # Global metrics
        silhouette_high = ProjectionQualityMetrics._compute_silhouette(D_high, groups)
        silhouette_low = ProjectionQualityMetrics._compute_silhouette(D_low, groups)

        global_metrics = {
            'silhouette_high': float(silhouette_high),
            'silhouette_low': float(silhouette_low),
            'silhouette_preservation': float(silhouette_low / silhouette_high) if silhouette_high > 0 else 0,
            'group_separation_preservation': float(
                np.mean([g['separation_low'] / g['separation_high']
                        for g in group_metrics
                        if g['separation_high'] > 0])
            ) if group_metrics else 0
        }

        return group_metrics, confusion_matrix.tolist(), global_metrics

    @staticmethod
    def _compute_silhouette(D: np.ndarray, groups: np.ndarray) -> float:
        """Compute silhouette coefficient"""
        n = len(groups)
        silhouettes = []

        for i in range(n):
            group_i = groups[i]

            # a(i): avg distance to same group
            same_group = np.where((groups == group_i) & (np.arange(n) != i))[0]
            if len(same_group) > 0:
                a_i = np.mean(D[i, same_group])
            else:
                a_i = 0

            # b(i): min avg distance to other groups
            b_i = np.inf
            for group_j in np.unique(groups):
                if group_j != group_i:
                    other_group = np.where(groups == group_j)[0]
                    if len(other_group) > 0:
                        avg_dist = np.mean(D[i, other_group])
                        b_i = min(b_i, avg_dist)

            if b_i == np.inf:
                b_i = 0

            # Silhouette coefficient
            if max(a_i, b_i) > 0:
                s_i = (b_i - a_i) / max(a_i, b_i)
            else:
                s_i = 0

            silhouettes.append(s_i)

        return np.mean(silhouettes) if silhouettes else 0

    @staticmethod
    def compare_projections(
        D_high: np.ndarray,
        projections: Dict[str, np.ndarray]
    ) -> Tuple[List[Dict], Dict[str, List[str]], str, np.ndarray]:
        """
        Compare multiple projection methods

        Returns:
            projection_metrics: List of metrics for each projection
            rankings: Rankings by each metric
            best_projection: Name of best projection
            comparison_matrix: Pairwise similarity between projections
        """
        projection_metrics = []
        n = D_high.shape[0]

        for name, D_low in projections.items():
            # Stress (Kruskal)
            stress = ProjectionQualityMetrics._compute_stress(D_high, D_low)

            # Trustworthiness and Continuity
            k = min(10, n - 1)
            trust = ProjectionQualityMetrics._compute_trustworthiness(D_high, D_low, k)
            cont = ProjectionQualityMetrics._compute_continuity(D_high, D_low, k)

            # Error metrics
            errors, stats = ProjectionQualityMetrics.compute_projection_errors(D_high, D_low)

            # False/Missing neighbors
            neighbors_high = ProjectionQualityMetrics.find_k_nearest_neighbors(D_high, k)
            neighbors_low = ProjectionQualityMetrics.find_k_nearest_neighbors(D_low, k)

            false_count = 0
            missing_count = 0

            for i in range(n):
                high_set = set(neighbors_high[i])
                low_set = set(neighbors_low[i])
                false_count += len(low_set - high_set)
                missing_count += len(high_set - low_set)

            projection_metrics.append({
                'name': name,
                'stress': float(stress),
                'trustworthiness': float(trust),
                'continuity': float(cont),
                'avg_error': float(stats['mean_error']),
                'false_neighbors_ratio': float(false_count / (n * k)) if n * k > 0 else 0,
                'missing_neighbors_ratio': float(missing_count / (n * k)) if n * k > 0 else 0
            })

        # Compute rankings
        metrics_to_rank = ['stress', 'trustworthiness', 'continuity', 'avg_error',
                          'false_neighbors_ratio', 'missing_neighbors_ratio']

        rankings = {}
        for metric in metrics_to_rank:
            # Lower is better for stress, errors, false/missing neighbors
            # Higher is better for trustworthiness, continuity
            reverse = metric in ['trustworthiness', 'continuity']
            sorted_projs = sorted(projection_metrics,
                                 key=lambda x: x[metric],
                                 reverse=reverse)
            rankings[metric] = [p['name'] for p in sorted_projs]

        # Compute combined score (normalize and weight metrics)
        for proj in projection_metrics:
            # Normalize to [0,1] where 1 is best
            proj['combined_score'] = (
                (1 - proj['stress']) * 0.2 +
                proj['trustworthiness'] * 0.2 +
                proj['continuity'] * 0.2 +
                (1 - abs(proj['avg_error'])) * 0.15 +
                (1 - proj['false_neighbors_ratio']) * 0.125 +
                (1 - proj['missing_neighbors_ratio']) * 0.125
            )

        best_projection = max(projection_metrics, key=lambda x: x['combined_score'])['name']

        # Compute pairwise similarity between projections
        proj_names = list(projections.keys())
        n_proj = len(proj_names)
        comparison_matrix = np.zeros((n_proj, n_proj))

        for i in range(n_proj):
            for j in range(n_proj):
                if i == j:
                    comparison_matrix[i, j] = 1.0
                else:
                    # Compare using Procrustes distance
                    D1 = projections[proj_names[i]]
                    D2 = projections[proj_names[j]]
                    similarity = ProjectionQualityMetrics._procrustes_similarity(D1, D2)
                    comparison_matrix[i, j] = similarity

        return projection_metrics, rankings, best_projection, comparison_matrix.tolist()

    @staticmethod
    def _compute_stress(D_high: np.ndarray, D_low: np.ndarray) -> float:
        """Compute Kruskal stress"""
        upper_tri = np.triu_indices(D_high.shape[0], k=1)
        d_high = D_high[upper_tri]
        d_low = D_low[upper_tri]

        numerator = np.sum((d_high - d_low) ** 2)
        denominator = np.sum(d_high ** 2)

        return np.sqrt(numerator / denominator) if denominator > 0 else 0

    @staticmethod
    def _compute_trustworthiness(D_high: np.ndarray, D_low: np.ndarray, k: int) -> float:
        """Compute trustworthiness metric"""
        n = D_high.shape[0]
        neighbors_high = ProjectionQualityMetrics.find_k_nearest_neighbors(D_high, k)
        neighbors_low = ProjectionQualityMetrics.find_k_nearest_neighbors(D_low, k)

        trust_sum = 0
        for i in range(n):
            low_set = set(neighbors_low[i])
            for j in low_set:
                if j not in neighbors_high[i]:
                    # Rank of j in high-D
                    rank_high = np.where(D_high[i].argsort() == j)[0][0]
                    trust_sum += max(0, rank_high - k)

        max_sum = (n * k * (2 * n - 3 * k - 1)) / 2
        return 1 - (2 * trust_sum / max_sum) if max_sum > 0 else 1

    @staticmethod
    def _compute_continuity(D_high: np.ndarray, D_low: np.ndarray, k: int) -> float:
        """Compute continuity metric"""
        n = D_high.shape[0]
        neighbors_high = ProjectionQualityMetrics.find_k_nearest_neighbors(D_high, k)
        neighbors_low = ProjectionQualityMetrics.find_k_nearest_neighbors(D_low, k)

        cont_sum = 0
        for i in range(n):
            high_set = set(neighbors_high[i])
            for j in high_set:
                if j not in neighbors_low[i]:
                    # Rank of j in low-D
                    rank_low = np.where(D_low[i].argsort() == j)[0][0]
                    cont_sum += max(0, rank_low - k)

        max_sum = (n * k * (2 * n - 3 * k - 1)) / 2
        return 1 - (2 * cont_sum / max_sum) if max_sum > 0 else 1

    @staticmethod
    def _procrustes_similarity(D1: np.ndarray, D2: np.ndarray) -> float:
        """Compute similarity between two distance matrices using Procrustes"""
        # Flatten upper triangular parts
        upper_tri = np.triu_indices(D1.shape[0], k=1)
        d1 = D1[upper_tri]
        d2 = D2[upper_tri]

        # Normalize
        d1_norm = (d1 - np.mean(d1)) / np.std(d1) if np.std(d1) > 0 else d1
        d2_norm = (d2 - np.mean(d2)) / np.std(d2) if np.std(d2) > 0 else d2

        # Compute correlation as similarity
        if len(d1_norm) > 0:
            similarity = np.corrcoef(d1_norm, d2_norm)[0, 1]
            return max(0, similarity)  # Ensure non-negative
        return 0