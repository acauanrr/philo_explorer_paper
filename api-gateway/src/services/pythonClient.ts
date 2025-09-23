/**
 * Python FastAPI client for projection quality metrics
 */
import axios, { AxiosInstance } from 'axios';
import config from '../config';

// Types for Python API requests/responses
export interface ProjectionErrorsRequest {
  D_high: number[][];
  D_low: number[][];
}

export interface ProjectionErrorsResponse {
  errors: number[][];
  stats: {
    mean_error: number;
    std_error: number;
    min_error: number;
    max_error: number;
    median_error: number;
    compression_ratio: number;
    expansion_ratio: number;
    rmse: number;
  };
}

export interface FalseNeighborsRequest {
  D_high: number[][];
  D_low: number[][];
  points_2d: number[][];
  k_neighbors: number;
}

export interface FalseNeighborsResponse {
  false_neighbors: Array<{
    source: number;
    target: number;
    rank_high: number;
    rank_low: number;
    distance_high: number;
    distance_low: number;
    error: number;
  }>;
  delaunay_edges: Array<[number, number]>;
  metrics: {
    total_false_neighbors: number;
    false_neighbors_ratio: number;
    avg_false_per_point: number;
    n_delaunay_edges: number;
  };
}

export interface MissingNeighborsRequest {
  D_high: number[][];
  D_low: number[][];
  k_neighbors: number;
  threshold: number;
}

export interface MissingNeighborsResponse {
  graph: Record<number, number[]>;
  missing_count: Record<number, number>;
  stats: {
    total_missing_neighbors: number;
    missing_neighbors_ratio: number;
    avg_missing_per_point: number;
    max_missing_per_point: number;
    points_with_missing: number;
  };
}

export interface GroupAnalysisRequest {
  D_high: number[][];
  D_low: number[][];
  groups: number[];
}

export interface GroupAnalysisResponse {
  groups: Array<{
    group_id: number;
    size: number;
    intra_group_error: number;
    inter_group_error: number;
    cohesion_high: number;
    cohesion_low: number;
    separation_high: number;
    separation_low: number;
  }>;
  confusion_matrix: number[][];
  global_metrics: {
    silhouette_high: number;
    silhouette_low: number;
    silhouette_preservation: number;
    group_separation_preservation: number;
  };
}

export interface ProjectionCompareRequest {
  D_high: number[][];
  projections: Record<string, number[][]>;
}

export interface ProjectionCompareResponse {
  projections: Array<{
    name: string;
    stress: number;
    trustworthiness: number;
    continuity: number;
    avg_error: number;
    false_neighbors_ratio: number;
    missing_neighbors_ratio: number;
  }>;
  rankings: Record<string, string[]>;
  best_projection: string;
  comparison_matrix: number[][];
}

class PythonClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: config.pythonApi.url,
      timeout: 30000, // 30 seconds timeout
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        console.log(`[PythonClient] ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('[PythonClient] Request error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        console.log(`[PythonClient] Response ${response.status} from ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error('[PythonClient] Response error:', error.message);
        if (error.response) {
          console.error('Response data:', error.response.data);
          console.error('Response status:', error.response.status);
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.data.status === 'ok';
    } catch {
      return false;
    }
  }

  /**
   * Compute distance matrix from points
   */
  private computeDistanceMatrix(points: number[][]): number[][] {
    const n = points.length;
    const matrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let distance = 0;
        for (let k = 0; k < points[i].length; k++) {
          distance += Math.pow(points[i][k] - points[j][k], 2);
        }
        distance = Math.sqrt(distance);
        matrix[i][j] = distance;
        matrix[j][i] = distance;
      }
    }

    return matrix;
  }

  /**
   * Compute projection errors
   */
  async computeProjectionErrors(
    highDimPoints: number[][],
    lowDimPoints: number[][]
  ): Promise<ProjectionErrorsResponse> {
    // Compute distance matrices
    const D_high = this.computeDistanceMatrix(highDimPoints);
    const D_low = this.computeDistanceMatrix(lowDimPoints);

    const request: ProjectionErrorsRequest = { D_high, D_low };
    const response = await this.client.post<ProjectionErrorsResponse>(
      '/api/v1/projection/errors',
      request
    );

    return response.data;
  }

  /**
   * Find false neighbors
   */
  async findFalseNeighbors(
    highDimPoints: number[][],
    lowDimPoints: number[][],
    kNeighbors: number = 10
  ): Promise<FalseNeighborsResponse> {
    // Compute distance matrices
    const D_high = this.computeDistanceMatrix(highDimPoints);
    const D_low = this.computeDistanceMatrix(lowDimPoints);

    // Extract 2D points (assuming lowDimPoints are 2D)
    const points_2d = lowDimPoints;

    const request: FalseNeighborsRequest = {
      D_high,
      D_low,
      points_2d,
      k_neighbors: kNeighbors
    };

    const response = await this.client.post<FalseNeighborsResponse>(
      '/api/v1/projection/false_neighbors',
      request
    );

    return response.data;
  }

  /**
   * Compute missing neighbors
   */
  async computeMissingNeighbors(
    highDimPoints: number[][],
    lowDimPoints: number[][],
    kNeighbors: number = 10,
    threshold: number = 0.5
  ): Promise<MissingNeighborsResponse> {
    const D_high = this.computeDistanceMatrix(highDimPoints);
    const D_low = this.computeDistanceMatrix(lowDimPoints);

    const request: MissingNeighborsRequest = {
      D_high,
      D_low,
      k_neighbors: kNeighbors,
      threshold
    };

    const response = await this.client.post<MissingNeighborsResponse>(
      '/api/v1/projection/missing_neighbors',
      request
    );

    return response.data;
  }

  /**
   * Analyze groups
   */
  async analyzeGroups(
    highDimPoints: number[][],
    lowDimPoints: number[][],
    groups: number[]
  ): Promise<GroupAnalysisResponse> {
    const D_high = this.computeDistanceMatrix(highDimPoints);
    const D_low = this.computeDistanceMatrix(lowDimPoints);

    const request: GroupAnalysisRequest = { D_high, D_low, groups };

    const response = await this.client.post<GroupAnalysisResponse>(
      '/api/v1/projection/group_analysis',
      request
    );

    return response.data;
  }

  /**
   * Compare projections
   */
  async compareProjections(
    highDimPoints: number[][],
    projections: Record<string, number[][]>
  ): Promise<ProjectionCompareResponse> {
    const D_high = this.computeDistanceMatrix(highDimPoints);

    // Convert projection points to distance matrices
    const projectionMatrices: Record<string, number[][]> = {};
    for (const [name, points] of Object.entries(projections)) {
      projectionMatrices[name] = this.computeDistanceMatrix(points);
    }

    const request: ProjectionCompareRequest = {
      D_high,
      projections: projectionMatrices
    };

    const response = await this.client.post<ProjectionCompareResponse>(
      '/api/v1/projection/compare',
      request
    );

    return response.data;
  }

  /**
   * Get raw error matrix for a specific point
   */
  getPointErrors(errorMatrix: number[][], pointIndex: number): number[] {
    if (pointIndex < 0 || pointIndex >= errorMatrix.length) {
      throw new Error('Invalid point index');
    }
    return errorMatrix[pointIndex];
  }

  /**
   * Aggregate errors per point
   */
  aggregateErrors(errorMatrix: number[][]): number[] {
    const n = errorMatrix.length;
    const aggregated: number[] = new Array(n);

    for (let i = 0; i < n; i++) {
      let sum = 0;
      let count = 0;
      for (let j = 0; j < n; j++) {
        if (i !== j) {
          sum += Math.abs(errorMatrix[i][j]);
          count++;
        }
      }
      aggregated[i] = count > 0 ? sum / count : 0;
    }

    return aggregated;
  }

  /**
   * Apply robust scaling to errors
   */
  robustScale(values: number[]): number[] {
    // Calculate quartiles
    const sorted = [...values].sort((a, b) => a - b);
    const q1Index = Math.floor(sorted.length * 0.25);
    const q3Index = Math.floor(sorted.length * 0.75);

    const q1 = sorted[q1Index];
    const q3 = sorted[q3Index];
    const iqr = q3 - q1;

    if (iqr === 0) {
      // If IQR is 0, fall back to min-max scaling
      const min = Math.min(...values);
      const max = Math.max(...values);
      const range = max - min;

      if (range === 0) {
        return values.map(() => 0);
      }

      return values.map(v => (v - min) / range);
    }

    // Robust scaling: (x - median) / IQR
    const medianIndex = Math.floor(sorted.length / 2);
    const median = sorted[medianIndex];

    return values.map(v => {
      const scaled = (v - median) / iqr;
      // Clip to [-3, 3] range (3 IQRs from median)
      return Math.max(-3, Math.min(3, scaled));
    });
  }
}

// Export singleton instance
export const pythonClient = new PythonClient();

export default pythonClient;