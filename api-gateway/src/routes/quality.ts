/**
 * Express routes for projection quality metrics
 */
import { Router, Request, Response } from 'express';
import {
  generateCacheKey,
  setCacheCompressed,
  getCacheCompressed,
  CacheKeys,
  cacheExists,
  setCacheMultiple
} from '../redis';
import pythonClient from '../services/pythonClient';

const router = Router();

// Request/Response types
interface QualityErrorsRequest {
  high_dim_points: number[][];
  low_dim_points: number[][];
  robust_scaling?: boolean;
}

interface QualityErrorsResponse {
  cacheKey: string;
  aggregated_errors: number[];
  stats: {
    mean_error: number;
    std_error: number;
    min_error: number;
    max_error: number;
    compression_ratio: number;
    expansion_ratio: number;
  };
  cached: boolean;
}

interface FalseNeighborsViewRequest {
  cacheKey: string;
  low_dim_points: number[][];
  k_neighbors?: number;
}

interface MissingNeighborsSingleRequest {
  cacheKey: string;
  pointIndex: number;
  mode?: 'missing' | 'false';
}

interface GroupAnalysisRequest {
  cacheKey: string;
  groups: number[];
}

interface CompareProjectionsRequest {
  high_dim_points: number[][];
  projections: Record<string, number[][]>;
}

/**
 * POST /api/phylo/quality/errors
 * Compute projection errors with caching
 */
router.post('/errors', async (req: Request, res: Response) => {
  try {
    const {
      high_dim_points,
      low_dim_points,
      robust_scaling = false
    }: QualityErrorsRequest = req.body;

    // Validate input
    if (!high_dim_points || !low_dim_points) {
      return res.status(400).json({
        error: 'Missing required fields: high_dim_points, low_dim_points'
      });
    }

    if (high_dim_points.length !== low_dim_points.length) {
      return res.status(400).json({
        error: 'Point arrays must have same length'
      });
    }

    // Generate cache key
    const cacheKey = generateCacheKey(high_dim_points, low_dim_points, robust_scaling);
    const errorMatrixKey = CacheKeys.ERROR_MATRIX(cacheKey);
    const aggregatedKey = CacheKeys.AGGREGATED(cacheKey);

    // Check cache
    const [cachedErrors, cachedAggregated] = await Promise.all([
      getCacheCompressed(errorMatrixKey),
      getCacheCompressed(aggregatedKey)
    ]);

    if (cachedErrors && cachedAggregated) {
      console.log(`[Cache HIT] Using cached data for key: ${cacheKey}`);

      return res
        .set('X-Cache', 'HIT')
        .json({
          cacheKey,
          aggregated_errors: cachedAggregated,
          stats: cachedErrors.stats,
          cached: true
        } as QualityErrorsResponse);
    }

    console.log(`[Cache MISS] Computing errors for key: ${cacheKey}`);

    // Call Python API
    const errorResponse = await pythonClient.computeProjectionErrors(
      high_dim_points,
      low_dim_points
    );

    // Aggregate errors per point
    let aggregatedErrors = pythonClient.aggregateErrors(errorResponse.errors);

    // Apply robust scaling if requested
    if (robust_scaling) {
      aggregatedErrors = pythonClient.robustScale(aggregatedErrors);
    }

    // Store in cache
    await setCacheMultiple([
      {
        key: errorMatrixKey,
        value: {
          errors: errorResponse.errors,
          stats: errorResponse.stats
        },
        ttl: 24 * 60 * 60 // 24 hours
      },
      {
        key: aggregatedKey,
        value: aggregatedErrors,
        ttl: 24 * 60 * 60
      }
    ]);

    return res
      .set('X-Cache', 'MISS')
      .json({
        cacheKey,
        aggregated_errors: aggregatedErrors,
        stats: errorResponse.stats,
        cached: false
      } as QualityErrorsResponse);

  } catch (error: any) {
    console.error('Error computing projection errors:', error);
    return res.status(500).json({
      error: 'Failed to compute projection errors',
      message: error.message
    });
  }
});

/**
 * POST /api/phylo/quality/false-neighbors-view
 * Get false neighbors visualization data
 */
