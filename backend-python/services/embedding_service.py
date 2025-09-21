"""
Embedding Service using Sentence Transformers
Generates semantic embeddings for text using state-of-the-art transformer models
"""

import os
import numpy as np
from typing import List, Optional, Union
from sentence_transformers import SentenceTransformer
import torch
from sklearn.metrics.pairwise import cosine_similarity
import logging

logger = logging.getLogger(__name__)

class EmbeddingService:
    """
    Service for generating semantic embeddings using Sentence Transformers
    Optimized for Portuguese and multilingual text
    """

    # Recommended models for Portuguese text
    PORTUGUESE_MODELS = {
        'rufimelo': 'rufimelo/bert-large-portuguese-cased-sts',
        'bertimbau': 'neuralmind/bert-base-portuguese-cased',
        'multilingual': 'sentence-transformers/paraphrase-multilingual-mpnet-base-v2',
        'minilm': 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2'
    }

    def __init__(
        self,
        model_name: Optional[str] = None,
        device: Optional[str] = None,
        cache_folder: Optional[str] = './models_cache'
    ):
        """
        Initialize embedding service with specified model

        Args:
            model_name: Name or path of the sentence transformer model
            device: Device to use ('cuda', 'cpu', or None for auto-detect)
            cache_folder: Folder to cache downloaded models
        """
        # Use environment variable or default to multilingual model
        if model_name is None:
            model_name = os.getenv(
                'EMBEDDING_MODEL',
                self.PORTUGUESE_MODELS['multilingual']
            )

        self.model_name = model_name
        self.cache_folder = cache_folder

        # Auto-detect device if not specified
        if device is None:
            self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        else:
            self.device = device

        logger.info(f"Initializing embedding service with model: {model_name}")
        logger.info(f"Using device: {self.device}")

        # Load the model
        self._load_model()

    def _load_model(self):
        """Load the sentence transformer model"""
        try:
            self.model = SentenceTransformer(
                self.model_name,
                device=self.device,
                cache_folder=self.cache_folder
            )

            # Get model dimensions
            self.embedding_dim = self.model.get_sentence_embedding_dimension()
            logger.info(f"Model loaded successfully. Embedding dimension: {self.embedding_dim}")

        except Exception as e:
            logger.error(f"Failed to load model {self.model_name}: {e}")
            # Fallback to a smaller model
            logger.info("Falling back to MiniLM model...")
            self.model_name = self.PORTUGUESE_MODELS['minilm']
            self.model = SentenceTransformer(
                self.model_name,
                device=self.device,
                cache_folder=self.cache_folder
            )
            self.embedding_dim = self.model.get_sentence_embedding_dimension()

    def encode(
        self,
        texts: Union[str, List[str]],
        batch_size: int = 32,
        show_progress_bar: bool = False,
        normalize_embeddings: bool = True
    ) -> np.ndarray:
        """
        Generate embeddings for given texts

        Args:
            texts: Single text or list of texts to encode
            batch_size: Batch size for encoding
            show_progress_bar: Whether to show progress bar
            normalize_embeddings: Whether to normalize embeddings (for cosine similarity)

        Returns:
            Numpy array of embeddings
        """
        # Ensure texts is a list
        if isinstance(texts, str):
            texts = [texts]

        # Generate embeddings
        embeddings = self.model.encode(
            texts,
            batch_size=batch_size,
            show_progress_bar=show_progress_bar,
            normalize_embeddings=normalize_embeddings,
            convert_to_numpy=True
        )

        return embeddings

    def compute_similarity_matrix(
        self,
        embeddings: np.ndarray
    ) -> np.ndarray:
        """
        Compute pairwise cosine similarity matrix from embeddings

        Args:
            embeddings: Numpy array of embeddings

        Returns:
            Similarity matrix
        """
        # If embeddings are already normalized, dot product gives cosine similarity
        # Otherwise, use sklearn's cosine_similarity
        similarity_matrix = cosine_similarity(embeddings)
        return similarity_matrix

    def compute_distance_matrix(
        self,
        embeddings: np.ndarray,
        distance_metric: str = 'cosine'
    ) -> np.ndarray:
        """
        Compute pairwise distance matrix from embeddings

        Args:
            embeddings: Numpy array of embeddings
            distance_metric: Distance metric ('cosine', 'euclidean')

        Returns:
            Distance matrix
        """
        if distance_metric == 'cosine':
            # Convert cosine similarity to distance
            similarity_matrix = self.compute_similarity_matrix(embeddings)
            distance_matrix = 1 - similarity_matrix

            # Ensure diagonal is exactly 0
            np.fill_diagonal(distance_matrix, 0.0)

            # Ensure no negative values (due to floating point errors)
            distance_matrix = np.maximum(distance_matrix, 0.0)

        elif distance_metric == 'euclidean':
            from scipy.spatial.distance import cdist
            distance_matrix = cdist(embeddings, embeddings, metric='euclidean')

        else:
            raise ValueError(f"Unsupported distance metric: {distance_metric}")

        return distance_matrix

    def process_texts_to_distances(
        self,
        texts: List[str],
        preprocess: bool = False,
        preprocessor=None,
        batch_size: int = 32
    ) -> tuple[np.ndarray, np.ndarray]:
        """
        Complete pipeline: texts -> embeddings -> distance matrix

        Args:
            texts: List of texts to process
            preprocess: Whether to preprocess texts
            preprocessor: Text preprocessor instance
            batch_size: Batch size for encoding

        Returns:
            Tuple of (embeddings, distance_matrix)
        """
        # Optionally preprocess texts
        if preprocess and preprocessor:
            texts = preprocessor.process_batch(texts)

        # Generate embeddings
        embeddings = self.encode(texts, batch_size=batch_size)

        # Compute distance matrix
        distance_matrix = self.compute_distance_matrix(embeddings)

        return embeddings, distance_matrix

    def get_model_info(self) -> dict:
        """Get information about the current model"""
        return {
            'model_name': self.model_name,
            'embedding_dimension': self.embedding_dim,
            'device': self.device,
            'max_sequence_length': self.model.max_seq_length
        }

    def change_model(self, model_name: str):
        """Change to a different model"""
        logger.info(f"Changing model from {self.model_name} to {model_name}")
        self.model_name = model_name
        self._load_model()