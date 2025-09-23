/**
 * Tests for Redis unavailability and graceful degradation scenarios
 */
import request from 'supertest';
import express from 'express';
import { simple2DProjection, deterministicProjection } from '../fixtures/testData';
import qualityRouter from '../../src/routes/quality';
import redis from '../../src/redis';

// Test app setup
const app = express();
app.use(express.json({ limit: '50mb' }));
app.use('/api/phylo/quality', qualityRouter);

const API_ENDPOINT = '/api/phylo/quality/errors';

describe('Redis Failover and TTL Tests', () => {
  let originalRedisClient: any;

  beforeAll(async () => {
    // Store original Redis client
    originalRedisClient = redis;
  });

  afterAll(async () => {
    // Restore Redis connection
    if (originalRedisClient && originalRedisClient.isOpen) {
      await originalRedisClient.quit();
    }
  });

  describe('Redis Unavailable Scenarios', () => {
    it('should continue working when Redis is unavailable', async () => {
      // Simulate Redis being unavailable by closing connection
      if (redis && redis.status === 'ready') {
        await redis.quit();
      }

      // Should still process requests without caching
      const response = await request(app)
        .post(API_ENDPOINT)
        .send(simple2DProjection)
        .expect(200);

      // Should indicate MISS since cache is unavailable
      expect(response.headers['x-cache']).toBe('MISS');
      expect(response.body.aggregated_errors).toBeDefined();
      expect(response.body.stats).toBeDefined();

      // Restore connection for other tests
      try {
        await redis.connect();
      } catch (error) {
        console.warn('Could not reconnect to Redis');
      }
    });

    it('should handle Redis connection errors gracefully', async () => {
      // Mock Redis methods to throw errors
      const mockRedis = {
        get: jest.fn().mockRejectedValue(new Error('Redis connection lost')),
        set: jest.fn().mockRejectedValue(new Error('Redis connection lost')),
        ttl: jest.fn().mockRejectedValue(new Error('Redis connection lost')),
        del: jest.fn().mockRejectedValue(new Error('Redis connection lost')),
        flushdb: jest.fn().mockRejectedValue(new Error('Redis connection lost')),
        quit: jest.fn().mockResolvedValue(undefined),
        isOpen: false
      };

      // Replace Redis client
      (global as any).redis = mockRedis;

      // Should still work without cache
      const response = await request(app)
        .post(API_ENDPOINT)
        .send(deterministicProjection)
        .expect(200);

      expect(response.body.aggregated_errors).toBeDefined();
      expect(response.body.stats).toBeDefined();
      expect(response.headers['x-cache']).toBe('MISS');

      // Restore original client
      (global as any).redis = originalRedisClient;
    });

    it('should recover when Redis becomes available again', async () => {
      // Start with Redis unavailable
      if (redis && redis.status === 'ready') {
        await redis.quit();
      }

      // First request without Redis
      const response1 = await request(app)
        .post(API_ENDPOINT)
        .send(simple2DProjection)
        .expect(200);

      expect(response1.headers['x-cache']).toBe('MISS');

      // Restore Redis connection
      try {
        await redis.connect();
      } catch (error) {
        console.warn('Could not reconnect to Redis');
      }

      // Clear any existing cache
      if (redis && redis.status === 'ready') {
        await redis.flushdb();
      }

      // Second request with Redis available
      const response2 = await request(app)
        .post(API_ENDPOINT)
        .send(simple2DProjection)
        .expect(200);

      expect(response2.headers['x-cache']).toBe('MISS'); // First with cache

      // Third request should be cached
      const response3 = await request(app)
        .post(API_ENDPOINT)
        .send(simple2DProjection)
        .expect(200);

      expect(response3.headers['x-cache']).toBe('HIT');
    });
  });

  describe('TTL Expiration Tests', () => {
    beforeEach(async () => {
      // Ensure Redis is connected and clear cache
      if (redis && redis.status === 'ready') {
        await redis.flushdb();
      }
    });

    it('should set correct TTL on cache entries', async () => {
      const response = await request(app)
        .post(API_ENDPOINT)
        .send(deterministicProjection)
        .expect(200);

      const cacheKey = response.body.cacheKey;

      if (redis && redis.status === 'ready') {
        // Check TTL on both keys
        const errorKey = `phylo:error_matrix:${cacheKey}`;
        const aggregatedKey = `phylo:aggregated:${cacheKey}`;

        const errorTTL = await redis.ttl(errorKey);
        const aggregatedTTL = await redis.ttl(aggregatedKey);

        // Both should have 24-hour TTL (86400 seconds)
        expect(errorTTL).toBeGreaterThan(86300); // Allow 100 second tolerance
        expect(errorTTL).toBeLessThanOrEqual(86400);

        expect(aggregatedTTL).toBeGreaterThan(86300);
        expect(aggregatedTTL).toBeLessThanOrEqual(86400);
      }
    });

    it('should handle partial cache expiration', async () => {
      // Create cache entry
      const response1 = await request(app)
        .post(API_ENDPOINT)
        .send(simple2DProjection)
        .expect(200);

      const cacheKey = response1.body.cacheKey;

      if (redis && redis.status === 'ready') {
        // Manually delete only one part of the cache
        const aggregatedKey = `phylo:aggregated:${cacheKey}`;
        await redis.del(aggregatedKey);

        // Next request should recompute since cache is incomplete
        const response2 = await request(app)
          .post(API_ENDPOINT)
          .send(simple2DProjection)
          .expect(200);

        expect(response2.headers['x-cache']).toBe('MISS');
        expect(response2.body.cacheKey).toBe(cacheKey);
      }
    });

    it('should handle TTL refresh on access', async () => {
      // Initial request
      const response1 = await request(app)
        .post(API_ENDPOINT)
        .send(deterministicProjection)
        .expect(200);

      const cacheKey = response1.body.cacheKey;

      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Access cache (HIT)
      const response2 = await request(app)
        .post(API_ENDPOINT)
        .send(deterministicProjection)
        .expect(200);

      expect(response2.headers['x-cache']).toBe('HIT');

      if (redis && redis.status === 'ready') {
        // TTL should still be close to original (not refreshed on read)
        const errorKey = `phylo:error_matrix:${cacheKey}`;
        const ttl = await redis.ttl(errorKey);

        // Should be slightly less than original due to time passed
        expect(ttl).toBeGreaterThan(86200);
        expect(ttl).toBeLessThan(86400);
      }
    });
  });

  describe('Cache Key Collision Tests', () => {
    it('should handle hash collisions properly', async () => {
      // These are different datasets that should not collide
      const datasets = Array.from({ length: 10 }, (_, i) => ({
        high_dim_points: [[i, i+1], [i+2, i+3]],
        low_dim_points: [[i*2, i*2+1], [i*2+2, i*2+3]]
      }));

      const cacheKeys = new Set<string>();

      for (const data of datasets) {
        const response = await request(app)
          .post(API_ENDPOINT)
          .send(data)
          .expect(200);

        cacheKeys.add(response.body.cacheKey);
      }

      // All cache keys should be unique
      expect(cacheKeys.size).toBe(datasets.length);
    });
  });

  describe('Memory and Performance Under Load', () => {
    it('should handle many cached entries efficiently', async () => {
      const numEntries = 50;
      const cacheKeys = new Set<string>();
      const timings = [];

      for (let i = 0; i < numEntries; i++) {
        const data = {
          high_dim_points: [[i, i+1, i+2]],
          low_dim_points: [[i*2, i*2+1]]
        };

        const startTime = Date.now();
        const response = await request(app)
          .post(API_ENDPOINT)
          .send(data)
          .expect(200);

        timings.push(Date.now() - startTime);
        cacheKeys.add(response.body.cacheKey);
      }

      // All entries should be cached
      expect(cacheKeys.size).toBe(numEntries);

      // Performance should remain consistent
      const avgTime = timings.reduce((a, b) => a + b, 0) / timings.length;
      const maxTime = Math.max(...timings);

      // No single request should take much longer than average
      expect(maxTime).toBeLessThan(avgTime * 3);
    });

    it('should handle cache eviction gracefully', async () => {
      // This test would require configuring Redis with maxmemory-policy
      // For now, we just verify the system continues to work

      const largeData = {
        high_dim_points: Array.from({ length: 1000 }, () =>
          Array.from({ length: 10 }, () => Math.random())
        ),
        low_dim_points: Array.from({ length: 1000 }, () =>
          Array.from({ length: 2 }, () => Math.random())
        )
      };

      // Should handle large data
      const response = await request(app)
        .post(API_ENDPOINT)
        .send(largeData)
        .expect(200);

      expect(response.body.aggregated_errors).toHaveLength(1000);
    });
  });

  describe('Concurrent Access Tests', () => {
    it('should handle race conditions properly', async () => {
      const testData = deterministicProjection;
      const numRequests = 20;

      // Clear cache
      if (redis && redis.status === 'ready') {
        await redis.flushdb();
      }

      // Make many concurrent requests for the same data
      const responses = await Promise.all(
        Array.from({ length: numRequests }, () =>
          request(app)
            .post(API_ENDPOINT)
            .send(testData)
        )
      );

      // All should succeed
      responses.forEach(r => expect(r.status).toBe(200));

      // All should have the same cache key
      const cacheKeys = responses.map(r => r.body.cacheKey);
      expect(new Set(cacheKeys).size).toBe(1);

      // All should have the same data
      const firstData = responses[0].body.aggregated_errors;
      responses.forEach(r => {
        expect(r.body.aggregated_errors).toEqual(firstData);
      });

      // Count cache hits/misses
      const hits = responses.filter(r => r.headers['x-cache'] === 'HIT').length;
      const misses = responses.filter(r => r.headers['x-cache'] === 'MISS').length;

      // Should have at least one MISS and many HITs
      expect(misses).toBeGreaterThanOrEqual(1);
      expect(hits).toBeGreaterThan(numRequests / 2);
    });
  });
});