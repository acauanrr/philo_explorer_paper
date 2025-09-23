/**
 * Configuration for the API Gateway
 */
export default {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  pythonApi: {
    url: process.env.PYTHON_API_URL || 'http://localhost:8001',
    timeout: parseInt(process.env.PYTHON_API_TIMEOUT || '30000', 10)
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    db: parseInt(process.env.REDIS_DB || '0', 10)
  },

  cors: {
    origins: [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:4000',
      process.env.CORS_ORIGIN
    ].filter(Boolean)
  },

  cache: {
    defaultTTL: 24 * 60 * 60, // 24 hours
    shortTTL: 5 * 60 // 5 minutes
  }
};