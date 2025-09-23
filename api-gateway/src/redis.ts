/**
 * Mock Redis implementation that works without external Redis server
 * Uses in-memory storage with TTL support
 */
import { createHash } from 'crypto';
import { gzipSync, gunzipSync } from 'zlib';

interface CacheEntry {
  data: string;
  expiresAt: number;
}

class MockRedis {
  private store: Map<string, CacheEntry> = new Map();

  // Connection simulation
  on(event: string, callback: Function) {
    if (event === 'connect') {
      setTimeout(() => callback(), 100);
    }
  }

  // Basic operations
  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);

    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.data;
  }

  async setex(key: string, ttl: number, value: string): Promise<void> {
    const expiresAt = Date.now() + (ttl * 1000);
    this.store.set(key, { data: value, expiresAt });
  }

  async exists(key: string): Promise<number> {
    const entry = this.store.get(key);

    if (!entry) return 0;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return 0;
    }

    return 1;
  }

  async del(...keys: string[]): Promise<number> {
    let deleted = 0;
    for (const key of keys) {
      if (this.store.delete(key)) {
        deleted++;
      }
    }
    return deleted;
  }

  async ttl(key: string): Promise<number> {
    const entry = this.store.get(key);

    if (!entry) return -2; // Key doesn't exist

    const remaining = Math.floor((entry.expiresAt - Date.now()) / 1000);

    if (remaining <= 0) {
      this.store.delete(key);
      return -2;
    }

    return remaining;
  }

  async expire(key: string, ttl: number): Promise<number> {
    const entry = this.store.get(key);

    if (!entry) return 0;

    entry.expiresAt = Date.now() + (ttl * 1000);
    return 1;
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(pattern.replace('*', '.*'));
    const matchingKeys: string[] = [];

    for (const [key, entry] of this.store.entries()) {
      // Check if key is expired
      if (Date.now() > entry.expiresAt) {
        this.store.delete(key);
        continue;
      }

      if (regex.test(key)) {
        matchingKeys.push(key);
      }
    }

    return matchingKeys;
  }

  async info(section: string): Promise<string> {
    if (section === 'memory') {
      const memoryUsage = process.memoryUsage();
      return `used_memory_human:${Math.round(memoryUsage.heapUsed / 1024 / 1024)}M`;
    }
    return '';
  }

  // Pipeline simulation (simplified)
  pipeline() {
    const operations: Array<() => Promise<any>> = [];

    return {
      setex: (key: string, ttl: number, value: string) => {
        operations.push(() => this.setex(key, ttl, value));
        return this;
      },
      exec: async () => {
        const results = [];
        for (const op of operations) {
          try {
            const result = await op();
            results.push([null, result]);
          } catch (error) {
            results.push([error, null]);
          }
        }
        return results;
      }
    };
  }

  // Cleanup expired entries
  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  // Start cleanup interval
  startCleanup() {
    setInterval(() => this.cleanup(), 60000); // Cleanup every minute
  }
}

// Create Redis client (mock or real based on environment)
const isRedisDisabled = process.env.DISABLE_REDIS === 'true' || process.env.NODE_ENV === 'test';

export const redis = isRedisDisabled ? new MockRedis() : (() => {
  try {
    // Try to use real Redis if available
    const Redis = require('ioredis');
    const config = require('./config').default;

    const client = new Redis({
      host: config.redis?.host || 'localhost',
      port: config.redis?.port || 6379,
      db: config.redis?.db || 0,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      lazyConnect: true // Don't connect immediately
    });

    // Fallback to mock if connection fails
    client.on('error', (err: any) => {
      console.warn('Redis connection failed, falling back to in-memory cache:', err.message);
    });

    return client;
  } catch (error) {
    console.warn('Redis not available, using in-memory cache');
    return new MockRedis();
  }
})();

// Start cleanup if using mock
if (redis instanceof MockRedis) {
  redis.startCleanup();
  console.log('🔄 Using in-memory cache (Redis mock)');
}

// Cache TTL constants
const DEFAULT_TTL = 24 * 60 * 60; // 24 hours
const SHORT_TTL = 5 * 60; // 5 minutes for temporary data

/**
 * Generate cache key from input parameters
 */
