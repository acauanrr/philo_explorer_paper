/**
 * Cache headers middleware for Express
 */
import { Request, Response, NextFunction } from 'express';

export interface CacheInfo {
  hit: boolean;
  key?: string;
  ttl?: number;
}

/**
 * Middleware to set cache-related headers
 */
export function setCacheHeaders(cacheInfo: CacheInfo) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Set X-Cache header
    res.set('X-Cache', cacheInfo.hit ? 'HIT' : 'MISS');

    // Optionally set cache key for debugging
    if (cacheInfo.key) {
      res.set('X-Cache-Key', cacheInfo.key);
    }

    // Set Cache-Control header
    if (cacheInfo.ttl && cacheInfo.hit) {
      res.set('Cache-Control', `private, max-age=${cacheInfo.ttl}`);
    } else {
      res.set('Cache-Control', 'no-cache');
    }

    // Set timing headers for performance monitoring
    res.set('X-Response-Time', Date.now().toString());

    next();
  };
}

/**
 * Middleware to track response time
 */
export function responseTimeMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();

  // Override res.json to add timing
  const originalJson = res.json.bind(res);
  res.json = function(body: any) {
    const duration = Date.now() - startTime;
    res.set('X-Response-Time', `${duration}ms`);
    return originalJson(body);
  };

  next();
}