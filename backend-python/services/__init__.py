"""
Services Module for Phylo Explorer
Contains ML services and embedding generators
"""

try:
    from .embedding_service import EmbeddingService
except ImportError:
    from .mock_embedding_service import MockEmbeddingService as EmbeddingService

__all__ = ['EmbeddingService']