export function generateCacheKey(
  highDimPoints: number[][],
  lowDimPoints: number[][],
  robustScaling: boolean = false
): string {
  const input = JSON.stringify({
    high: highDimPoints,
    low: lowDimPoints,
    robust: robustScaling
  });

  return createHash('sha256')
    .update(input)
    .digest('hex')
    .substring(0, 16); // Use first 16 chars for shorter keys
}

/**
 * Store compressed JSON data in Redis/Mock
 */
export async function setCacheCompressed(
  key: string,
  data: any,
  ttl: number = DEFAULT_TTL
): Promise<void> {
  try {
    // Stringify and compress the data
    const json = JSON.stringify(data);
    const compressed = gzipSync(json);

    // Store as base64 encoded string
    await redis.setex(key, ttl, compressed.toString('base64'));
  } catch (error) {
    console.error(`Failed to set cache for key ${key}:`, error);
    // Don't throw error, just log it
  }
}

/**
 * Retrieve and decompress JSON data from Redis/Mock
 */
export async function getCacheCompressed<T = any>(key: string): Promise<T | null> {
  try {
    const compressed = await redis.get(key);

    if (!compressed) {
      return null;
    }

    // Decompress and parse
    const buffer = Buffer.from(compressed, 'base64');
    const json = gunzipSync(buffer).toString();
    return JSON.parse(json);
  } catch (error) {
    console.error(`Failed to get cache for key ${key}:`, error);
    return null;
  }
}

/**
 * Store multiple cache entries in a transaction
 */
export async function setCacheMultiple(
  entries: Array<{ key: string; value: any; ttl?: number }>
): Promise<void> {
  const pipeline = redis.pipeline();

  for (const entry of entries) {
    const json = JSON.stringify(entry.value);
    const compressed = gzipSync(json);
    pipeline.setex(
      entry.key,
      entry.ttl || DEFAULT_TTL,
      compressed.toString('base64')
    );
  }

  await pipeline.exec();
}

/**
 * Check if cache key exists
 */
export async function cacheExists(key: string): Promise<boolean> {
  const exists = await redis.exists(key);
  return exists === 1;
}

/**
 * Delete cache entries
 */
export async function deleteCache(...keys: string[]): Promise<number> {
  if (keys.length === 0) return 0;
  return await redis.del(...keys);
}

/**
 * Get remaining TTL for a key
 */
export async function getTTL(key: string): Promise<number> {
  return await redis.ttl(key);
}

/**
 * Extend TTL for a key
 */
export async function extendTTL(key: string, ttl: number = DEFAULT_TTL): Promise<boolean> {
  const result = await redis.expire(key, ttl);
  return result === 1;
}

/**
 * Cache key prefixes
 */
export const CacheKeys = {
  ERROR_MATRIX: (cacheKey: string) => `eij:${cacheKey}`,
  AGGREGATED: (cacheKey: string) => `agg:${cacheKey}`,
  FALSE_NEIGHBORS: (cacheKey: string) => `fn:${cacheKey}`,
  MISSING_NEIGHBORS: (cacheKey: string) => `mn:${cacheKey}`,
  GROUP_ANALYSIS: (cacheKey: string) => `ga:${cacheKey}`,
  PROJECTION_COMPARE: (cacheKey: string) => `pc:${cacheKey}`
} as const;

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  totalKeys: number;
  memoryUsage: string;
  patterns: Record<string, number>;
}> {
  try {
    const info = await redis.info('memory');
    const memoryLine = info.split('\n').find(line => line.startsWith('used_memory_human'));
    const memoryUsage = memoryLine ? memoryLine.split(':')[1].trim() : 'unknown';

    // Count keys by pattern
    const patterns: Record<string, number> = {};
    const prefixes = ['eij:', 'agg:', 'fn:', 'mn:', 'ga:', 'pc:'];

    for (const prefix of prefixes) {
      const keys = await redis.keys(`${prefix}*`);
      patterns[prefix] = keys.length;
    }

    const totalKeys = Object.values(patterns).reduce((a, b) => a + b, 0);

    return {
      totalKeys,
      memoryUsage,
      patterns
    };
  } catch (error) {
    return {
      totalKeys: 0,
      memoryUsage: 'unknown',
      patterns: {}
    };
  }
}

export default redis;