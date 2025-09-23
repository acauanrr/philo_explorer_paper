"""
Phylo Explorer Backend - FastAPI Implementation
Author: Acauan
Description: High-performance Python backend for phylogenetic tree analysis with ML integration
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from contextlib import asynccontextmanager
import uvicorn
import os
import numpy as np
from dotenv import load_dotenv
import logging

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO if os.getenv("ENVIRONMENT") != "development" else logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Import custom modules
from processing.text_preprocessor import TextPreprocessor
from services import EmbeddingService
from routes import dataset_routes

# Import projection quality modules
from app.schemas import (
    ProjectionErrorsRequest, ProjectionErrorsResponse,
    FalseNeighborsRequest, FalseNeighborsResponse,
    MissingNeighborsRequest, MissingNeighborsResponse,
    GroupAnalysisRequest, GroupAnalysisResponse,
    ProjectionCompareRequest, ProjectionCompareResponse
)
from app.projection_quality import ProjectionQualityMetrics

# Global services
embedding_service: Optional[EmbeddingService] = None
text_preprocessor: Optional[TextPreprocessor] = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for initialization and cleanup
    Loads ML models on startup and cleans up on shutdown
    """
    global embedding_service, text_preprocessor

    logger.info("Initializing ML services...")

    # Initialize text preprocessor
    text_preprocessor = TextPreprocessor(
        language='portuguese',
        remove_stopwords=True,
        apply_stemming=False,  # Disabled for transformer models
        lowercase=True,
        remove_html=True,
        normalize_whitespace=True
    )
    logger.info("Text preprocessor initialized")

    # Initialize embedding service
    try:
        embedding_service = EmbeddingService(
            model_name=os.getenv('EMBEDDING_MODEL'),
            cache_folder='./models_cache'
        )
        logger.info(f"Embedding service initialized with model: {embedding_service.model_name}")
    except Exception as e:
        logger.error(f"Failed to initialize embedding service: {e}")
        # Continue without embeddings service
        embedding_service = None

    yield

    # Cleanup
    logger.info("Shutting down ML services...")

# Create FastAPI application instance with lifespan
app = FastAPI(
    title="Phylo Explorer API",
    description="High-performance backend for phylogenetic tree analysis with NLP integration",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan
)

# Configure CORS
origins = [
    "http://localhost:3000",  # Frontend development
    "http://localhost:6001",  # Node.js backend
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

# Include dataset routes
app.include_router(dataset_routes.router)

# Include term evolution routes
from routes import evolution_routes
app.include_router(evolution_routes.router, prefix="/api/v1")

# ============= Pydantic Models =============

class HealthResponse(BaseModel):
    """Health check response model"""
    status: str
    service: str
    version: str
    timestamp: datetime
    environment: str
    python_version: str
    ml_service_ready: bool

class Document(BaseModel):
    """Document model for text processing"""
    id: str = Field(..., description="Unique document identifier")
    content: str = Field(..., description="Text content of the document")
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="Optional metadata")

class DistanceMatrixRequest(BaseModel):
    """Request model for distance matrix generation"""
    documents: List[Document] = Field(..., description="List of documents to process")
    preprocess: bool = Field(default=True, description="Whether to preprocess texts")
    distance_metric: str = Field(default="cosine", description="Distance metric to use (cosine or euclidean)")
    batch_size: int = Field(default=32, description="Batch size for embedding generation")

class DistanceMatrixResponse(BaseModel):
    """Response model for distance matrix generation"""
    distance_matrix: List[List[float]] = Field(..., description="Pairwise distance matrix")
    document_ids: List[str] = Field(..., description="Document IDs in matrix order")
    labels: List[str] = Field(..., description="Document labels (truncated content)")
    embedding_dimension: int = Field(..., description="Dimension of embeddings used")
    model_used: str = Field(..., description="Name of the embedding model used")
    preprocessing_applied: bool = Field(..., description="Whether preprocessing was applied")
    distance_metric: str = Field(..., description="Distance metric used")

class EmbeddingRequest(BaseModel):
    """Request model for generating embeddings"""
    texts: List[str] = Field(..., description="List of texts to embed")
    preprocess: bool = Field(default=False, description="Whether to preprocess texts")

