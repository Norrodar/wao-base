import { FastifyInstance } from 'fastify';
import { db } from '../database';
import { logger } from '../utils/logger';

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async (request, reply) => {
    try {
      const dbHealthy = await db.healthCheck();
      const dbStatus = db.getInitializationStatus();
      
      const health = {
        status: dbHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        database: {
          healthy: dbHealthy,
          initialized: dbStatus.isInitialized,
          error: dbStatus.error
        }
      };

      const statusCode = dbHealthy ? 200 : 503;
      return reply.status(statusCode).send(health);
    } catch (error) {
      logger.error('Health check failed:', error);
      return reply.status(503).send({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
        database: {
          healthy: false,
          initialized: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  });

  // Special endpoint for error page to get detailed error information
  fastify.get('/api/health', async (request, reply) => {
    try {
      const dbHealthy = await db.healthCheck();
      const dbStatus = db.getInitializationStatus();
      
      if (!dbHealthy) {
        return reply.status(503).send({
          error: dbStatus.error || 'Database initialization failed',
          database: {
            healthy: false,
            initialized: dbStatus.isInitialized,
            error: dbStatus.error
          }
        });
      }

      return reply.send({
        status: 'healthy',
        database: {
          healthy: true,
          initialized: true
        }
      });
    } catch (error) {
      return reply.status(503).send({
        error: error instanceof Error ? error.message : 'Unknown error',
        database: {
          healthy: false,
          initialized: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  });
}
