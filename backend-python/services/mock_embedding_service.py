"""
Mock Embedding Service for development without heavy ML dependencies
"""
import numpy as np
from typing import List, Optional, Tuple
import logging

logger = logging.getLogger(__name__)

class MockEmbeddingService:
    """
    Mock implementation of EmbeddingService for development
    Generates random embeddings instead of using real ML models
    """

    def __init__(self, model_name: Optional[str] = None, cache_folder: Optional[str] = None):
        self.model_name = model_name or "mock-model"
        self.cache_folder = cache_folder
        self.embedding_dim = 768  # Standard BERT dimension
        logger.info(f"MockEmbeddingService initialized (no real ML model loaded)")

    def encode(self, texts: List[str], batch_size: int = 32) -> np.ndarray:
        """Generate mock embeddings for texts"""
        # Generate deterministic random embeddings based on text length
        embeddings = []
        for text in texts:
            # Use text length as seed for consistency
            np.random.seed(len(text))
            embedding = np.random.randn(self.embedding_dim)
            # Normalize to unit vector
            embedding = embedding / np.linalg.norm(embedding)
            embeddings.append(embedding)

        return np.array(embeddings)

    def process_texts_to_distances(
        self,
        texts: List[str],
        preprocess: bool = False,
        batch_size: int = 32
    ) -> Tuple[np.ndarray, np.ndarray]:
        """Generate embeddings and compute distance matrix"""
        embeddings = self.encode(texts, batch_size)

        # Compute cosine distance matrix
        # Normalize embeddings
        normalized = embeddings / np.linalg.norm(embeddings, axis=1, keepdims=True)

        # Compute cosine similarity
        similarity_matrix = np.dot(normalized, normalized.T)

        # Convert to distance (1 - similarity)
        distance_matrix = 1 - similarity_matrix

        # Ensure diagonal is 0
        np.fill_diagonal(distance_matrix, 0)

        return embeddings, distance_matrix

    def get_model_info(self) -> dict:
        """Get model information"""
        return {
            'model_name': self.model_name,
            'embedding_dimension': self.embedding_dim,
            'is_mock': True
        }