class EmbeddingResponse(BaseModel):
    """Response model for embeddings"""
    embeddings: List[List[float]] = Field(..., description="List of embedding vectors")
    dimension: int = Field(..., description="Dimension of embeddings")
    model_used: str = Field(..., description="Name of the model used")

class TreeReconstructRequest(BaseModel):
    """Request model for tree reconstruction"""
    distance_matrix: List[List[float]] = Field(..., description="Distance matrix")
    labels: List[str] = Field(..., description="Labels for each taxon")

class TreeReconstructResponse(BaseModel):
    """Response model for tree reconstruction"""
    newick: str = Field(..., description="Tree in Newick format")
    tree_structure: Dict[str, Any] = Field(..., description="Tree structure as nested dict")
    statistics: Dict[str, Any] = Field(..., description="Algorithm statistics")

class FullPipelineRequest(BaseModel):
    """Request for full pipeline: texts to tree"""
    documents: List[Document] = Field(..., description="Documents to process")
    preprocess: bool = Field(default=True, description="Whether to preprocess texts")
    distance_metric: str = Field(default="cosine", description="Distance metric")
    algorithm: str = Field(default="neighbor_joining", description="Tree reconstruction algorithm")

class FullPipelineResponse(BaseModel):
    """Response for full pipeline"""
    newick: str = Field(..., description="Tree in Newick format")
    tree_structure: Dict[str, Any] = Field(..., description="Tree structure")
    distance_matrix: List[List[float]] = Field(..., description="Distance matrix used")
    labels: List[str] = Field(..., description="Document labels")
    statistics: Dict[str, Any] = Field(..., description="Execution statistics")

# ============= Endpoints =============

