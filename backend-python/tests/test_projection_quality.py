"""
Unit and property-based tests for projection quality metrics
"""
import pytest
import numpy as np
from hypothesis import given, strategies as st, assume, settings
from hypothesis.extra.numpy import arrays
from app.projection_quality import ProjectionQualityMetrics


class TestProjectionErrors:
    """Test projection error computation"""

    def test_identical_matrices(self):
        """When D_high == D_low, all errors should be 0"""
        n = 10
        D = np.random.rand(n, n)
        D = (D + D.T) / 2  # Make symmetric
        np.fill_diagonal(D, 0)

        errors, stats = ProjectionQualityMetrics.compute_projection_errors(D, D)

        assert np.allclose(errors, 0)
        assert stats['mean_error'] == 0
        assert stats['rmse'] == 0

    def test_scaled_projection(self):
        """When D_low = 2 * D_high, errors should be positive (expansion)"""
        n = 10
        D_high = np.random.rand(n, n)
        D_high = (D_high + D_high.T) / 2
        np.fill_diagonal(D_high, 0)

        D_low = 2 * D_high

        errors, stats = ProjectionQualityMetrics.compute_projection_errors(D_high, D_low)

        # All non-diagonal errors should be 0.5 (doubled distances)
        upper_tri = np.triu_indices(n, k=1)
        assert np.allclose(errors[upper_tri], 0.5)
        assert stats['expansion_ratio'] == 1.0
        assert stats['compression_ratio'] == 0.0

    def test_compressed_projection(self):
        """When D_low = 0.5 * D_high, errors should be negative (compression)"""
        n = 10
        D_high = np.random.rand(n, n) + 0.1  # Avoid zeros
        D_high = (D_high + D_high.T) / 2
        np.fill_diagonal(D_high, 0)

        D_low = 0.5 * D_high

        errors, stats = ProjectionQualityMetrics.compute_projection_errors(D_high, D_low)

        # All non-diagonal errors should be -0.5 (halved distances)
        upper_tri = np.triu_indices(n, k=1)
        assert np.allclose(errors[upper_tri], -0.5)
        assert stats['compression_ratio'] == 1.0
        assert stats['expansion_ratio'] == 0.0

    @given(
        n=st.integers(min_value=3, max_value=20),
        scale=st.floats(min_value=0.1, max_value=10.0)
    )
    def test_error_bounds(self, n, scale):
        """Errors should always be in [-1, 1]"""
        D_high = np.random.rand(n, n) + 0.01
        D_high = (D_high + D_high.T) / 2
        np.fill_diagonal(D_high, 0)

        D_low = D_high * scale

        errors, _ = ProjectionQualityMetrics.compute_projection_errors(D_high, D_low)

        assert np.all(errors >= -1)
        assert np.all(errors <= 1)


class TestKNearestNeighbors:
    """Test k-nearest neighbors computation"""

    def test_simple_case(self):
        """Test on a simple distance matrix"""
        # Create a simple distance matrix
        # Point 0 is closest to 1, then 2, then 3
        D = np.array([
            [0, 1, 2, 3],
            [1, 0, 2, 3],
            [2, 2, 0, 1],
            [3, 3, 1, 0]
        ])

        neighbors = ProjectionQualityMetrics.find_k_nearest_neighbors(D, k=2)

        assert 1 in neighbors[0]  # 1 should be neighbor of 0
        assert 2 in neighbors[0]  # 2 should be neighbor of 0
        assert 3 in neighbors[2]  # 3 should be neighbor of 2

    @given(
        n=st.integers(min_value=5, max_value=30),
        k=st.integers(min_value=1, max_value=5)
    )
    def test_k_neighbors_count(self, n, k):
        """Each point should have exactly k neighbors"""
        assume(k < n)  # k must be less than n

        D = np.random.rand(n, n)
        D = (D + D.T) / 2
        np.fill_diagonal(D, 0)

        neighbors = ProjectionQualityMetrics.find_k_nearest_neighbors(D, k)

        assert neighbors.shape == (n, k)
        # Check no self-neighbors
        for i in range(n):
            assert i not in neighbors[i]