router.post('/false-neighbors-view', async (req: Request, res: Response) => {
  try {
    const {
      cacheKey,
      low_dim_points,
      k_neighbors = 10
    }: FalseNeighborsViewRequest = req.body;

    // Validate input
    if (!cacheKey || !low_dim_points) {
      return res.status(400).json({
        error: 'Missing required fields: cacheKey, low_dim_points'
      });
    }

    // Check if cache exists
    const errorMatrixKey = CacheKeys.ERROR_MATRIX(cacheKey);
    const errorData = await getCacheCompressed<any>(errorMatrixKey);

    if (!errorData) {
      return res.status(404).json({
        error: 'Cache key not found. Please compute errors first.'
      });
    }

    // Check for cached false neighbors
    const fnKey = CacheKeys.FALSE_NEIGHBORS(cacheKey);
    let falseNeighborsData = await getCacheCompressed(fnKey);

    if (!falseNeighborsData) {
      // Compute from error matrix
      // Note: We need high_dim_points to compute false neighbors properly
      // For now, we'll return a simplified version
      falseNeighborsData = {
        false_neighbors: [],
        delaunay_edges: [],
        metrics: {
          total_false_neighbors: 0,
          false_neighbors_ratio: 0,
          avg_false_per_point: 0,
          n_delaunay_edges: 0
        },
        message: 'Full false neighbors computation requires high_dim_points'
      };

      await setCacheCompressed(fnKey, falseNeighborsData, 60 * 60); // 1 hour cache

      return res
        .set('X-Cache', 'MISS')
        .json({
          cacheKey,
          ...falseNeighborsData
        });
    }

    return res
      .set('X-Cache', 'HIT')
      .json({
        cacheKey,
        ...falseNeighborsData
      });

  } catch (error: any) {
    console.error('Error getting false neighbors view:', error);
    return res.status(500).json({
      error: 'Failed to get false neighbors view',
      message: error.message
    });
  }
});

/**
 * POST /api/phylo/quality/missing-neighbors-single
 * Get missing/false neighbors for a single point
 */
router.post('/missing-neighbors-single', async (req: Request, res: Response) => {
  try {
    const {
      cacheKey,
      pointIndex,
      mode = 'missing'
    }: MissingNeighborsSingleRequest = req.body;

    // Validate input
    if (!cacheKey || pointIndex === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: cacheKey, pointIndex'
      });
    }

    // Get error matrix from cache
    const errorMatrixKey = CacheKeys.ERROR_MATRIX(cacheKey);
    const errorData = await getCacheCompressed<any>(errorMatrixKey);

    if (!errorData || !errorData.errors) {
      return res.status(404).json({
        error: 'Cache key not found. Please compute errors first.'
      });
    }

    const errorMatrix = errorData.errors;

    if (pointIndex < 0 || pointIndex >= errorMatrix.length) {
      return res.status(400).json({
        error: `Invalid point index. Must be between 0 and ${errorMatrix.length - 1}`
      });
    }

    // Get errors for the specific point
    const pointErrors = pythonClient.getPointErrors(errorMatrix, pointIndex);

    // Filter based on mode
    const neighbors = pointErrors.map((error, index) => ({
      index,
      error,
      isMissing: error > 0,  // Positive error = expansion = missing neighbor
      isFalse: error < 0      // Negative error = compression = false neighbor
    }));

    // Sort by absolute error magnitude
    neighbors.sort((a, b) => Math.abs(b.error) - Math.abs(a.error));

    // Filter based on mode
    const filtered = mode === 'missing'
      ? neighbors.filter(n => n.isMissing && n.index !== pointIndex)
      : neighbors.filter(n => n.isFalse && n.index !== pointIndex);

    // This endpoint uses cached error matrix, so set header based on that
    return res
      .set('X-Cache', 'HIT') // Using cached error matrix
      .json({
        cacheKey,
        pointIndex,
        mode,
        neighbors: filtered,
        totalPoints: errorMatrix.length,
        stats: {
          missingCount: neighbors.filter(n => n.isMissing).length,
          falseCount: neighbors.filter(n => n.isFalse).length,
          maxError: Math.max(...pointErrors.map(Math.abs)),
          meanError: pointErrors.reduce((a, b) => a + Math.abs(b), 0) / pointErrors.length
        }
      });

  } catch (error: any) {
    console.error('Error getting missing neighbors:', error);
    return res.status(500).json({
      error: 'Failed to get missing neighbors',
      message: error.message
    });
  }
});

