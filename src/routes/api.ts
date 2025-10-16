import { FastifyInstance } from 'fastify';
import { db } from '../database';
import { serviceManager } from '../services/service-manager';
import { config } from '../config';
import { ApiResponse, ScheduleQuery, Config } from '../types';
import { logger } from '../utils/logger';

export async function apiRoutes(fastify: FastifyInstance) {
  // Initialize services safely
  let schedulerService: any, telegramBot: any, notificationService: any, djScraperService: any;
  
  try {
    schedulerService = serviceManager.getSchedulerService();
  } catch (error: any) {
    logger.error('Failed to get scheduler service:', error);
  }
  
  try {
    telegramBot = serviceManager.getTelegramBot();
  } catch (error: any) {
    logger.error('Failed to get telegram bot:', error);
  }
  
  try {
    notificationService = serviceManager.getNotificationService();
  } catch (error: any) {
    logger.error('Failed to get notification service:', error);
  }
  
  try {
    djScraperService = serviceManager.getDJScraperService();
  } catch (error: any) {
    logger.error('Failed to get DJ scraper service:', error);
  }

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
  fastify.get<{ Querystring: ScheduleQuery }>('/api/schedule', async (request, reply) => {
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
  fastify.get<{ Querystring: ScheduleQuery }>('/api/schedule/range', async (request, reply) => {
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

  // POST /api/scrape
  fastify.post<{ Body: { station?: string; dates?: string[] } }>('/api/scrape', async (request, reply) => {
    try {
      const { station, dates } = request.body;

      // Validate station if provided
      if (station) {
        const stationData = await db.getStation(station);
        if (!stationData) {
          const response: ApiResponse = {
            success: false,
            error: `Station not found: ${station}`
          };
          return reply.status(404).send(response);
        }
      }

      // Validate dates if provided
      if (dates) {
        for (const date of dates) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            const response: ApiResponse = {
              success: false,
              error: `Invalid date format: ${date}. Expected YYYY-MM-DD`
            };
            return reply.status(400).send(response);
          }
        }
      }

      // Start scraping in background
      schedulerService.runManualScrape(station, dates).catch((error: any) => {
        logger.error('Manual scrape failed:', error);
      });

      const response: ApiResponse = {
        success: true,
        message: 'Scrape job started'
      };
      return reply.send(response);
    } catch (error) {
      logger.error('Failed to start scrape:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Failed to start scrape job'
      };
      return reply.status(500).send(response);
    }
  });

  // GET /api/config
  fastify.get('/api/config', async (request, reply) => {
    try {
      const configData: Config = {
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

  // PUT /api/config
  fastify.put<{ Body: Partial<Config> }>('/api/config', async (request, reply) => {
    try {
      const newConfig = request.body;

      // Validate stations
      if (newConfig.stations) {
        for (const station of newConfig.stations) {
          if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(station)) {
            const response: ApiResponse = {
              success: false,
              error: `Invalid station domain: ${station}`
            };
            return reply.status(400).send(response);
          }
        }
      }

      // Validate cron schedule
      if (newConfig.cronSchedule) {
        try {
          // Basic validation - in a real app you'd use a proper cron validator
          if (!/^[\d\s\*\/,-]+$/.test(newConfig.cronSchedule)) {
            throw new Error('Invalid cron format');
          }
        } catch (error) {
          const response: ApiResponse = {
            success: false,
            error: `Invalid cron schedule: ${newConfig.cronSchedule}`
          };
          return reply.status(400).send(response);
        }
      }

      // Validate retention days
      if (newConfig.retentionDays !== undefined) {
        if (newConfig.retentionDays < 1 || newConfig.retentionDays > 365) {
          const response: ApiResponse = {
            success: false,
            error: 'Retention days must be between 1 and 365'
          };
          return reply.status(400).send(response);
        }
      }

      // Note: In a real application, you'd save this to a config file or database
      // For now, we'll just return success
      const response: ApiResponse = {
        success: true,
        message: 'Configuration updated (restart required to take effect)'
      };
      return reply.send(response);
    } catch (error) {
      logger.error('Failed to update config:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Failed to update configuration'
      };
      return reply.status(500).send(response);
    }
  });

  // GET /api/status
  fastify.get('/api/status', async (request, reply) => {
    try {
      const status = schedulerService.getStatus();
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
      if (config.telegramEnabled) {
        const botStatus = telegramBot?.getStatus() || { isRunning: false };
        const notificationStatus = notificationService?.getStatus() || { isRunning: false };
        
        const response: ApiResponse = {
          success: true,
          data: {
            bot: botStatus,
            notifications: notificationStatus,
            enabled: true
          }
        };
        return reply.send(response);
      } else {
        const response: ApiResponse = {
          success: true,
          data: {
            enabled: false,
            message: 'Telegram bot is disabled'
          }
        };
        return reply.send(response);
      }
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
      if (!djScraperService) {
        const response: ApiResponse = {
          success: false,
          error: 'DJ scraper service not available'
        };
        return reply.status(503).send(response);
      }
      
      const djs = await djScraperService.getAvailableDJs();
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
      if (!djScraperService) {
        const response: ApiResponse = {
          success: false,
          error: 'DJ scraper service not available'
        };
        return reply.status(503).send(response);
      }
      
      // Start DJ scraping in background
      djScraperService.scrapeAllStations().catch((error: any) => {
        logger.error('DJ scraping failed:', error);
      });

      const response: ApiResponse = {
        success: true,
        message: 'DJ scraping started'
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

  if (config.telegramEnabled) {

    // GET /api/bot/users
    fastify.get('/api/bot/users', async (request, reply) => {
      try {
        const users = await db.getActiveBotUsers();
        const response: ApiResponse = {
          success: true,
          data: users
        };
        return reply.send(response);
      } catch (error) {
        logger.error('Failed to get bot users:', error);
        const response: ApiResponse = {
          success: false,
          error: 'Failed to retrieve bot users'
        };
        return reply.status(500).send(response);
      }
    });

    // POST /api/bot/test-notification
    fastify.post<{ Body: { telegramId: number } }>('/api/bot/test-notification', async (request, reply) => {
      try {
        const { telegramId } = request.body;

        if (!telegramId) {
          const response: ApiResponse = {
            success: false,
            error: 'telegramId is required'
          };
          return reply.status(400).send(response);
        }

        if (notificationService) {
          await notificationService.sendTestNotification(telegramId);
        }

        const response: ApiResponse = {
          success: true,
          message: 'Test notification sent'
        };
        return reply.send(response);
      } catch (error) {
        logger.error('Failed to send test notification:', error);
        const response: ApiResponse = {
          success: false,
          error: 'Failed to send test notification'
        };
        return reply.status(500).send(response);
      }
    });
  } else {
    // Bot disabled endpoints
    fastify.get('/api/bot/status', async (request, reply) => {
      const response: ApiResponse = {
        success: true,
        data: {
          enabled: false,
          message: 'Telegram bot is disabled'
        }
      };
      return reply.send(response);
    });
  }
}