class TestFalseNeighbors:
    """Test false neighbors detection"""

    def test_no_false_neighbors(self):
        """When projections are identical, there should be no false neighbors"""
        n = 20
        D = np.random.rand(n, n)
        D = (D + D.T) / 2
        np.fill_diagonal(D, 0)

        points_2d = np.random.rand(n, 2)

        false_neighbors, edges, metrics = ProjectionQualityMetrics.compute_false_neighbors(
            D, D, points_2d, k=5
        )

        assert metrics['total_false_neighbors'] == 0
        assert metrics['false_neighbors_ratio'] == 0

    def test_complete_false_neighbors(self):
        """Test case with many false neighbors"""
        n = 10
        # Create very different distance matrices
        D_high = np.random.rand(n, n)
        D_high = (D_high + D_high.T) / 2
        np.fill_diagonal(D_high, 0)

        # Reverse the distances in low-D
        D_low = 1 - D_high
        np.fill_diagonal(D_low, 0)

        points_2d = np.random.rand(n, 2)

        false_neighbors, edges, metrics = ProjectionQualityMetrics.compute_false_neighbors(
            D_high, D_low, points_2d, k=3
        )

        # Should have many false neighbors
        assert metrics['total_false_neighbors'] > 0
        assert metrics['false_neighbors_ratio'] > 0

    def test_delaunay_triangulation(self):
        """Test Delaunay triangulation generation"""
        n = 20
        D = np.random.rand(n, n)
        D = (D + D.T) / 2
        np.fill_diagonal(D, 0)

        points_2d = np.random.rand(n, 2)

        _, delaunay_edges, metrics = ProjectionQualityMetrics.compute_false_neighbors(
            D, D, points_2d, k=5
        )

        assert len(delaunay_edges) > 0
        assert metrics['n_delaunay_edges'] == len(delaunay_edges)
        # Check edges are valid
        for edge in delaunay_edges:
            assert 0 <= edge[0] < n
            assert 0 <= edge[1] < n
            assert edge[0] != edge[1]


class TestMissingNeighbors:
    """Test missing neighbors graph computation"""

    def test_no_missing_neighbors(self):
        """When projections are identical, there should be no missing neighbors"""
        n = 20
        D = np.random.rand(n, n)
        D = (D + D.T) / 2
        np.fill_diagonal(D, 0)

        graph, missing_count, stats = ProjectionQualityMetrics.compute_missing_neighbors_graph(
            D, D, k=5, threshold=0.5
        )

        # With identical matrices, neighbors should be preserved
        assert stats['total_missing_neighbors'] == 0

    def test_missing_neighbors_threshold(self):
        """Test threshold parameter effect"""
        n = 15
        D_high = np.random.rand(n, n)
        D_high = (D_high + D_high.T) / 2
        np.fill_diagonal(D_high, 0)

        # Create different low-D distances
        D_low = np.random.rand(n, n)
        D_low = (D_low + D_low.T) / 2
        np.fill_diagonal(D_low, 0)

        # Lower threshold should give more missing neighbors
        _, _, stats_low = ProjectionQualityMetrics.compute_missing_neighbors_graph(
            D_high, D_low, k=5, threshold=0.3
        )

        _, _, stats_high = ProjectionQualityMetrics.compute_missing_neighbors_graph(
            D_high, D_low, k=5, threshold=0.7
        )

        assert stats_low['total_missing_neighbors'] >= stats_high['total_missing_neighbors']