/**
 * POST /api/phylo/quality/group-analysis
 * Analyze projection quality by groups
 */
router.post('/group-analysis', async (req: Request, res: Response) => {
  try {
    const { cacheKey, groups }: GroupAnalysisRequest = req.body;

    if (!cacheKey || !groups) {
      return res.status(400).json({
        error: 'Missing required fields: cacheKey, groups'
      });
    }

    // Check cache for group analysis
    const gaKey = CacheKeys.GROUP_ANALYSIS(`${cacheKey}_${JSON.stringify(groups).substring(0, 8)}`);
    let groupAnalysis = await getCacheCompressed(gaKey);

    if (!groupAnalysis) {
      // For now, return placeholder
      groupAnalysis = {
        message: 'Group analysis requires high_dim_points and low_dim_points',
        groups: [],
        confusion_matrix: [],
        global_metrics: {}
      };

      return res
        .set('X-Cache', 'MISS')
        .json({
          cacheKey,
          ...groupAnalysis
        });
    }

    return res
      .set('X-Cache', 'HIT')
      .json({
        cacheKey,
        ...groupAnalysis
      });

  } catch (error: any) {
    console.error('Error in group analysis:', error);
    return res.status(500).json({
      error: 'Failed to perform group analysis',
      message: error.message
    });
  }
});

/**
 * POST /api/phylo/quality/compare-projections
 * Compare multiple projection methods
 */
router.post('/compare-projections', async (req: Request, res: Response) => {
  try {
    const {
      high_dim_points,
      projections
    }: CompareProjectionsRequest = req.body;

    if (!high_dim_points || !projections) {
      return res.status(400).json({
        error: 'Missing required fields: high_dim_points, projections'
      });
    }

    // Generate cache key for comparison
    const cacheKey = generateCacheKey(
      high_dim_points,
      Object.values(projections).flat(),
      false
    );
    const pcKey = CacheKeys.PROJECTION_COMPARE(cacheKey);

    // Check cache
    let comparisonData = await getCacheCompressed(pcKey);

    if (!comparisonData) {
      // Call Python API
      comparisonData = await pythonClient.compareProjections(
        high_dim_points,
        projections
      );

      // Cache the result
      await setCacheCompressed(pcKey, comparisonData, 12 * 60 * 60); // 12 hours

      return res
        .set('X-Cache', 'MISS')
        .json({
          cacheKey,
          ...comparisonData
        });
    }

    return res
      .set('X-Cache', 'HIT')
      .json({
        cacheKey,
        ...comparisonData
      });

  } catch (error: any) {
    console.error('Error comparing projections:', error);
    return res.status(500).json({
      error: 'Failed to compare projections',
      message: error.message
    });
  }
});

/**
 * GET /api/phylo/quality/cache-stats
 * Get cache statistics
 */
router.get('/cache-stats', async (req: Request, res: Response) => {
  try {
    const { getCacheStats } = await import('../redis');
    const stats = await getCacheStats();

    return res.json({
      ...stats,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error getting cache stats:', error);
    return res.status(500).json({
      error: 'Failed to get cache statistics',
      message: error.message
    });
  }
});

/**
 * DELETE /api/phylo/quality/cache/:cacheKey
 * Clear cache for a specific key
 */
router.delete('/cache/:cacheKey', async (req: Request, res: Response) => {
  try {
    const { cacheKey } = req.params;
    const { deleteCache } = await import('../redis');

    const keys = [
      CacheKeys.ERROR_MATRIX(cacheKey),
      CacheKeys.AGGREGATED(cacheKey),
      CacheKeys.FALSE_NEIGHBORS(cacheKey),
      CacheKeys.MISSING_NEIGHBORS(cacheKey)
    ];

    const deleted = await deleteCache(...keys);

    return res.json({
      cacheKey,
      deleted,
      message: `Deleted ${deleted} cache entries`
    });

  } catch (error: any) {
    console.error('Error clearing cache:', error);
    return res.status(500).json({
      error: 'Failed to clear cache',
      message: error.message
    });
  }
});

export default router;