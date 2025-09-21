"""
Simplified Phylo Explorer Backend - FastAPI Implementation
This version works without heavy ML dependencies
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import uvicorn
import os
from dotenv import load_dotenv
import logging
import numpy as np
from scipy.spatial.distance import pdist, squareform
from sklearn.feature_extraction.text import TfidfVectorizer

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create FastAPI application instance
app = FastAPI(
    title="Phylo Explorer API (Simplified)",
    description="Lightweight backend for phylogenetic tree analysis",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

# Configure CORS
origins = [
    "http://localhost:3000",  # Frontend development
    "http://localhost:4000",  # Node.js backend
    "http://localhost:6001",  # Alternative Node.js port
    "http://localhost:8001",  # Self
    "*"  # Allow all origins during development
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class HealthResponse(BaseModel):
    status: str
    environment: str
    port: int
    services: Dict[str, bool]

class TextData(BaseModel):
    texts: List[str]
    labels: Optional[List[str]] = None

class DistanceMatrixResponse(BaseModel):
    distance_matrix: List[List[float]]
    method: str
    shape: List[int]

class EmbeddingResponse(BaseModel):
    embeddings: List[List[float]]
    shape: List[int]
    model: str

# Routes
@app.get("/")
def read_root():
    return {
        "message": "Phylo Explorer ML Service (Simplified)",
        "status": "operational",
        "endpoints": {
            "/health": "Service health check",
            "/api/v1/distancematrix": "Compute distance matrix",
            "/api/v1/embeddings": "Generate text embeddings",
            "/docs": "API documentation"
        }
    }

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        environment=os.getenv("ENVIRONMENT", "development"),
        port=int(os.getenv("PORT", 8001)),
        services={
            "text_processor": True,
            "embedding_service": True,
            "ml_models": True
        }
    )

@app.post("/api/v1/distancematrix", response_model=DistanceMatrixResponse)
async def compute_distance_matrix(data: TextData):
    """
    Compute distance matrix from text data using TF-IDF
    """
    try:
        if not data.texts or len(data.texts) < 2:
            raise HTTPException(
                status_code=400,
                detail="At least 2 text documents required"
            )

        # Use TF-IDF vectorizer
        vectorizer = TfidfVectorizer(
            max_features=1000,
            stop_words='english',
            lowercase=True
        )

        # Fit and transform texts
        tfidf_matrix = vectorizer.fit_transform(data.texts)

        # Compute pairwise distances
        distances = pdist(tfidf_matrix.toarray(), metric='euclidean')
        distance_matrix = squareform(distances)

        return DistanceMatrixResponse(
            distance_matrix=distance_matrix.tolist(),
            method="tfidf_euclidean",
            shape=list(distance_matrix.shape)
        )

    except Exception as e:
        logger.error(f"Error computing distance matrix: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/embeddings", response_model=EmbeddingResponse)
async def generate_embeddings(data: TextData):
    """
    Generate text embeddings using TF-IDF
    """
    try:
        if not data.texts:
            raise HTTPException(
                status_code=400,
                detail="Text data is required"
            )

        # Use TF-IDF vectorizer
        vectorizer = TfidfVectorizer(
            max_features=100,  # Reduced dimensionality
            stop_words='english',
            lowercase=True
        )

        # Fit and transform texts
        embeddings = vectorizer.fit_transform(data.texts).toarray()

        return EmbeddingResponse(
            embeddings=embeddings.tolist(),
            shape=list(embeddings.shape),
            model="tfidf"
        )

    except Exception as e:
        logger.error(f"Error generating embeddings: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/preprocess")
async def preprocess_text(data: Dict[str, Any]):
    """
    Basic text preprocessing endpoint
    """
    try:
        text = data.get("text", "")
        if not text:
            raise HTTPException(
                status_code=400,
                detail="Text is required"
            )

        # Simple preprocessing
        processed = text.lower().strip()

        return {
            "original": text,
            "processed": processed,
            "tokens": processed.split(),
            "length": len(processed.split())
        }

    except Exception as e:
        logger.error(f"Error preprocessing text: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/models")
async def list_models():
    """List available models"""
    return {
        "models": [
            {
                "name": "tfidf",
                "type": "feature_extraction",
                "status": "available",
                "description": "TF-IDF vectorizer for text feature extraction"
            }
        ]
    }

@app.get("/metrics")
async def get_metrics():
    """Get service metrics"""
    try:
        import psutil
        process = psutil.Process()

        return {
            "memory": {
                "rss_mb": process.memory_info().rss / 1024 / 1024,
                "percent": process.memory_percent()
            },
            "cpu": {
                "percent": process.cpu_percent(interval=1.0),
                "num_threads": process.num_threads()
            },
            "uptime": int(process.create_time())
        }
    except:
        return {"status": "metrics unavailable"}

@app.post("/api/v1/pipeline/full")
async def full_pipeline(data: Dict[str, Any]):
    """
    Full pipeline for phylogenetic tree reconstruction
    """
    try:
        documents = data.get("documents", [])
        if not documents:
            raise HTTPException(
                status_code=400,
                detail="Documents are required"
            )

        # Extract texts and labels
        texts = []
        labels = []
        for doc in documents:
            text = doc.get("content") or doc.get("text") or ""
            label = doc.get("category") or doc.get("label") or f"Doc{len(texts)+1}"
            texts.append(text)
            labels.append(label)

        if len(texts) < 2:
            raise HTTPException(
                status_code=400,
                detail="At least 2 documents required for tree construction"
            )

        # Use TF-IDF vectorizer
        vectorizer = TfidfVectorizer(
            max_features=1000,
            stop_words='english',
            lowercase=True
        )

        # Fit and transform texts
        tfidf_matrix = vectorizer.fit_transform(texts).toarray()

        # Compute pairwise distances
        distances = pdist(tfidf_matrix, metric='cosine')
        distance_matrix = squareform(distances)

        # Create a simple Newick tree (simplified version)
        # This creates a star tree with all leaves connected to a central node
        newick_parts = []
        for i, label in enumerate(labels):
            # Clean label for Newick format
            clean_label = label.replace(" ", "_").replace("(", "").replace(")", "").replace(",", "").replace(";", "")
            newick_parts.append(f"{clean_label}:{distance_matrix[0][i] if i > 0 else 0.1:.3f}")

        newick = f"({','.join(newick_parts)});"

        # Create tree structure
        tree_structure = {
            "name": "root",
            "children": [
                {"name": label, "distance": float(distance_matrix[0][i] if i > 0 else 0.1)}
                for i, label in enumerate(labels)
            ]
        }

        return {
            "status": "success",
            "newick": newick,
            "tree_structure": tree_structure,
            "labels": labels,
            "distance_matrix": distance_matrix.tolist(),
            "statistics": {
                "algorithm": "star_tree",
                "num_taxa": len(texts),
                "embedding_model": "tfidf",
                "distance_metric": "cosine"
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in full pipeline: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8001))
    uvicorn.run(
        "main_simple:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        log_level="info"
    )