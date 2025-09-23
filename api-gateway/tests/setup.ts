/**
 * Jest test setup
 */
import dotenv from 'dotenv';
import redis from '../src/redis';

// Load test environment
dotenv.config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.PORT = '3002'; // Different port for testing
process.env.PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:8001';

// Global test setup
beforeAll(async () => {
  // Check Redis connection for tests
  try {
    await redis.ping();
    console.log('Redis connected for tests');
  } catch (error) {
    console.warn('Redis connection failed, tests will run without cache:', error);
  }
});

// Global test teardown
afterAll(async () => {
  // Clean up Redis connection
  if (redis && redis.status === 'ready') {
    await redis.quit();
    console.log('Redis connection closed');
  }
});

// Increase timeout for E2E tests
jest.setTimeout(30000);