class TestGroupAnalysis:
    """Test group-based analysis"""

    def test_single_group(self):
        """Test with all points in one group"""
        n = 20
        D_high = np.random.rand(n, n)
        D_high = (D_high + D_high.T) / 2
        np.fill_diagonal(D_high, 0)

        D_low = D_high * 1.1  # Slightly distorted

        groups = np.zeros(n, dtype=int)  # All in group 0

        group_metrics, confusion, global_metrics = ProjectionQualityMetrics.analyze_groups(
            D_high, D_low, groups
        )

        assert len(group_metrics) == 1
        assert group_metrics[0]['group_id'] == 0
        assert group_metrics[0]['size'] == n
        assert group_metrics[0]['inter_group_error'] == 0  # No other groups

    def test_perfect_separation(self):
        """Test with perfectly separated groups"""
        n = 20
        groups = np.array([0] * 10 + [1] * 10)

        # Create block diagonal distance matrix (perfect separation)
        D_high = np.ones((n, n)) * 10  # Large inter-group distances
        # Small intra-group distances
        D_high[:10, :10] = np.random.rand(10, 10) * 0.1
        D_high[10:, 10:] = np.random.rand(10, 10) * 0.1
        D_high = (D_high + D_high.T) / 2
        np.fill_diagonal(D_high, 0)

        D_low = D_high  # Perfect preservation

        group_metrics, confusion, global_metrics = ProjectionQualityMetrics.analyze_groups(
            D_high, D_low, groups
        )

        assert len(group_metrics) == 2
        # Silhouette should be high (good separation)
        assert global_metrics['silhouette_high'] > 0.5
        assert global_metrics['silhouette_preservation'] == pytest.approx(1.0, abs=0.01)

    @given(
        n_points=st.integers(min_value=10, max_value=30),
        n_groups=st.integers(min_value=2, max_value=5)
    )
    def test_confusion_matrix_properties(self, n_points, n_groups):
        """Test confusion matrix properties"""
        D_high = np.random.rand(n_points, n_points)
        D_high = (D_high + D_high.T) / 2
        np.fill_diagonal(D_high, 0)

        D_low = D_high + np.random.randn(n_points, n_points) * 0.1
        D_low = (D_low + D_low.T) / 2
        np.fill_diagonal(D_low, 0)

        groups = np.random.randint(0, n_groups, n_points)

        _, confusion, _ = ProjectionQualityMetrics.analyze_groups(D_high, D_low, groups)

        # Confusion matrix should be normalized (rows sum to 1)
        confusion = np.array(confusion)
        row_sums = confusion.sum(axis=1)
        assert np.allclose(row_sums[row_sums > 0], 1.0)


class TestProjectionComparison:
    """Test projection comparison functionality"""

    def test_single_best_projection(self):
        """Test identifying best projection"""
        n = 20
        D_high = np.random.rand(n, n)
        D_high = (D_high + D_high.T) / 2
        np.fill_diagonal(D_high, 0)

        # Create projections with different quality
        projections = {
            'perfect': D_high,  # Perfect preservation
            'noisy': D_high + np.random.randn(n, n) * 0.5,  # Noisy
            'scaled': D_high * 2  # Scaled (distorted)
        }

        # Make noisy symmetric
        projections['noisy'] = (projections['noisy'] + projections['noisy'].T) / 2
        np.fill_diagonal(projections['noisy'], 0)

        metrics, rankings, best, comparison = ProjectionQualityMetrics.compare_projections(
            D_high, projections
        )

        # Perfect projection should be best
        assert best == 'perfect'
        # Perfect should rank first in most metrics
        assert rankings['stress'][0] == 'perfect'

    def test_metric_bounds(self):
        """Test that all metrics are within expected bounds"""
        n = 15
        D_high = np.random.rand(n, n)
        D_high = (D_high + D_high.T) / 2
        np.fill_diagonal(D_high, 0)

        projections = {
            'proj1': D_high * 1.1,
            'proj2': D_high * 0.9
        }

        metrics, _, _, _ = ProjectionQualityMetrics.compare_projections(D_high, projections)

        for proj_metrics in metrics:
            assert 0 <= proj_metrics['stress'] <= 1
            assert 0 <= proj_metrics['trustworthiness'] <= 1
            assert 0 <= proj_metrics['continuity'] <= 1
            assert 0 <= proj_metrics['false_neighbors_ratio'] <= 1
            assert 0 <= proj_metrics['missing_neighbors_ratio'] <= 1

    def test_comparison_matrix_symmetry(self):
        """Test that comparison matrix is symmetric"""
        n = 10
        D_high = np.random.rand(n, n)
        D_high = (D_high + D_high.T) / 2
        np.fill_diagonal(D_high, 0)

        projections = {
            'proj1': D_high * 1.1,
            'proj2': D_high * 0.9,
            'proj3': D_high + np.random.randn(n, n) * 0.1
        }

        # Make proj3 symmetric
        projections['proj3'] = (projections['proj3'] + projections['proj3'].T) / 2
        np.fill_diagonal(projections['proj3'], 0)

        _, _, _, comparison = ProjectionQualityMetrics.compare_projections(D_high, projections)

        comparison = np.array(comparison)
        assert np.allclose(comparison, comparison.T)
        assert np.allclose(np.diag(comparison), 1.0)  # Diagonal should be 1


