import { SchedulerService } from './scheduler';
import { TelegramBotService } from '../bot';
import { NotificationService } from './notification-service';
import { DJScraperService } from './dj-scraper';
import { CalDAVService } from './caldav';
import { ScraperManager } from '../scraper';
import { config } from '../config';
import { logger } from '../utils/logger';

class ServiceManager {
  private static instance: ServiceManager;
  private schedulerService: SchedulerService | null = null;
  private telegramBot: TelegramBotService | null = null;
  private notificationService: NotificationService | null = null;
  private djScraperService: DJScraperService | null = null;
  private caldavService: CalDAVService | null = null;
  private scraperManager: ScraperManager | null = null;

  private constructor() {}

  public static getInstance(): ServiceManager {
    if (!ServiceManager.instance) {
      ServiceManager.instance = new ServiceManager();
    }
    return ServiceManager.instance;
  }

  public getSchedulerService(): SchedulerService {
    if (!this.schedulerService) {
      this.schedulerService = new SchedulerService();
    }
    return this.schedulerService;
  }

  public getTelegramBot(): TelegramBotService | null {
    if (!this.telegramBot && config.telegramEnabled && config.telegramBotToken) {
      this.telegramBot = new TelegramBotService();
    }
    return this.telegramBot;
  }

  public getNotificationService(): NotificationService | null {
    if (!this.notificationService) {
      const bot = this.getTelegramBot();
      if (bot) {
        this.notificationService = new NotificationService(bot);
      }
    }
    return this.notificationService;
  }

  public getDJScraperService(): DJScraperService {
    if (!this.djScraperService) {
      this.djScraperService = new DJScraperService();
    }
    return this.djScraperService;
  }

  public getCalDAVService(): CalDAVService {
    if (!this.caldavService) {
      this.caldavService = new CalDAVService();
    }
    return this.caldavService;
  }

  public getScraperManager(): ScraperManager {
    if (!this.scraperManager) {
      this.scraperManager = new ScraperManager();
    }
    return this.scraperManager;
  }

  public async startServices(): Promise<void> {
    try {
      // Start scheduler
      this.getSchedulerService().start();
      logger.info('Scheduler service started');

      // Start Telegram Bot and related services
      const telegramBot = this.getTelegramBot();
      if (telegramBot) {
        await telegramBot.start();
        logger.info('Telegram bot started');

        const notificationService = this.getNotificationService();
        if (notificationService) {
          notificationService.start();
          logger.info('Notification service started');
        }

        const djScraperService = this.getDJScraperService();
        // Initial DJ scraping
        djScraperService.scrapeAllStations().catch(error => {
          logger.error('Initial DJ scraping failed:', error);
        });
        logger.info('DJ scraper service initialized');
      } else {
        logger.info('Telegram bot disabled - set WAOBASE_TELEGRAM_ENABLED=true and WAOBASE_TELEGRAM_BOT_TOKEN to enable');
      }
    } catch (error) {
      logger.error('Failed to start services:', error);
      throw error;
    }
  }

  public async stopServices(): Promise<void> {
    try {
      if (this.schedulerService) {
        this.schedulerService.stop();
      }
      
      if (this.telegramBot) {
        await this.telegramBot.stop();
      }
      
      if (this.notificationService) {
        this.notificationService.stop();
      }
      
      logger.info('All services stopped');
    } catch (error) {
      logger.error('Error stopping services:', error);
    }
  }
}

export const serviceManager = ServiceManager.getInstance();
