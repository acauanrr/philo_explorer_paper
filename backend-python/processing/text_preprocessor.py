"""
Text Preprocessing Module
Handles text cleaning, normalization, and optional transformations
"""

import re
import unicodedata
from typing import List, Optional
import nltk
from nltk.corpus import stopwords
from nltk.stem import SnowballStemmer
import logging

logger = logging.getLogger(__name__)

class TextPreprocessor:
    """
    Text preprocessing pipeline with configurable steps
    Optimized for Portuguese text but supports multiple languages
    """

    def __init__(
        self,
        language: str = 'portuguese',
        remove_stopwords: bool = True,
        apply_stemming: bool = False,  # Disabled by default for transformer models
        lowercase: bool = True,
        remove_html: bool = True,
        normalize_whitespace: bool = True
    ):
        """
        Initialize text preprocessor with configurable options

        Args:
            language: Language for stopwords and stemming
            remove_stopwords: Whether to remove stopwords
            apply_stemming: Whether to apply stemming (default False for transformers)
            lowercase: Whether to convert to lowercase
            remove_html: Whether to remove HTML tags
            normalize_whitespace: Whether to normalize whitespace
        """
        self.language = language
        self.remove_stopwords = remove_stopwords
        self.apply_stemming = apply_stemming
        self.lowercase = lowercase
        self.remove_html = remove_html
        self.normalize_whitespace = normalize_whitespace

        # Download required NLTK data
        self._download_nltk_data()

        # Initialize stopwords
        if self.remove_stopwords:
            try:
                self.stop_words = set(stopwords.words(language))
                logger.info(f"Loaded {len(self.stop_words)} stopwords for {language}")
            except:
                logger.warning(f"Could not load stopwords for {language}, using empty set")
                self.stop_words = set()

        # Initialize stemmer
        if self.apply_stemming:
            try:
                self.stemmer = SnowballStemmer(language)
                logger.info(f"Initialized stemmer for {language}")
            except:
                logger.warning(f"Could not initialize stemmer for {language}")
                self.apply_stemming = False

    def _download_nltk_data(self):
        """Download required NLTK data if not present"""
        try:
            nltk.data.find('corpora/stopwords')
        except LookupError:
            logger.info("Downloading NLTK stopwords...")
            nltk.download('stopwords', quiet=True)

        try:
            nltk.data.find('tokenizers/punkt')
        except LookupError:
            logger.info("Downloading NLTK punkt tokenizer...")
            nltk.download('punkt', quiet=True)

    def clean_text(self, text: str) -> str:
        """
        Apply all configured preprocessing steps to a single text

        Args:
            text: Input text to clean

        Returns:
            Cleaned text
        """
        if not text:
            return ""

        # Remove HTML tags
        if self.remove_html:
            text = self._remove_html_tags(text)

        # Normalize unicode characters
        text = unicodedata.normalize('NFKD', text)

        # Convert to lowercase
        if self.lowercase:
            text = text.lower()

        # Remove special characters but keep spaces and basic punctuation
        text = re.sub(r'[^\w\s\.\,\!\?\-]', ' ', text)

        # Normalize whitespace
        if self.normalize_whitespace:
            text = ' '.join(text.split())

        # Remove stopwords
        if self.remove_stopwords and self.stop_words:
            words = text.split()
            words = [w for w in words if w not in self.stop_words]
            text = ' '.join(words)

        # Apply stemming (disabled by default for transformer models)
        if self.apply_stemming and hasattr(self, 'stemmer'):
            words = text.split()
            words = [self.stemmer.stem(w) for w in words]
            text = ' '.join(words)

        return text.strip()

    def _remove_html_tags(self, text: str) -> str:
        """Remove HTML tags from text"""
        clean = re.compile('<.*?>')
        return re.sub(clean, ' ', text)

    def process_batch(self, texts: List[str]) -> List[str]:
        """
        Process a batch of texts

        Args:
            texts: List of input texts

        Returns:
            List of cleaned texts
        """
        return [self.clean_text(text) for text in texts]

    def get_config(self) -> dict:
        """Get current preprocessor configuration"""
        return {
            'language': self.language,
            'remove_stopwords': self.remove_stopwords,
            'apply_stemming': self.apply_stemming,
            'lowercase': self.lowercase,
            'remove_html': self.remove_html,
            'normalize_whitespace': self.normalize_whitespace
        }