class TestPropertyBased:
    """Property-based tests using Hypothesis"""

    @given(
        D_high=arrays(
            dtype=np.float64,
            shape=st.tuples(
                st.integers(min_value=5, max_value=20),
                st.integers(min_value=5, max_value=20)
            ).filter(lambda x: x[0] == x[1]),
            elements=st.floats(min_value=0, max_value=10, allow_nan=False)
        )
    )
    @settings(max_examples=20)
    def test_error_computation_invariants(self, D_high):
        """Test invariants of error computation"""
        n = D_high.shape[0]
        # Make symmetric
        D_high = (D_high + D_high.T) / 2
        np.fill_diagonal(D_high, 0)

        # Create a random low-D projection
        D_low = D_high + np.random.randn(n, n) * 0.1
        D_low = (D_low + D_low.T) / 2
        np.fill_diagonal(D_low, 0)
        D_low = np.abs(D_low)  # Ensure positive

        errors, stats = ProjectionQualityMetrics.compute_projection_errors(D_high, D_low)

        # Check invariants
        assert errors.shape == D_high.shape
        assert np.allclose(errors, errors.T)  # Symmetric
        assert np.allclose(np.diag(errors), 0)  # Zero diagonal
        assert -1 <= stats['mean_error'] <= 1
        assert 0 <= stats['compression_ratio'] <= 1
        assert 0 <= stats['expansion_ratio'] <= 1
        assert stats['compression_ratio'] + stats['expansion_ratio'] <= 1

    @given(
        n=st.integers(min_value=10, max_value=30),
        k=st.integers(min_value=2, max_value=8)
    )
    @settings(max_examples=20)
    def test_false_neighbors_properties(self, n, k):
        """Test properties of false neighbors detection"""
        assume(k < n)

        # Generate random distance matrices
        D_high = np.random.rand(n, n)
        D_high = (D_high + D_high.T) / 2
        np.fill_diagonal(D_high, 0)

        D_low = np.random.rand(n, n)
        D_low = (D_low + D_low.T) / 2
        np.fill_diagonal(D_low, 0)

        points_2d = np.random.rand(n, 2)

        false_neighbors, edges, metrics = ProjectionQualityMetrics.compute_false_neighbors(
            D_high, D_low, points_2d, k
        )

        # Check properties
        assert 0 <= metrics['false_neighbors_ratio'] <= 1
        assert metrics['total_false_neighbors'] >= 0
        assert metrics['total_false_neighbors'] <= n * k
        assert metrics['avg_false_per_point'] >= 0
        assert metrics['avg_false_per_point'] <= k

        # Check false neighbors structure
        for fn in false_neighbors:
            assert 0 <= fn['source'] < n
            assert 0 <= fn['target'] < n
            assert fn['source'] != fn['target']
            assert -1 <= fn['error'] <= 1

    @given(
        n_points=st.integers(min_value=6, max_value=20),
        n_groups=st.integers(min_value=2, max_value=5),
        distortion=st.floats(min_value=0, max_value=2)
    )
    @settings(max_examples=20)
    def test_group_analysis_properties(self, n_points, n_groups, distortion):
        """Test properties of group analysis"""
        assume(n_groups <= n_points)

        # Generate distance matrices
        D_high = np.random.rand(n_points, n_points)
        D_high = (D_high + D_high.T) / 2
        np.fill_diagonal(D_high, 0)

        # Apply distortion
        D_low = D_high * (1 + distortion * np.random.randn(n_points, n_points) * 0.1)
        D_low = (D_low + D_low.T) / 2
        np.fill_diagonal(D_low, 0)
        D_low = np.abs(D_low)

        # Assign groups
        groups = np.random.randint(0, n_groups, n_points)

        group_metrics, confusion, global_metrics = ProjectionQualityMetrics.analyze_groups(
            D_high, D_low, groups
        )

        # Check properties
        assert len(group_metrics) <= n_groups
        total_size = sum(g['size'] for g in group_metrics)
        assert total_size == n_points

        # Check confusion matrix
        confusion = np.array(confusion)
        assert confusion.shape[0] <= n_groups
        assert confusion.shape[1] <= n_groups
        assert np.all(confusion >= 0)
        assert np.all(confusion <= 1)

        # Check global metrics
        assert -1 <= global_metrics['silhouette_high'] <= 1
        assert -1 <= global_metrics['silhouette_low'] <= 1


if __name__ == '__main__':
    pytest.main([__file__, '-v'])