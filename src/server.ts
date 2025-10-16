import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import staticFiles from '@fastify/static';
import { join } from 'path';
import { config } from './config';
import { logger } from './utils/logger';
import { db } from './database';
import { serviceManager } from './services/service-manager';
import { healthRoutes } from './routes/health';
import { apiRoutes } from './routes/api';
import { caldavRoutes } from './routes/caldav';

async function buildServer() {
  const fastify = Fastify({
    logger: false, // We use our own logger
    trustProxy: true
  });

  // Register plugins
  await fastify.register(helmet, {
    contentSecurityPolicy: false // Allow inline scripts for development
  });

  await fastify.register(cors, {
    origin: true,
    credentials: true
  });

  // Serve static files from frontend build
  await fastify.register(staticFiles, {
    root: join(__dirname, '../public'),
    prefix: '/'
  });

  // Register routes
  await fastify.register(healthRoutes);
  await fastify.register(apiRoutes);
  await fastify.register(caldavRoutes);

  // Catch-all route for SPA
  fastify.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/')) {
      return reply.status(404).send({
        success: false,
        error: 'API endpoint not found'
      });
    }
    
    // Check if database is available, if not show error page
    const dbStatus = db.getInitializationStatus();
    if (!dbStatus.isInitialized) {
      return reply.sendFile('error.html');
    }
    
    // Serve index.html for all non-API routes (SPA fallback)
    return reply.sendFile('index.html');
  });

  return fastify;
}

async function start() {
  try {
    // Ensure data directory exists
    const fs = await import('fs');
    if (!fs.existsSync(config.dataDir)) {
      fs.mkdirSync(config.dataDir, { recursive: true });
    }

    // Check database initialization
    const dbHealthy = await db.healthCheck();
    const dbStatus = db.getInitializationStatus();
    
    if (!dbHealthy) {
      logger.error('Database initialization failed, starting server in error mode');
      logger.error('Database status:', dbStatus);
      
      // Start server in error mode (will show error page)
      const server = await buildServer();
      
      await server.listen({
        port: config.port,
        host: '0.0.0.0'
      });

      logger.info(`Server listening on http://0.0.0.0:${config.port} (Error Mode)`);
      logger.info('Please check the logs for database initialization errors');
      
      // Graceful shutdown
      const gracefulShutdown = async (signal: string) => {
        logger.info(`Received ${signal}, shutting down gracefully...`);
        
        try {
          await server.close();
          db.close();
          logger.info('Server shut down successfully');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown:', error);
          process.exit(1);
        }
      };

      process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
      process.on('SIGINT', () => gracefulShutdown('SIGINT'));
      
      return; // Exit early in error mode
    }

    logger.info('Database initialized successfully');

    // Start all services
    await serviceManager.startServices();

    // Build and start server
    const server = await buildServer();
    
    await server.listen({
      port: config.port,
      host: '0.0.0.0'
    });

    logger.info(`Server listening on http://0.0.0.0:${config.port}`);
    logger.info(`Environment: ${config.nodeEnv}`);
    logger.info(`Stations: ${config.stations.join(', ')}`);
    logger.info(`Cron schedule: ${config.cronSchedule}`);

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      
      try {
        await server.close();
        await serviceManager.stopServices();
        db.close();
        logger.info('Server shut down successfully');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

start();
