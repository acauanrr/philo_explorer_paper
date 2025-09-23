/**
 * API Gateway main entry point
 */
import 'dotenv/config';
import express, { Express, Request, Response, NextFunction } from 'express';
import morgan from 'morgan';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';

import config from './config';
import qualityRoutes from './routes/quality';
import { redis } from './redis';

const app: Express = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());
app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));

// CORS configuration
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);

    // In development, allow all origins
    if (config.nodeEnv === 'development') {
      return callback(null, true);
    }

    // Check if the origin is in the allowed list
    if (config.cors.origins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('CORS rejected origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Security headers
app.use(
  helmet({
    crossOriginResourcePolicy: false, // Allow cross-origin requests for API
  })
);

// Health check endpoint
app.get('/health', async (req: Request, res: Response) => {
  try {
    // Check Redis connection
    await redis.ping();

    // Check Python API
    const { pythonClient } = await import('./services/pythonClient');
    const pythonHealthy = await pythonClient.healthCheck();

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        redis: 'connected',
        python: pythonHealthy ? 'connected' : 'disconnected'
      },
      environment: config.nodeEnv
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// API routes
app.use('/api/phylo/quality', qualityRoutes);

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'Phylo Explorer API Gateway',
    version: '2.0.0',
    endpoints: {
      health: '/health',
      quality: {
        errors: 'POST /api/phylo/quality/errors',
        falseNeighbors: 'POST /api/phylo/quality/false-neighbors-view',
        missingNeighbors: 'POST /api/phylo/quality/missing-neighbors-single',
        groupAnalysis: 'POST /api/phylo/quality/group-analysis',
        compareProjections: 'POST /api/phylo/quality/compare-projections',
        cacheStats: 'GET /api/phylo/quality/cache-stats'
      }
    }
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`
  });
});

// Error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);

  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(status).json({
    error: message,
    ...(config.nodeEnv === 'development' && { stack: err.stack })
  });
});

// Start server
const startServer = async () => {
  try {
    // Test Redis connection
    await redis.ping();
    console.log('✅ Redis connected');

    // Test Python API connection
    const { pythonClient } = await import('./services/pythonClient');
    const pythonHealthy = await pythonClient.healthCheck();
    console.log(pythonHealthy ? '✅ Python API connected' : '⚠️  Python API disconnected');

    app.listen(config.port, () => {
      console.log(`🚀 API Gateway running on port ${config.port}`);
      console.log(`📝 Environment: ${config.nodeEnv}`);
      console.log(`🔗 Python API: ${config.pythonApi.url}`);
      console.log(`🔗 Redis: ${config.redis.host}:${config.redis.port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await redis.quit();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await redis.quit();
  process.exit(0);
});

// Start the server
startServer();

export default app;