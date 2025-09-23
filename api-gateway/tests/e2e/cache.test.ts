/**
 * E2E tests for Redis cache functionality
 * Validates cache key generation, compression, TTL, and HIT/MISS headers
 */
import request from 'supertest';
import express from 'express';
import { createHash } from 'crypto';
import {
  simple2DProjection,
  deterministicProjection,
  alternativeProjection,
  invalidData,
  generateLargeDataset,
  createDeterministicData,
  multipleProjections
} from '../fixtures/testData';
import qualityRouter from '../../src/routes/quality';
import redis from '../../src/redis';

// Test app setup
const app = express();
app.use(express.json({ limit: '50mb' }));
app.use('/api/phylo/quality', qualityRouter);

// Test configuration
const API_ENDPOINT = '/api/phylo/quality/errors';
const CACHE_TTL = 24 * 60 * 60; // 24 hours in seconds

describe('Redis Cache E2E Tests', () => {
  beforeAll(async () => {
    // Check Redis connection
    try {
      await redis.ping();
    } catch (error) {
      console.warn('Redis not available for tests');
    }
  });

  afterAll(async () => {
    // Clean up Redis connection
    if (redis && redis.status === 'ready') {
      await redis.quit();
    }
  });

  beforeEach(async () => {
    // Clear cache before each test
    if (redis && redis.status === 'ready') {
      await redis.flushdb();
    }
  });

  describe('Cache Key Generation', () => {
    it('should generate consistent SHA256-based cache keys', async () => {
      // First request
      const response1 = await request(app)
        .post(API_ENDPOINT)
        .send(deterministicProjection)
        .expect(200);

      expect(response1.body.cacheKey).toBeDefined();
      expect(response1.body.cacheKey).toHaveLength(16); // SHA256 truncated to 16 chars

      // Second request with same data
      const response2 = await request(app)
        .post(API_ENDPOINT)
        .send(deterministicProjection)
        .expect(200);

      // Keys should match
      expect(response2.body.cacheKey).toBe(response1.body.cacheKey);
    });

    it('should generate different keys for different data', async () => {
      const response1 = await request(app)
        .post(API_ENDPOINT)
        .send(deterministicProjection)
        .expect(200);

      const response2 = await request(app)
        .post(API_ENDPOINT)
        .send(alternativeProjection)
        .expect(200);

      expect(response1.body.cacheKey).not.toBe(response2.body.cacheKey);
    });

    it('should include robust_scaling in cache key generation', async () => {
      const response1 = await request(app)
        .post(API_ENDPOINT)
        .send({ ...deterministicProjection, robust_scaling: false })
        .expect(200);

      const response2 = await request(app)
        .post(API_ENDPOINT)
        .send({ ...deterministicProjection, robust_scaling: true })
        .expect(200);

      expect(response1.body.cacheKey).not.toBe(response2.body.cacheKey);
    });
  });

  describe('Cache HIT/MISS Headers', () => {
    it('should return X-Cache: MISS on first request', async () => {
      const response = await request(app)
        .post(API_ENDPOINT)
        .send(simple2DProjection)
        .expect(200);

      expect(response.headers['x-cache']).toBe('MISS');
      expect(response.body.cached).toBe(false);
    });

    it('should return X-Cache: HIT on subsequent requests', async () => {
      // First request - MISS
      const response1 = await request(app)
        .post(API_ENDPOINT)
        .send(simple2DProjection)
        .expect(200);

      expect(response1.headers['x-cache']).toBe('MISS');

      // Second request - HIT
      const response2 = await request(app)
        .post(API_ENDPOINT)
        .send(simple2DProjection)
        .expect(200);

      expect(response2.headers['x-cache']).toBe('HIT');
      expect(response2.body.cached).toBe(true);

      // Data should be identical
      expect(response2.body.aggregated_errors).toEqual(response1.body.aggregated_errors);
      expect(response2.body.stats).toEqual(response1.body.stats);
    });

    it('should handle multiple concurrent requests efficiently', async () => {
      const testData = createDeterministicData();
      const requests = 10;

      // Make concurrent requests
      const responses = await Promise.all(
        Array.from({ length: requests }, () =>
          request(app)
            .post(API_ENDPOINT)
            .send(testData)
        )
      );

      // Count HITs and MISSes
      const hits = responses.filter(r => r.headers['x-cache'] === 'HIT').length;
      const misses = responses.filter(r => r.headers['x-cache'] === 'MISS').length;

      // At least one should be MISS (the first one)
      expect(misses).toBeGreaterThanOrEqual(1);
      // Most should be HITs
      expect(hits).toBeGreaterThanOrEqual(requests - 2);

      // All responses should have the same cache key
      const cacheKeys = responses.map(r => r.body.cacheKey);
      expect(new Set(cacheKeys).size).toBe(1);
    });
  });

  describe('Cache Compression', () => {
    it('should compress and decompress data correctly', async () => {
      const largeData = generateLargeDataset(100);

      // First request
      const response1 = await request(app)
        .post(API_ENDPOINT)
        .send(largeData)
        .expect(200);

      // Second request (from cache)
      const response2 = await request(app)
        .post(API_ENDPOINT)
        .send(largeData)
        .expect(200);

      // Data should be identical after compression/decompression
      expect(response2.body.aggregated_errors).toEqual(response1.body.aggregated_errors);
      expect(response2.body.stats).toEqual(response1.body.stats);
    });

    it('should handle large datasets efficiently', async () => {
      const largeData = generateLargeDataset(500);
      const startTime = Date.now();

      const response = await request(app)
        .post(API_ENDPOINT)
        .send(largeData)
        .expect(200);

      const duration = Date.now() - startTime;

      // Should complete within reasonable time
      expect(duration).toBeLessThan(5000); // 5 seconds max
      expect(response.body.aggregated_errors).toHaveLength(500);
    });
  });

  describe('Cache TTL', () => {
    it('should store data with correct TTL', async () => {
      const response = await request(app)
        .post(API_ENDPOINT)
        .send(simple2DProjection)
        .expect(200);

      const cacheKey = response.body.cacheKey;

      if (redis && redis.status === 'ready') {
        // Check TTL on error matrix key
        const errorKey = `phylo:error_matrix:${cacheKey}`;
        const ttl = await redis.ttl(errorKey);

        // Should be close to 24 hours (allow 1 minute tolerance)
        expect(ttl).toBeGreaterThan(CACHE_TTL - 60);
        expect(ttl).toBeLessThanOrEqual(CACHE_TTL);
      }
    });

    it('should handle expired cache gracefully', async () => {
      // First request
      const response1 = await request(app)
        .post(API_ENDPOINT)
        .send(simple2DProjection)
        .expect(200);

      const cacheKey = response1.body.cacheKey;

      if (redis && redis.status === 'ready') {
        // Manually expire the cache
        const errorKey = `phylo:error_matrix:${cacheKey}`;
        const aggregatedKey = `phylo:aggregated:${cacheKey}`;
        await redis.del(errorKey, aggregatedKey);
      }

      // Second request should recompute
      const response2 = await request(app)
        .post(API_ENDPOINT)
        .send(simple2DProjection)
        .expect(200);

      expect(response2.headers['x-cache']).toBe('MISS');
      expect(response2.body.cached).toBe(false);
    });
  });

  describe('Dependent Endpoints', () => {
    it('should use cached error matrix for missing-neighbors-single', async () => {
      // First compute errors
      const errorResponse = await request(app)
        .post(API_ENDPOINT)
        .send(simple2DProjection)
        .expect(200);

      const cacheKey = errorResponse.body.cacheKey;

      // Then query missing neighbors
      const neighborsResponse = await request(app)
        .post('/api/phylo/quality/missing-neighbors-single')
        .send({
          cacheKey,
          pointIndex: 0,
          mode: 'missing'
        })
        .expect(200);

      // Should use cached data
      expect(neighborsResponse.headers['x-cache']).toBe('HIT');
      expect(neighborsResponse.body.pointIndex).toBe(0);
      expect(neighborsResponse.body.neighbors).toBeDefined();
    });

    it('should return 404 when cache key not found', async () => {
      const response = await request(app)
        .post('/api/phylo/quality/missing-neighbors-single')
        .send({
          cacheKey: 'non-existent-key',
          pointIndex: 0
        })
        .expect(404);

      expect(response.body.error).toContain('Cache key not found');
    });
  });

  describe('Cache Statistics', () => {
    it('should provide cache statistics', async () => {
      // Generate some cache activity
      await request(app).post(API_ENDPOINT).send(simple2DProjection);
      await request(app).post(API_ENDPOINT).send(simple2DProjection); // HIT
      await request(app).post(API_ENDPOINT).send(alternativeProjection);

      // Get stats
      const statsResponse = await request(app)
        .get('/api/phylo/quality/cache-stats')
        .expect(200);

      expect(statsResponse.body).toHaveProperty('timestamp');
      // Stats structure depends on implementation
    });

    it('should delete cache entries', async () => {
      // Create cache entry
      const response = await request(app)
        .post(API_ENDPOINT)
        .send(simple2DProjection)
        .expect(200);

      const cacheKey = response.body.cacheKey;

      // Delete cache
      const deleteResponse = await request(app)
        .delete(`/api/phylo/quality/cache/${cacheKey}`)
        .expect(200);

      expect(deleteResponse.body.deleted).toBeGreaterThan(0);

      // Verify deletion - next request should be MISS
      const response2 = await request(app)
        .post(API_ENDPOINT)
        .send(simple2DProjection)
        .expect(200);

      expect(response2.headers['x-cache']).toBe('MISS');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid input gracefully', async () => {
      const response = await request(app)
        .post(API_ENDPOINT)
        .send(invalidData.mismatchedLengths)
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should handle missing fields', async () => {
      const response = await request(app)
        .post(API_ENDPOINT)
        .send(invalidData.missingFields)
        .expect(400);

      expect(response.body.error).toContain('Missing required fields');
    });
  });

  describe('Comparison Endpoint Caching', () => {
    it('should cache projection comparisons', async () => {
      // First request - MISS
      const response1 = await request(app)
        .post('/api/phylo/quality/compare-projections')
        .send(multipleProjections)
        .expect(200);

      expect(response1.headers['x-cache']).toBe('MISS');

      // Second request - HIT
      const response2 = await request(app)
        .post('/api/phylo/quality/compare-projections')
        .send(multipleProjections)
        .expect(200);

      expect(response2.headers['x-cache']).toBe('HIT');
      expect(response2.body.cacheKey).toBe(response1.body.cacheKey);
    });
  });

  describe('Performance Tests', () => {
    it('should handle cache operations within performance requirements', async () => {
      const testData = generateLargeDataset(1000);
      const iterations = 5;
      const timings = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();

        const response = await request(app)
          .post(API_ENDPOINT)
          .send(testData)
          .expect(200);

        const duration = Date.now() - startTime;
        timings.push({
          iteration: i,
          duration,
          cacheHit: response.headers['x-cache'] === 'HIT'
        });
      }

      // First request should be slower (MISS)
      expect(timings[0].cacheHit).toBe(false);

      // Subsequent requests should be faster (HITs)
      const hitTimings = timings.filter(t => t.cacheHit);
      const avgHitTime = hitTimings.reduce((sum, t) => sum + t.duration, 0) / hitTimings.length;

      // Cache hits should be much faster
      expect(avgHitTime).toBeLessThan(timings[0].duration * 0.1); // At least 10x faster
    });
  });
});