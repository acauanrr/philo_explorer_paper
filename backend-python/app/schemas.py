"""
Pydantic schemas for projection quality metrics
"""
from pydantic import BaseModel, Field, field_validator
from typing import List, Dict, Optional, Tuple, Any
import numpy as np


class ProjectionErrorsRequest(BaseModel):
    """Request for computing projection errors"""
    D_high: List[List[float]] = Field(..., description="High-dimensional distance matrix (NxN)")
    D_low: List[List[float]] = Field(..., description="Low-dimensional distance matrix (NxN)")

    @field_validator('D_high', 'D_low')
    @classmethod
    def validate_square_matrix(cls, v):
        n = len(v)
        for row in v:
            if len(row) != n:
                raise ValueError("Matrix must be square")
        return v

    @field_validator('D_high', 'D_low')
    @classmethod
    def validate_symmetric(cls, v):
        n = len(v)
        for i in range(n):
            for j in range(i+1, n):
                if abs(v[i][j] - v[j][i]) > 1e-10:
                    raise ValueError("Matrix must be symmetric")
        return v


class ProjectionErrorsResponse(BaseModel):
    """Response with projection errors matrix"""
    errors: List[List[float]] = Field(..., description="Error matrix e_ij normalized to [-1,1]")
    stats: Dict[str, float] = Field(..., description="Statistics about errors")


class FalseNeighborsRequest(BaseModel):
    """Request for computing false neighbors"""
    D_high: List[List[float]] = Field(..., description="High-dimensional distance matrix")
    D_low: List[List[float]] = Field(..., description="Low-dimensional distance matrix")
    points_2d: List[List[float]] = Field(..., description="2D coordinates for visualization")
    k_neighbors: int = Field(default=10, ge=1, le=100, description="Number of neighbors to consider")


class FalseNeighborsResponse(BaseModel):
    """Response with false neighbors analysis"""
    false_neighbors: List[Dict[str, Any]] = Field(..., description="List of false neighbor pairs")
    delaunay_edges: List[Tuple[int, int]] = Field(..., description="Delaunay triangulation edges")
    metrics: Dict[str, float] = Field(..., description="False neighbors metrics")


class MissingNeighborsRequest(BaseModel):
    """Request for missing neighbors graph"""
    D_high: List[List[float]] = Field(..., description="High-dimensional distance matrix")
    D_low: List[List[float]] = Field(..., description="Low-dimensional distance matrix")
    k_neighbors: int = Field(default=10, ge=1, le=100, description="Number of neighbors")
    threshold: float = Field(default=0.5, ge=0, le=1, description="Distance threshold")


class MissingNeighborsResponse(BaseModel):
    """Response with missing neighbors graph"""
    graph: Dict[int, List[int]] = Field(..., description="Adjacency list of missing neighbors")
    missing_count: Dict[int, int] = Field(..., description="Count of missing neighbors per point")
    stats: Dict[str, float] = Field(..., description="Missing neighbors statistics")


class GroupAnalysisRequest(BaseModel):
    """Request for group-based projection analysis"""
    D_high: List[List[float]] = Field(..., description="High-dimensional distance matrix")
    D_low: List[List[float]] = Field(..., description="Low-dimensional distance matrix")
    groups: List[int] = Field(..., description="Group labels for each point")

    @field_validator('groups')
    @classmethod
    def validate_groups(cls, v):
        if len(v) == 0:
            raise ValueError("Groups list cannot be empty")
        if min(v) < 0:
            raise ValueError("Group labels must be non-negative")
        return v


class GroupMetrics(BaseModel):
    """Metrics for a single group"""
    group_id: int
    size: int
    intra_group_error: float = Field(..., description="Average error within group")
    inter_group_error: float = Field(..., description="Average error between groups")
    cohesion_high: float = Field(..., description="Cohesion in high-dimensional space")
    cohesion_low: float = Field(..., description="Cohesion in low-dimensional space")
    separation_high: float = Field(..., description="Separation in high-dimensional space")
    separation_low: float = Field(..., description="Separation in low-dimensional space")


class GroupAnalysisResponse(BaseModel):
    """Response with group-based analysis"""
    groups: List[GroupMetrics] = Field(..., description="Metrics for each group")
    confusion_matrix: List[List[float]] = Field(..., description="Group confusion matrix")
    global_metrics: Dict[str, float] = Field(..., description="Global quality metrics")


class ProjectionCompareRequest(BaseModel):
    """Request for comparing multiple projections"""
    D_high: List[List[float]] = Field(..., description="High-dimensional distance matrix")
    projections: Dict[str, List[List[float]]] = Field(
        ...,
        description="Dictionary of projection_name -> D_low matrix"
    )

    @field_validator('projections')
    @classmethod
    def validate_projections(cls, v):
        if len(v) < 2:
            raise ValueError("At least 2 projections required for comparison")
        return v


class ProjectionMetrics(BaseModel):
    """Metrics for a single projection"""
    name: str
    stress: float = Field(..., description="Kruskal stress metric")
    trustworthiness: float = Field(..., description="Trustworthiness score [0,1]")
    continuity: float = Field(..., description="Continuity score [0,1]")
    avg_error: float = Field(..., description="Average normalized error")
    false_neighbors_ratio: float = Field(..., description="Ratio of false neighbors")
    missing_neighbors_ratio: float = Field(..., description="Ratio of missing neighbors")


class ProjectionCompareResponse(BaseModel):
    """Response comparing multiple projections"""
    projections: List[ProjectionMetrics] = Field(..., description="Metrics for each projection")
    rankings: Dict[str, List[str]] = Field(..., description="Rankings by metric")
    best_projection: str = Field(..., description="Best projection based on combined score")
    comparison_matrix: List[List[float]] = Field(..., description="Pairwise similarity between projections")