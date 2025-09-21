"""
Term Evolution API Routes

Implements endpoint for temporal term evolution analysis
to support ThemeRiver-inspired timeline visualization
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import numpy as np
from collections import defaultdict, Counter
from pydantic import BaseModel
import re
from sklearn.feature_extraction.text import TfidfVectorizer
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

class Document(BaseModel):
    id: str
    content: str
    timestamp: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class TermEvolutionRequest(BaseModel):
    documents: List[Document]
    n_terms: int = 20
    window_size: str = "week"  # day, week, month
    method: str = "tfidf"  # frequency or tfidf

class TermEvolutionResponse(BaseModel):
    timepoints: List[str]
    terms: List[str]
    evolution_data: List[Dict[str, Any]]
    metadata: Dict[str, Any]

def parse_timestamp(timestamp_str: str) -> datetime:
    """Parse various timestamp formats"""
    formats = [
        "%Y-%m-%d",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S.%fZ"
    ]

    for fmt in formats:
        try:
            return datetime.strptime(timestamp_str, fmt)
        except ValueError:
            continue

    # Default to current time if parsing fails
    logger.warning(f"Could not parse timestamp: {timestamp_str}")
    return datetime.now()

def get_time_windows(documents: List[Document], window_size: str):
    """Group documents into time windows"""

    # Parse timestamps
    doc_times = []
    for doc in documents:
        if doc.timestamp:
            doc_times.append((parse_timestamp(doc.timestamp), doc))
        else:
            # Assign a default timestamp if missing
            doc_times.append((datetime.now(), doc))

    if not doc_times:
        return []

    # Sort by time
    doc_times.sort(key=lambda x: x[0])

    # Determine window size in days
    window_days = {
        "day": 1,
        "week": 7,
        "month": 30,
        "quarter": 90,
        "year": 365
    }.get(window_size, 7)

    # Create windows
    windows = []
    start_time = doc_times[0][0]
    end_time = doc_times[-1][0]

    current_time = start_time
    while current_time <= end_time:
        window_end = current_time + timedelta(days=window_days)
        window_docs = [
            doc for time, doc in doc_times
            if current_time <= time < window_end
        ]

        if window_docs:  # Only add non-empty windows
            windows.append({
                "start": current_time.isoformat(),
                "end": window_end.isoformat(),
                "documents": window_docs
            })

        current_time = window_end

    return windows

def extract_top_terms(documents: List[Document], n_terms: int, method: str):
    """Extract top N terms from documents using specified method"""

    if not documents:
        return []

    # Combine all document texts
    texts = [doc.content for doc in documents]

    if method == "frequency":
        # Simple frequency-based extraction
        all_text = " ".join(texts)
        # Basic tokenization (remove punctuation, lowercase)
        words = re.findall(r'\b[a-z]+\b', all_text.lower())

        # Filter common stopwords (basic list)
        stopwords = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at',
                     'to', 'for', 'of', 'with', 'by', 'is', 'was', 'are',
                     'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does',
                     'did', 'will', 'would', 'should', 'could', 'may', 'might',
                     'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he',
                     'she', 'it', 'we', 'they', 'what', 'which', 'who', 'when',
                     'where', 'why', 'how', 'all', 'each', 'every', 'both',
                     'few', 'more', 'most', 'other', 'some', 'such', 'only',
                     'own', 'same', 'so', 'than', 'too', 'very', 'just'}

        filtered_words = [w for w in words if w not in stopwords and len(w) > 2]

        # Count frequencies
        word_freq = Counter(filtered_words)
        top_words = word_freq.most_common(n_terms)

        return [word for word, _ in top_words]

    elif method == "tfidf":
        # TF-IDF based extraction
        try:
            vectorizer = TfidfVectorizer(
                max_features=n_terms,
                stop_words='english',
                min_df=1,
                max_df=0.95,
                token_pattern=r'\b[a-zA-Z]{3,}\b'
            )

            tfidf_matrix = vectorizer.fit_transform(texts)
            feature_names = vectorizer.get_feature_names_out()

            # Get terms with highest average TF-IDF scores
            scores = np.mean(tfidf_matrix.toarray(), axis=0)
            top_indices = np.argsort(scores)[-n_terms:][::-1]

            return [feature_names[i] for i in top_indices]
        except Exception as e:
            logger.error(f"TF-IDF extraction failed: {e}")
            # Fallback to frequency method
            return extract_top_terms(documents, n_terms, "frequency")

    return []

@router.post("/termevolution", response_model=TermEvolutionResponse)
async def get_term_evolution(request: TermEvolutionRequest):
    """
    Generate term evolution data for timeline visualization

    This endpoint processes documents to track how term frequencies
    change over time, suitable for ThemeRiver/streamgraph visualization.
    """
    try:
        # Get time windows
        windows = get_time_windows(request.documents, request.window_size)

        if not windows:
            raise HTTPException(
                status_code=400,
                detail="No valid time windows could be created from documents"
            )

        # Extract global top terms from all documents
        all_terms = extract_top_terms(request.documents, request.n_terms, request.method)

        if not all_terms:
            raise HTTPException(
                status_code=400,
                detail="No terms could be extracted from documents"
            )

        # Calculate term frequencies for each window
        evolution_data = []
        timepoints = []

        for window in windows:
            timepoint = window["start"]
            timepoints.append(timepoint)

            # Get term frequencies for this window
            window_texts = " ".join([doc.content for doc in window["documents"]])
            window_words = re.findall(r'\b[a-z]+\b', window_texts.lower())
            window_freq = Counter(window_words)

            # Create data point for this timepoint
            datapoint = {
                "timepoint": timepoint,
                "values": {}
            }

            # Calculate frequency for each global term
            total_words = len(window_words)
            for term in all_terms:
                # Normalized frequency (0-1 scale)
                freq = window_freq.get(term, 0)
                normalized_freq = freq / total_words if total_words > 0 else 0
                datapoint["values"][term] = normalized_freq

            evolution_data.append(datapoint)

        # Return structured response
        return TermEvolutionResponse(
            timepoints=timepoints,
            terms=all_terms,
            evolution_data=evolution_data,
            metadata={
                "n_documents": len(request.documents),
                "n_windows": len(windows),
                "window_size": request.window_size,
                "method": request.method,
                "n_terms": len(all_terms)
            }
        )

    except Exception as e:
        logger.error(f"Term evolution analysis failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Term evolution analysis failed: {str(e)}"
        )

@router.get("/termevolution/sample")
async def get_sample_evolution():
    """
    Get sample term evolution data for testing
    """
    # Generate synthetic data for demonstration
    timepoints = ["2024-01-01", "2024-01-08", "2024-01-15", "2024-01-22", "2024-01-29"]
    terms = ["machine", "learning", "neural", "network", "deep", "transformer", "model", "data"]

    evolution_data = []
    for i, tp in enumerate(timepoints):
        values = {}
        for j, term in enumerate(terms):
            # Create varying frequencies with some pattern
            base = 0.1 + 0.05 * j
            variation = 0.05 * np.sin(i * 0.5 + j * 0.3)
            values[term] = max(0, base + variation)

        evolution_data.append({
            "timepoint": tp,
            "values": values
        })

    return TermEvolutionResponse(
        timepoints=timepoints,
        terms=terms,
        evolution_data=evolution_data,
        metadata={
            "n_documents": 50,
            "n_windows": len(timepoints),
            "window_size": "week",
            "method": "tfidf",
            "n_terms": len(terms),
            "is_sample": True
        }
    )