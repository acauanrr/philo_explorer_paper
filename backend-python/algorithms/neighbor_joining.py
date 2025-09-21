"""
Neighbor-Joining Algorithm Implementation
Based on Saitou and Nei (1987) algorithm for phylogenetic tree reconstruction
Optimized with NumPy for performance on large matrices
"""

import numpy as np
import logging
from typing import List, Dict, Tuple, Optional, Any
from dataclasses import dataclass
import json

logger = logging.getLogger(__name__)

@dataclass
class TreeNode:
    """Represents a node in the phylogenetic tree"""
    id: str
    label: str
    distance_to_parent: float = 0.0
    children: List['TreeNode'] = None
    is_leaf: bool = True

    def __post_init__(self):
        if self.children is None:
            self.children = []

    def to_dict(self) -> Dict:
        """Convert node to dictionary representation"""
        result = {
            'id': self.id,
            'label': self.label,
            'distance': self.distance_to_parent,
            'is_leaf': self.is_leaf
        }
        if self.children:
            result['children'] = [child.to_dict() for child in self.children]
        return result

    def to_newick(self) -> str:
        """Convert subtree to Newick format"""
        if self.is_leaf:
            return f"{self.label}:{self.distance_to_parent:.6f}"
        else:
            children_str = ",".join([child.to_newick() for child in self.children])
            return f"({children_str}):{self.distance_to_parent:.6f}"


