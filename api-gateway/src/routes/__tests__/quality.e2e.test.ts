/**
 * E2E Tests for Quality API endpoints
 */

import request from 'supertest';
import express from 'express';
import Redis from 'ioredis';
import { Router } from 'express';
import pythonClient from '../../services/pythonClient';

// Mock Redis
jest.mock('ioredis', () => {
  const mRedis = {
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    on: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
  };
  return {
    __esModule: true,
    default: jest.fn(() => mRedis),
  };
});

// Mock Python client
jest.mock('../../services/pythonClient', () => ({
  __esModule: true,
  default: {
    missingNeighborsGraph: jest.fn(),
    projectionCompare: jest.fn(),
  },
}));

// Mock cache utilities
jest.mock('../../utils/cache', () => ({
  getCacheCompressed: jest.fn(),
  setCacheCompressed: jest.fn(),
  generateCacheKey: jest.fn((data) => 'test-cache-key'),
}));

// Import after mocks
import qualityRouter from '../quality';
import { getCacheCompressed, setCacheCompressed } from '../../utils/cache';

describe('Quality API Endpoints - E2E Tests', () => {
  let app: express.Application;
  let redisClient: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup Express app
    app = express();
    app.use(express.json());
    app.use('/api/phylo/quality', qualityRouter);

    // Get Redis mock instance
    redisClient = new (Redis as any)();
  });

  // ============================================================================
  // TEST: missing-neighbors-graph endpoint with cache HIT/MISS
  // ============================================================================
  describe('POST /api/phylo/quality/missing-neighbors-graph', () => {
    const validRequest = {
      cacheKey: 'test-cache-key',
      phi: 0.05
    };

    const mockErrorMatrix = [
      [0, 0.5, 0.8],
      [0.5, 0, 0.3],
      [0.8, 0.3, 0]
    ];

    const mockGraphResponse = {
      data: {
        graph: {
          edges: [
            { source: 0, target: 1, error: 0.5 },
            { source: 1, target: 2, error: 0.3 },
          ],
          stats: { max: 0.8, min: 0.3, count: 2 }
        }
      }
    };

    it('returns X-Cache: HIT when data is cached', async () => {
      // Setup cache hit
      (getCacheCompressed as jest.Mock)
        .mockResolvedValueOnce(mockErrorMatrix) // Error matrix cached
        .mockResolvedValueOnce(mockGraphResponse.data); // Graph cached

      const response = await request(app)
        .post('/api/phylo/quality/missing-neighbors-graph')
        .send(validRequest);

      expect(response.status).toBe(200);
      expect(response.headers['x-cache']).toBe('HIT');
      expect(response.body).toEqual(mockGraphResponse.data);

      // Should not call Python API
      expect(pythonClient.missingNeighborsGraph).not.toHaveBeenCalled();
    });

    it('returns X-Cache: MISS when data is not cached', async () => {
      // Setup cache miss
      (getCacheCompressed as jest.Mock)
        .mockResolvedValueOnce(mockErrorMatrix) // Error matrix exists
        .mockResolvedValueOnce(null); // Graph not cached

      // Mock Python API response
      (pythonClient.missingNeighborsGraph as jest.Mock)
        .mockResolvedValueOnce(mockGraphResponse);

      const response = await request(app)
        .post('/api/phylo/quality/missing-neighbors-graph')
        .send(validRequest);

      expect(response.status).toBe(200);
      expect(response.headers['x-cache']).toBe('MISS');
      expect(response.body).toEqual(mockGraphResponse.data);

      // Should call Python API
      expect(pythonClient.missingNeighborsGraph).toHaveBeenCalledWith(
        mockErrorMatrix,
        0.05
      );

      // Should cache the result
      expect(setCacheCompressed).toHaveBeenCalledWith(
        'test-cache-key:missing_neighbors:0.05',
        mockGraphResponse.data,
        3600
      );
    });

    it('handles Redis unavailable with BYPASS header', async () => {
      // Simulate Redis error
      (getCacheCompressed as jest.Mock)
        .mockRejectedValueOnce(new Error('Redis connection failed'))
        .mockRejectedValueOnce(new Error('Redis connection failed'));

      // Mock Python API response
      (pythonClient.missingNeighborsGraph as jest.Mock)
        .mockResolvedValueOnce(mockGraphResponse);

      // Need to provide error matrix through request when cache fails
      const requestWithMatrix = {
        ...validRequest,
        errorMatrix: mockErrorMatrix
      };

      const response = await request(app)
        .post('/api/phylo/quality/missing-neighbors-graph')
        .send(requestWithMatrix);

      expect(response.status).toBe(200);
      expect(response.headers['x-cache']).toBe('BYPASS');
      expect(response.body).toEqual(mockGraphResponse.data);

      // Should still serve response
      expect(pythonClient.missingNeighborsGraph).toHaveBeenCalled();
    });

    it('validates required parameters', async () => {
      const response = await request(app)
        .post('/api/phylo/quality/missing-neighbors-graph')
        .send({ cacheKey: 'test' }); // Missing phi

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('handles phi out of range', async () => {
      const invalidRequest = {
        cacheKey: 'test-cache-key',
        phi: 1.5 // Out of [0, 1] range
      };

      const response = await request(app)
        .post('/api/phylo/quality/missing-neighbors-graph')
        .send(invalidRequest);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('phi must be between 0 and 1');
    });
  });

  // ============================================================================
  // TEST: projection-compare endpoint with cache HIT/MISS
  // ============================================================================
  describe('POST /api/phylo/quality/projection-compare', () => {
    const validRequest = {
      cacheKey: 'test-cache-key',
      projectionMethod: 'umap'
    };

    const mockProjectionA = [
      [0, 0],
      [1, 1],
      [2, 2]
    ];

    const mockProjectionB = [
      [0.1, 0.1],
      [1.1, 1.1],
      [2.1, 2.1]
    ];

    const mockCompareResponse = {
      data: {
        displacementErrors: [0.14, 0.14, 0.14],
        projectionB: mockProjectionB,
        edges: [
          { source: 0, target: 0, error: 0.14 },
          { source: 1, target: 1, error: 0.14 },
          { source: 2, target: 2, error: 0.14 }
        ],
        stats: {
          avgDisplacement: 0.14,
          maxDisplacement: 0.14,
          minDisplacement: 0.14,
          correlation: 0.98
        }
      }
    };

    it('returns X-Cache: HIT when comparison is cached', async () => {
      // Setup cache hit
      (getCacheCompressed as jest.Mock)
        .mockResolvedValueOnce(mockProjectionA) // Current projection cached
        .mockResolvedValueOnce(mockCompareResponse.data); // Comparison cached

      const response = await request(app)
        .post('/api/phylo/quality/projection-compare')
        .send(validRequest);

      expect(response.status).toBe(200);
      expect(response.headers['x-cache']).toBe('HIT');
      expect(response.body).toEqual(mockCompareResponse.data);

      // Should not call Python API
      expect(pythonClient.projectionCompare).not.toHaveBeenCalled();
    });

    it('returns X-Cache: MISS and computes comparison', async () => {
      // Setup cache miss
      (getCacheCompressed as jest.Mock)
        .mockResolvedValueOnce(mockProjectionA) // Current projection
        .mockResolvedValueOnce(null); // Comparison not cached

      // Mock Python API response
      (pythonClient.projectionCompare as jest.Mock)
        .mockResolvedValueOnce(mockCompareResponse);

      const response = await request(app)
        .post('/api/phylo/quality/projection-compare')
        .send(validRequest);

      expect(response.status).toBe(200);
      expect(response.headers['x-cache']).toBe('MISS');

      // Should call Python API
      expect(pythonClient.projectionCompare).toHaveBeenCalledWith(
        mockProjectionA,
        expect.any(Array) // Generated projection B
      );

      // Should cache the result
      expect(setCacheCompressed).toHaveBeenCalledWith(
        'test-cache-key:compare:umap',
        expect.any(Object),
        3600
      );
    });

    it('handles Redis unavailable with BYPASS', async () => {
      // Simulate Redis error
      (getCacheCompressed as jest.Mock)
        .mockRejectedValueOnce(new Error('Redis down'))
        .mockRejectedValueOnce(new Error('Redis down'));

      // Mock Python API
      (pythonClient.projectionCompare as jest.Mock)
        .mockResolvedValueOnce(mockCompareResponse);

      // Provide projection in request
      const requestWithProjection = {
        ...validRequest,
        projectionA: mockProjectionA
      };

      const response = await request(app)
        .post('/api/phylo/quality/projection-compare')
        .send(requestWithProjection);

      expect(response.status).toBe(200);
      expect(response.headers['x-cache']).toBe('BYPASS');

      // Should still work without cache
      expect(pythonClient.projectionCompare).toHaveBeenCalled();
    });

    it('validates projection method', async () => {
      const invalidRequest = {
        cacheKey: 'test-cache-key',
        projectionMethod: 'invalid-method'
      };

      const response = await request(app)
        .post('/api/phylo/quality/projection-compare')
        .send(invalidRequest);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid projection method');
    });

    it('supports all projection methods', async () => {
      const methods = ['tsne', 'umap', 'pca', 'mds'];

      for (const method of methods) {
        (getCacheCompressed as jest.Mock)
          .mockResolvedValueOnce(mockProjectionA)
          .mockResolvedValueOnce(mockCompareResponse.data);

        const response = await request(app)
          .post('/api/phylo/quality/projection-compare')
          .send({ cacheKey: 'test-cache-key', projectionMethod: method });

        expect(response.status).toBe(200);
      }
    });
  });

  // ============================================================================
  // TEST: Error handling and resilience
  // ============================================================================
  describe('Error handling', () => {
    it('handles Python API errors gracefully', async () => {
      (getCacheCompressed as jest.Mock)
        .mockResolvedValueOnce([[0, 1], [1, 0]])
        .mockResolvedValueOnce(null);

      (pythonClient.missingNeighborsGraph as jest.Mock)
        .mockRejectedValueOnce(new Error('Python service unavailable'));

      const response = await request(app)
        .post('/api/phylo/quality/missing-neighbors-graph')
        .send({ cacheKey: 'test-cache-key', phi: 0.05 });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Failed to compute');
    });

    it('handles malformed cache data', async () => {
      // Return invalid cached data
      (getCacheCompressed as jest.Mock)
        .mockResolvedValueOnce('invalid-data-format')
        .mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/phylo/quality/missing-neighbors-graph')
        .send({ cacheKey: 'test-cache-key', phi: 0.05 });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });

    it('continues serving with cache write failures', async () => {
      (getCacheCompressed as jest.Mock)
        .mockResolvedValueOnce([[0, 1], [1, 0]])
        .mockResolvedValueOnce(null);

      (pythonClient.missingNeighborsGraph as jest.Mock)
        .mockResolvedValueOnce({
          data: { graph: { edges: [], stats: {} } }
        });

      // Simulate cache write failure
      (setCacheCompressed as jest.Mock)
        .mockRejectedValueOnce(new Error('Cache write failed'));

      const response = await request(app)
        .post('/api/phylo/quality/missing-neighbors-graph')
        .send({ cacheKey: 'test-cache-key', phi: 0.05 });

      // Should still return success despite cache write failure
      expect(response.status).toBe(200);
      expect(response.headers['x-cache']).toBe('MISS');
    });
  });

  // ============================================================================
  // TEST: Performance and caching behavior
  // ============================================================================
  describe('Caching behavior', () => {
    it('caches with appropriate TTL', async () => {
      (getCacheCompressed as jest.Mock)
        .mockResolvedValueOnce([[0, 1], [1, 0]])
        .mockResolvedValueOnce(null);

      (pythonClient.missingNeighborsGraph as jest.Mock)
        .mockResolvedValueOnce({ data: { graph: {} } });

      await request(app)
        .post('/api/phylo/quality/missing-neighbors-graph')
        .send({ cacheKey: 'test-cache-key', phi: 0.05 });

      // Check cache was set with 1 hour TTL
      expect(setCacheCompressed).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        3600 // 1 hour in seconds
      );
    });

    it('uses different cache keys for different phi values', async () => {
      const phi1 = 0.05;
      const phi2 = 0.10;

      (getCacheCompressed as jest.Mock).mockResolvedValue(null);
      (pythonClient.missingNeighborsGraph as jest.Mock)
        .mockResolvedValue({ data: {} });

      await request(app)
        .post('/api/phylo/quality/missing-neighbors-graph')
        .send({ cacheKey: 'test-cache-key', phi: phi1 });

      await request(app)
        .post('/api/phylo/quality/missing-neighbors-graph')
        .send({ cacheKey: 'test-cache-key', phi: phi2 });

      // Should use different cache keys
      expect(setCacheCompressed).toHaveBeenCalledWith(
        'test-cache-key:missing_neighbors:0.05',
        expect.any(Object),
        expect.any(Number)
      );

      expect(setCacheCompressed).toHaveBeenCalledWith(
        'test-cache-key:missing_neighbors:0.1',
        expect.any(Object),
        expect.any(Number)
      );
    });
  });
});