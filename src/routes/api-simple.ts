import { FastifyInstance } from 'fastify';
import { db } from '../database';
import { ApiResponse } from '../types';
import { logger } from '../utils/logger';

export async function apiRoutes(fastify: FastifyInstance) {
  // GET /api/stations
  fastify.get('/api/stations', async (request, reply) => {
    try {
      const stations = await db.getStations();
      const response: ApiResponse = {
        success: true,
        data: stations
      };
      return reply.send(response);
    } catch (error) {
      logger.error('Failed to get stations:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Failed to retrieve stations'
      };
      return reply.status(500).send(response);
    }
  });

  // GET /api/schedule
  fastify.get<{ Querystring: { station: string; date?: string; from?: string; to?: string } }>('/api/schedule', async (request, reply) => {
    try {
      const { station, date, from, to } = request.query;

      if (!station) {
        const response: ApiResponse = {
          success: false,
          error: 'Station parameter is required'
        };
        return reply.status(400).send(response);
      }

      const shows = await db.getShows(station, date, from, to);
      const response: ApiResponse = {
        success: true,
        data: shows
      };
      return reply.send(response);
    } catch (error) {
      logger.error('Failed to get schedule:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Failed to retrieve schedule'
      };
      return reply.status(500).send(response);
    }
  });

  // GET /api/schedule/range
  fastify.get<{ Querystring: { station: string; from: string; to: string } }>('/api/schedule/range', async (request, reply) => {
    try {
      const { station, from, to } = request.query;

      if (!station || !from || !to) {
        const response: ApiResponse = {
          success: false,
          error: 'Station, from, and to parameters are required'
        };
        return reply.status(400).send(response);
      }

      const shows = await db.getShows(station, undefined, from, to);
      const response: ApiResponse = {
        success: true,
        data: shows
      };
      return reply.send(response);
    } catch (error) {
      logger.error('Failed to get schedule range:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Failed to retrieve schedule range'
      };
      return reply.status(500).send(response);
    }
  });

  // GET /api/config
  fastify.get('/api/config', async (request, reply) => {
    try {
      const { config } = await import('../config');
      const configData = {
        stations: config.stations,
        cronSchedule: config.cronSchedule,
        retentionDays: config.retentionDays,
        httpProxy: config.httpProxy,
        httpsProxy: config.httpsProxy
      };

      const response: ApiResponse = {
        success: true,
        data: configData
      };
      return reply.send(response);
    } catch (error) {
      logger.error('Failed to get config:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Failed to retrieve configuration'
      };
      return reply.status(500).send(response);
    }
  });

  // GET /api/status
  fastify.get('/api/status', async (request, reply) => {
    try {
      const status = {
        isRunning: false,
        nextRun: null
      };

      const response: ApiResponse = {
        success: true,
        data: status
      };
      return reply.send(response);
    } catch (error) {
      logger.error('Failed to get status:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Failed to retrieve status'
      };
      return reply.status(500).send(response);
    }
  });

  // Bot endpoints
  // GET /api/bot/status
  fastify.get('/api/bot/status', async (request, reply) => {
    try {
      const response: ApiResponse = {
        success: true,
        data: {
          enabled: false,
          message: 'Telegram bot is disabled'
        }
      };
      return reply.send(response);
    } catch (error) {
      logger.error('Failed to get bot status:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Failed to retrieve bot status'
      };
      return reply.status(500).send(response);
    }
  });

  // GET /api/bot/djs
  fastify.get('/api/bot/djs', async (request, reply) => {
    try {
      const djs = await db.getBotDJs();
      const response: ApiResponse = {
        success: true,
        data: djs
      };
      return reply.send(response);
    } catch (error) {
      logger.error('Failed to get DJs:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Failed to retrieve DJs'
      };
      return reply.status(500).send(response);
    }
  });

  // POST /api/bot/scrape-djs
  fastify.post('/api/bot/scrape-djs', async (request, reply) => {
    try {
      const response: ApiResponse = {
        success: true,
        message: 'DJ scraping not implemented yet'
      };
      return reply.send(response);
    } catch (error) {
      logger.error('Failed to start DJ scraping:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Failed to start DJ scraping'
      };
      return reply.status(500).send(response);
    }
  });
}