class NeighborJoining:
    """
    Neighbor-Joining algorithm implementation for phylogenetic tree reconstruction
    Complexity: O(n³) where n is the number of taxa
    """

    def __init__(self, distance_matrix: np.ndarray, labels: List[str]):
        """
        Initialize NJ algorithm with distance matrix and labels

        Args:
            distance_matrix: Symmetric distance matrix (n x n)
            labels: List of labels for each taxon
        """
        self.original_matrix = np.array(distance_matrix, dtype=np.float64)
        self.labels = labels.copy()
        self.n_original = len(labels)

        # Working copies
        self.distance_matrix = self.original_matrix.copy()
        self.current_labels = labels.copy()
        self.nodes = {}  # Store all nodes by ID
        self.next_node_id = self.n_original

        # Initialize leaf nodes
        for i, label in enumerate(labels):
            self.nodes[str(i)] = TreeNode(id=str(i), label=label, is_leaf=True)

        # Track computation statistics
        self.iterations = 0
        self.total_operations = 0

    def calculate_q_matrix(self, dist_matrix: np.ndarray, n: int) -> np.ndarray:
        """
        Calculate the Q matrix (also known as S matrix in some literature)
        Q(i,j) = (n-2) * D(i,j) - sum(D(i,k)) - sum(D(j,k))

        This is the core of the NJ algorithm that adjusts distances
        """
        if n <= 2:
            return dist_matrix

        # Calculate row sums efficiently using NumPy
        row_sums = np.sum(dist_matrix, axis=1)

        # Create Q matrix using broadcasting
        q_matrix = np.zeros_like(dist_matrix)

        for i in range(n):
            for j in range(i + 1, n):
                q_value = (n - 2) * dist_matrix[i, j] - row_sums[i] - row_sums[j]
                q_matrix[i, j] = q_value
                q_matrix[j, i] = q_value
                self.total_operations += 3  # Count operations

        return q_matrix

    def find_minimum_q(self, q_matrix: np.ndarray, n: int) -> Tuple[int, int]:
        """
        Find the indices of the minimum value in Q matrix
        Returns the pair of taxa to be joined
        """
        # Set diagonal to infinity to exclude it
        np.fill_diagonal(q_matrix, np.inf)

        # Find minimum value
        min_idx = np.argmin(q_matrix)
        min_i, min_j = divmod(min_idx, n)

        # Ensure i < j for consistency
        if min_i > min_j:
            min_i, min_j = min_j, min_i

        return min_i, min_j

    def calculate_branch_lengths(self, dist_matrix: np.ndarray, i: int, j: int, n: int) -> Tuple[float, float]:
        """
        Calculate branch lengths from the new node to nodes i and j

        Length from new node to i: v_i = 0.5 * D(i,j) + [sum(D(i,k)) - sum(D(j,k))] / [2(n-2)]
        Length from new node to j: v_j = D(i,j) - v_i
        """
        if n <= 2:
            # Special case: only two nodes
            return dist_matrix[i, j] / 2, dist_matrix[i, j] / 2

        d_ij = dist_matrix[i, j]

        # Calculate sums
        sum_i = np.sum(dist_matrix[i, :])
        sum_j = np.sum(dist_matrix[j, :])

        # Calculate branch lengths
        v_i = 0.5 * d_ij + (sum_i - sum_j) / (2 * (n - 2))
        v_j = d_ij - v_i

        # Ensure non-negative branch lengths
        v_i = max(0.0, v_i)
        v_j = max(0.0, v_j)

        return v_i, v_j

    def update_distance_matrix(self, dist_matrix: np.ndarray, i: int, j: int, n: int) -> np.ndarray:
        """
        Update distance matrix after joining nodes i and j
        The new node replaces node i, and node j is removed

        New distance from k to new node u: D(k,u) = 0.5 * [D(k,i) + D(k,j) - D(i,j)]
        """
        # Create new matrix with one less row/column
        new_matrix = np.zeros((n-1, n-1), dtype=np.float64)

        # Indices for the new matrix
        old_to_new = {}
        new_idx = 0

        for old_idx in range(n):
            if old_idx != j:  # Skip j as it's being merged
                old_to_new[old_idx] = new_idx
                new_idx += 1

        # Copy distances, updating for the new node
        for old_i in range(n):
            if old_i == j:
                continue

            for old_j in range(old_i + 1, n):
                if old_j == j:
                    continue

                new_i = old_to_new[old_i]
                new_j = old_to_new[old_j]

                if old_i == i:
                    # Calculate new distance for the merged node
                    # D(u,k) = 0.5 * [D(i,k) + D(j,k) - D(i,j)]
                    new_dist = 0.5 * (dist_matrix[i, old_j] + dist_matrix[j, old_j] - dist_matrix[i, j])
                else:
                    # Copy existing distance
                    new_dist = dist_matrix[old_i, old_j]

                new_matrix[new_i, new_j] = new_dist
                new_matrix[new_j, new_i] = new_dist

        return new_matrix

    def run(self) -> TreeNode:
        """
        Run the complete Neighbor-Joining algorithm
        Returns the root node of the constructed tree
        """
        logger.info(f"Starting NJ algorithm with {self.n_original} taxa")

        n = self.n_original
        current_matrix = self.distance_matrix.copy()
        active_nodes = list(self.nodes.keys())  # Track active node IDs

        while n > 3:
            self.iterations += 1
            logger.debug(f"Iteration {self.iterations}, n={n}")

            # Step 1: Calculate Q matrix
            q_matrix = self.calculate_q_matrix(current_matrix, n)

            # Step 2: Find minimum Q value (nodes to join)
            i, j = self.find_minimum_q(q_matrix, n)

            # Step 3: Calculate branch lengths
            v_i, v_j = self.calculate_branch_lengths(current_matrix, i, j, n)

            # Step 4: Create new internal node
            new_node_id = str(self.next_node_id)
            self.next_node_id += 1

            node_i = self.nodes[active_nodes[i]]
            node_j = self.nodes[active_nodes[j]]

            node_i.distance_to_parent = v_i
            node_j.distance_to_parent = v_j

            new_node = TreeNode(
                id=new_node_id,
                label=f"Node_{new_node_id}",
                is_leaf=False,
                children=[node_i, node_j]
            )

            self.nodes[new_node_id] = new_node

            # Step 5: Update distance matrix
            current_matrix = self.update_distance_matrix(current_matrix, i, j, n)

            # Update active nodes list
            active_nodes[i] = new_node_id  # Replace i with new node
            del active_nodes[j]  # Remove j

            n -= 1

        # Final step: Connect remaining 3 nodes
        root = self._connect_final_nodes(current_matrix, active_nodes)

        logger.info(f"NJ algorithm completed: {self.iterations} iterations, {self.total_operations} operations")

        return root

    def _connect_final_nodes(self, dist_matrix: np.ndarray, active_nodes: List[str]) -> TreeNode:
        """
        Connect the final 3 nodes to create the root of the tree
        Uses the three-point formula to calculate branch lengths
        """
        if len(active_nodes) != 3:
            raise ValueError(f"Expected 3 nodes, got {len(active_nodes)}")

        # Get the three remaining nodes
        nodes = [self.nodes[node_id] for node_id in active_nodes]

        # Calculate branch lengths using three-point formula
        # For nodes A, B, C:
        # d_A = 0.5 * [D(A,B) + D(A,C) - D(B,C)]
        # d_B = 0.5 * [D(A,B) + D(B,C) - D(A,C)]
        # d_C = 0.5 * [D(A,C) + D(B,C) - D(A,B)]

        d_01 = dist_matrix[0, 1]
        d_02 = dist_matrix[0, 2]
        d_12 = dist_matrix[1, 2]

        nodes[0].distance_to_parent = max(0.0, 0.5 * (d_01 + d_02 - d_12))
        nodes[1].distance_to_parent = max(0.0, 0.5 * (d_01 + d_12 - d_02))
        nodes[2].distance_to_parent = max(0.0, 0.5 * (d_02 + d_12 - d_01))

        # Create root node
        root = TreeNode(
            id="root",
            label="root",
            is_leaf=False,
            children=nodes,
            distance_to_parent=0.0
        )

        return root

    def get_newick(self) -> str:
        """
        Get the tree in Newick format
        Must be called after run()
        """
        if "root" not in self.nodes:
            raise ValueError("Tree not yet constructed. Call run() first.")

        root = self.nodes["root"]
        # Build Newick string from children
        children_str = ",".join([child.to_newick() for child in root.children])
        return f"({children_str});"

    def get_statistics(self) -> Dict[str, Any]:
        """Get algorithm execution statistics"""
        return {
            "algorithm": "neighbor_joining",
            "n_taxa": self.n_original,
            "iterations": self.iterations,
            "total_operations": self.total_operations,
            "complexity": f"O(n³) where n={self.n_original}"
        }


def build_nj_tree(distance_matrix: List[List[float]], labels: List[str]) -> Dict[str, Any]:
    """
    Convenience function to build a tree using Neighbor-Joining

    Args:
        distance_matrix: Distance matrix as list of lists
        labels: List of labels for taxa

    Returns:
        Dictionary containing tree structure and metadata
    """
    # Convert to numpy array
    dist_array = np.array(distance_matrix, dtype=np.float64)

    # Validate inputs
    if dist_array.shape[0] != dist_array.shape[1]:
        raise ValueError("Distance matrix must be square")

    if len(labels) != dist_array.shape[0]:
        raise ValueError(f"Number of labels ({len(labels)}) must match matrix dimension ({dist_array.shape[0]})")

    # Check for symmetry
    if not np.allclose(dist_array, dist_array.T):
        logger.warning("Distance matrix is not symmetric, using average of upper and lower triangular")
        dist_array = (dist_array + dist_array.T) / 2

    # Run NJ algorithm
    nj = NeighborJoining(dist_array, labels)
    root = nj.run()

    # Store the root in the nodes dictionary for get_newick to work
    nj.nodes["root"] = root

    return {
        "tree": root.to_dict(),
        "newick": nj.get_newick(),
        "statistics": nj.get_statistics()
    }