@app.get("/")
async def root():
    """Root endpoint providing API information"""
    return {
        "message": "Welcome to Phylo Explorer API v2.0",
        "version": "2.0.0",
        "documentation": "/docs",
        "health_check": "/health",
        "endpoints": {
            "health": "/health",
            "info": "/api/info",
            "metrics": "/metrics",
            "distance_matrix": "/api/v1/distancematrix",
            "embeddings": "/api/v1/embeddings",
            "preprocessing": "/api/v1/preprocess",
            "tree_reconstruction": "/api/v1/tree/reconstruct",
            "full_pipeline": "/api/v1/pipeline/full"
        }
    }

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Health check endpoint for monitoring and deployment verification.
    """
    import sys

    return HealthResponse(
        status="ok",
        service="phylo-explorer-backend",
        version="2.0.0",
        timestamp=datetime.now(),
        environment=os.getenv("ENVIRONMENT", "development"),
        python_version=f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
        ml_service_ready=embedding_service is not None
    )

@app.post("/api/v1/distancematrix", response_model=DistanceMatrixResponse)
async def generate_distance_matrix(request: DistanceMatrixRequest):
    """
    Generate pairwise distance matrix from documents using semantic embeddings

    This endpoint orchestrates the complete pipeline:
    1. Text preprocessing (optional)
    2. Embedding generation using Sentence Transformers
    3. Distance matrix calculation
    """
    if not embedding_service:
        raise HTTPException(status_code=503, detail="Embedding service not available")

    try:
        # Extract texts and IDs
        texts = [doc.content for doc in request.documents]
        doc_ids = [doc.id for doc in request.documents]

        # Create labels (truncated content)
        labels = [text[:50] + "..." if len(text) > 50 else text for text in texts]

        # Preprocess if requested
        if request.preprocess and text_preprocessor:
            logger.info("Preprocessing texts...")
            texts = text_preprocessor.process_batch(texts)

        # Generate embeddings and distance matrix
        logger.info(f"Generating embeddings for {len(texts)} documents...")
        embeddings, distance_matrix = embedding_service.process_texts_to_distances(
            texts=texts,
            preprocess=False,  # Already preprocessed above if requested
            batch_size=request.batch_size
        )

        # Convert numpy array to list for JSON serialization
        distance_matrix_list = distance_matrix.tolist()

        # Get model info
        model_info = embedding_service.get_model_info()

        return DistanceMatrixResponse(
            distance_matrix=distance_matrix_list,
            document_ids=doc_ids,
            labels=labels,
            embedding_dimension=model_info['embedding_dimension'],
            model_used=model_info['model_name'],
            preprocessing_applied=request.preprocess,
            distance_metric=request.distance_metric
        )

    except Exception as e:
        logger.error(f"Error generating distance matrix: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/embeddings", response_model=EmbeddingResponse)
async def generate_embeddings(request: EmbeddingRequest):
    """
    Generate semantic embeddings for given texts
    """
    if not embedding_service:
        raise HTTPException(status_code=503, detail="Embedding service not available")

    try:
        texts = request.texts

        # Preprocess if requested
        if request.preprocess and text_preprocessor:
            texts = text_preprocessor.process_batch(texts)

        # Generate embeddings
        embeddings = embedding_service.encode(texts)

        # Get model info
        model_info = embedding_service.get_model_info()

        return EmbeddingResponse(
            embeddings=embeddings.tolist(),
            dimension=model_info['embedding_dimension'],
            model_used=model_info['model_name']
        )

    except Exception as e:
        logger.error(f"Error generating embeddings: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/preprocess")
async def preprocess_texts(texts: List[str]):
    """
    Preprocess texts using the configured text preprocessor
    """
    if not text_preprocessor:
        raise HTTPException(status_code=503, detail="Text preprocessor not available")

    try:
        processed_texts = text_preprocessor.process_batch(texts)

        return {
            "original_texts": texts,
            "processed_texts": processed_texts,
            "config": text_preprocessor.get_config()
        }

    except Exception as e:
        logger.error(f"Error preprocessing texts: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/models")
async def get_available_models():
    """
    Get list of available embedding models
    """
    from services.embedding_service import EmbeddingService

    return {
        "available_models": EmbeddingService.PORTUGUESE_MODELS,
        "current_model": embedding_service.model_name if embedding_service else None,
        "model_info": embedding_service.get_model_info() if embedding_service else None
    }

@app.get("/metrics")
async def get_metrics():
    """
    Metrics endpoint for performance monitoring
    """
    import psutil
    import platform

    # Get system metrics
    cpu_percent = psutil.cpu_percent(interval=1)
    memory = psutil.virtual_memory()

    return {
        "system": {
            "platform": platform.platform(),
            "python_version": platform.python_version(),
            "cpu_count": psutil.cpu_count(),
            "cpu_percent": cpu_percent,
            "memory": {
                "total": memory.total,
                "available": memory.available,
                "percent": memory.percent,
                "used": memory.used,
                "free": memory.free
            }
        },
        "service": {
            "name": "phylo-explorer-backend",
            "version": "2.0.0",
            "uptime": datetime.now().isoformat(),
            "environment": os.getenv("ENVIRONMENT", "development"),
            "ml_service_ready": embedding_service is not None,
            "embedding_model": embedding_service.model_name if embedding_service else None
        }
    }

@app.post("/api/v1/tree/reconstruct", response_model=TreeReconstructResponse)
async def reconstruct_tree(request: TreeReconstructRequest):
    """
    Reconstruct phylogenetic tree from distance matrix using Neighbor-Joining

    This endpoint implements the O(n³) NJ algorithm for tree reconstruction.
    For large matrices (n > 100), consider using async processing.
    """
    try:
        from algorithms import build_nj_tree

        logger.info(f"Tree reconstruction requested for {len(request.labels)} taxa")

        # Build tree using NJ algorithm
        result = build_nj_tree(request.distance_matrix, request.labels)

        return TreeReconstructResponse(
            newick=result["newick"],
            tree_structure=result["tree"],
            statistics=result["statistics"]
        )

    except ValueError as e:
        logger.error(f"Invalid input for tree reconstruction: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error in tree reconstruction: {e}")
        raise HTTPException(status_code=500, detail="Tree reconstruction failed")

@app.post("/api/v1/pipeline/full", response_model=FullPipelineResponse)
async def full_pipeline(request: FullPipelineRequest):
    """
    Complete pipeline: documents → embeddings → distance matrix → tree

    This orchestrator endpoint runs the full analysis pipeline:
    1. Text preprocessing (optional)
    2. Embedding generation
    3. Distance matrix calculation
    4. Tree reconstruction using Neighbor-Joining
    """
    if not embedding_service:
        raise HTTPException(status_code=503, detail="Embedding service not available")

    try:
        from algorithms import build_nj_tree

        # Step 1: Extract and preprocess texts
        texts = [doc.content for doc in request.documents]
        doc_ids = [doc.id for doc in request.documents]
        labels = [doc.id for doc in request.documents]

        if request.preprocess and text_preprocessor:
            logger.info("Preprocessing texts...")
            texts = text_preprocessor.process_batch(texts)

        # Step 2: Generate embeddings
        logger.info(f"Generating embeddings for {len(texts)} documents...")
        embeddings = embedding_service.encode(texts)

        # Step 3: Calculate distance matrix
        logger.info("Calculating distance matrix...")
        distance_matrix = embedding_service.compute_distance_matrix(
            embeddings,
            distance_metric=request.distance_metric
        )

        # Step 4: Reconstruct tree
        logger.info("Reconstructing phylogenetic tree...")
        tree_result = build_nj_tree(distance_matrix.tolist(), labels)

        # Compile statistics
        statistics = {
            **tree_result["statistics"],
            "n_documents": len(request.documents),
            "preprocessing_applied": request.preprocess,
            "distance_metric": request.distance_metric,
            "embedding_model": embedding_service.model_name,
            "embedding_dimension": embedding_service.embedding_dim
        }

        return FullPipelineResponse(
            newick=tree_result["newick"],
            tree_structure=tree_result["tree"],
            distance_matrix=distance_matrix.tolist(),
            labels=labels,
            statistics=statistics
        )

    except Exception as e:
        logger.error(f"Pipeline execution failed: {e}")
        raise HTTPException(status_code=500, detail="Pipeline execution failed")

# ============= Projection Quality Endpoints =============

@app.post("/api/v1/projection/errors", response_model=ProjectionErrorsResponse)
async def compute_projection_errors(request: ProjectionErrorsRequest):
    """
    Compute normalized projection errors matrix e_ij ∈ [-1, 1]

    Formula: e_ij = (d_low_ij - d_high_ij) / max(d_high_ij, d_low_ij)

    - Positive values indicate expansion (distances increased)
    - Negative values indicate compression (distances decreased)
    - Values close to 0 indicate good preservation
    """
    try:
        # Convert to numpy arrays
        D_high = np.array(request.D_high)
        D_low = np.array(request.D_low)

        # Validate dimensions
        if D_high.shape != D_low.shape:
            raise ValueError("Distance matrices must have same dimensions")

        if D_high.shape[0] != D_high.shape[1]:
            raise ValueError("Distance matrices must be square")

        # Compute errors
        errors, stats = ProjectionQualityMetrics.compute_projection_errors(D_high, D_low)

        return ProjectionErrorsResponse(
            errors=errors.tolist(),
            stats=stats
        )

    except ValueError as e:
        logger.error(f"Invalid input for projection errors: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error computing projection errors: {e}")
        raise HTTPException(status_code=500, detail="Failed to compute projection errors")

@app.post("/api/v1/projection/false_neighbors", response_model=FalseNeighborsResponse)
async def find_false_neighbors(request: FalseNeighborsRequest):
    """
    Identify false neighbors: points that are neighbors in low-D but not in high-D

    Also computes Delaunay triangulation for visualization of 2D projections.
    """
    try:
        # Convert to numpy arrays
        D_high = np.array(request.D_high)
        D_low = np.array(request.D_low)
        points_2d = np.array(request.points_2d)

        # Validate
        if D_high.shape != D_low.shape:
            raise ValueError("Distance matrices must have same dimensions")

        if points_2d.shape[0] != D_high.shape[0]:
            raise ValueError("Number of 2D points must match matrix dimension")

        if points_2d.shape[1] != 2:
            raise ValueError("Points must be 2D coordinates")

        # Compute false neighbors
        false_neighbors, delaunay_edges, metrics = ProjectionQualityMetrics.compute_false_neighbors(
            D_high, D_low, points_2d, request.k_neighbors
        )

        return FalseNeighborsResponse(
            false_neighbors=false_neighbors,
            delaunay_edges=delaunay_edges,
            metrics=metrics
        )

    except ValueError as e:
        logger.error(f"Invalid input for false neighbors: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error computing false neighbors: {e}")
        raise HTTPException(status_code=500, detail="Failed to compute false neighbors")

@app.post("/api/v1/projection/missing_neighbors", response_model=MissingNeighborsResponse)
async def compute_missing_neighbors(request: MissingNeighborsRequest):
    """
    Build graph of missing neighbors: points that are neighbors in high-D but far in low-D

    Useful for understanding which relationships are lost in the projection.
    """
    try:
        # Convert to numpy arrays
        D_high = np.array(request.D_high)
        D_low = np.array(request.D_low)

        # Validate
        if D_high.shape != D_low.shape:
            raise ValueError("Distance matrices must have same dimensions")

        # Compute missing neighbors graph
        graph, missing_count, stats = ProjectionQualityMetrics.compute_missing_neighbors_graph(
            D_high, D_low, request.k_neighbors, request.threshold
        )

        return MissingNeighborsResponse(
            graph=graph,
            missing_count=missing_count,
            stats=stats
        )

    except ValueError as e:
        logger.error(f"Invalid input for missing neighbors: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error computing missing neighbors: {e}")
        raise HTTPException(status_code=500, detail="Failed to compute missing neighbors")

@app.post("/api/v1/projection/group_analysis", response_model=GroupAnalysisResponse)
async def analyze_projection_groups(request: GroupAnalysisRequest):
    """
    Analyze projection quality per group/cluster

    Computes cohesion, separation, and confusion matrix for grouped data.
    """
    try:
        # Convert to numpy arrays
        D_high = np.array(request.D_high)
        D_low = np.array(request.D_low)
        groups = np.array(request.groups)

        # Validate
        if D_high.shape != D_low.shape:
            raise ValueError("Distance matrices must have same dimensions")

        if len(groups) != D_high.shape[0]:
            raise ValueError("Number of group labels must match matrix dimension")

        # Analyze groups
        group_metrics, confusion_matrix, global_metrics = ProjectionQualityMetrics.analyze_groups(
            D_high, D_low, groups
        )

        # Convert to response format
        from app.schemas import GroupMetrics
        groups_response = [GroupMetrics(**metrics) for metrics in group_metrics]

        return GroupAnalysisResponse(
            groups=groups_response,
            confusion_matrix=confusion_matrix,
            global_metrics=global_metrics
        )

    except ValueError as e:
        logger.error(f"Invalid input for group analysis: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error in group analysis: {e}")
        raise HTTPException(status_code=500, detail="Failed to analyze groups")

@app.post("/api/v1/projection/compare", response_model=ProjectionCompareResponse)
async def compare_projections(request: ProjectionCompareRequest):
    """
    Compare multiple projection methods using various quality metrics

    Computes stress, trustworthiness, continuity, and other metrics for each projection.
    Returns rankings and identifies the best projection.
    """
    try:
        # Convert to numpy arrays
        D_high = np.array(request.D_high)

        # Convert projection dictionaries
        projections = {}
        for name, D_low_list in request.projections.items():
            D_low = np.array(D_low_list)
            if D_high.shape != D_low.shape:
                raise ValueError(f"Projection '{name}' has incompatible dimensions")
            projections[name] = D_low

        # Compare projections
        projection_metrics, rankings, best_projection, comparison_matrix = \
            ProjectionQualityMetrics.compare_projections(D_high, projections)

        # Convert to response format
        from app.schemas import ProjectionMetrics
        projections_response = [ProjectionMetrics(**metrics) for metrics in projection_metrics]

        return ProjectionCompareResponse(
            projections=projections_response,
            rankings=rankings,
            best_projection=best_projection,
            comparison_matrix=comparison_matrix
        )

    except ValueError as e:
        logger.error(f"Invalid input for projection comparison: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error comparing projections: {e}")
        raise HTTPException(status_code=500, detail="Failed to compare projections")

# Error handlers removed - causing conflicts with FastAPI defaults

# Main entry point
if __name__ == "__main__":
    # Get configuration from environment variables
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8001"))
    reload = os.getenv("ENVIRONMENT", "development") == "development"

    logger.info(f"Starting Phylo Explorer Backend on {host}:{port}")
    logger.info(f"Environment: {os.getenv('ENVIRONMENT', 'development')}")
    logger.info(f"Auto-reload: {reload}")
    logger.info(f"Documentation available at: http://{host}:{port}/docs")

    # Run the server
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=reload,
        log_level="info" if not reload else "debug"
    )