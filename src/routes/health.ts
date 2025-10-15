import { FastifyInstance } from 'fastify';
import { db } from '../database';
import { logger } from '../utils/logger';

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async (request, reply) => {
    try {
      const dbHealthy = await db.healthCheck();
      
      const health = {
        status: dbHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        database: dbHealthy ? 'connected' : 'disconnected'
      };

      const statusCode = dbHealthy ? 200 : 503;
      return reply.status(statusCode).send(health);
    } catch (error) {
      logger.error('Health check failed:', error);
      return reply.status(503).send({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed'
      });
    }
  });
}
