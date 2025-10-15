import * as cron from 'node-cron';
import { config } from '../config';
import { logger } from '../utils/logger';
import { db, BotUser, BotUserPreferences, BotFavoriteDJ } from '../database';
import { TelegramBotService } from '../bot';
import { Show } from '../types';
import { parseNotificationTimes } from '../utils/time-parser';

export class NotificationService {
  private telegramBot: TelegramBotService;
  private cronJob?: cron.ScheduledTask;
  private isRunning = false;

  constructor(telegramBot: TelegramBotService) {
    this.telegramBot = telegramBot;
  }

  start(): void {
    if (!config.telegramEnabled) {
      logger.info('Notification service disabled - Telegram bot not enabled');
      return;
    }

    if (this.cronJob) {
      logger.warn('Notification service is already running');
      return;
    }

    // Run every 15 minutes to check for upcoming shows
    const cronSchedule = '*/15 * * * *';
    logger.info(`Starting notification service with cron: ${cronSchedule}`);
    
    this.cronJob = cron.schedule(cronSchedule, async () => {
      if (this.isRunning) {
        logger.warn('Previous notification check still running, skipping...');
        return;
      }
      
      await this.checkAndSendNotifications();
    }, {
      scheduled: true,
      timezone: config.timezone
    });

    // Run initial check
    this.checkAndSendNotifications();
  }

  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = undefined;
      logger.info('Notification service stopped');
    }
  }

  async checkAndSendNotifications(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Notification check already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting notification check');

    try {
      const activeUsers = await db.getActiveBotUsers();
      logger.info(`Checking notifications for ${activeUsers.length} active users`);

      for (const user of activeUsers) {
        try {
          await this.checkUserNotifications(user);
        } catch (error) {
          logger.error(`Failed to check notifications for user ${user.telegramId}:`, error);
        }
      }

      logger.info('Notification check completed');
    } catch (error) {
      logger.error('Notification check failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  private async checkUserNotifications(user: BotUser): Promise<void> {
    const preferences = await db.getBotUserPreferences(user.telegramId);
    if (!preferences) {
      logger.warn(`No preferences found for user ${user.telegramId}`);
      return;
    }

    const favoriteDJs = await db.getBotFavoriteDJs(user.telegramId);
    if (favoriteDJs.length === 0) {
      // User has no favorite DJs, skip
      return;
    }

    // Get shows for the next 24 hours
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const today = now.toISOString().split('T')[0];
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // Check shows for each favorite DJ
    for (const favoriteDJ of favoriteDJs) {
      try {
        const shows = await db.getShows(favoriteDJ.stationDomain, undefined, today, tomorrowStr);
        const djShows = this.filterShowsForDJ(shows, favoriteDJ.djName);

        for (const show of djShows) {
          await this.checkShowNotification(user, preferences, show, favoriteDJ.stationDomain);
        }
      } catch (error) {
        logger.error(`Failed to check shows for DJ ${favoriteDJ.djName} on ${favoriteDJ.stationDomain}:`, error);
      }
    }
  }

  private filterShowsForDJ(shows: Show[], djName: string): Show[] {
    return shows.filter(show => {
      const showDJ = show.dj.toLowerCase();
      const favoriteDJ = djName.toLowerCase();
      
      // Check for exact match or partial match
      return showDJ.includes(favoriteDJ) || 
             favoriteDJ.includes(showDJ) ||
             this.normalizeDJName(showDJ) === this.normalizeDJName(favoriteDJ);
    });
  }

  private normalizeDJName(name: string): string {
    return name
      .toLowerCase()
      .replace(/^dj\s+/, '') // Remove "DJ " prefix
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  private async checkShowNotification(
    user: BotUser, 
    preferences: BotUserPreferences, 
    show: Show, 
    stationDomain: string
  ): Promise<void> {
    try {
      // Check if notification was already sent for this specific time
      // We'll check this inside the loop for each notification time

      // Check each notification time
      for (const notificationTimeStr of preferences.notificationTimes) {
        try {
          // Check if notification was already sent for this specific time
          const alreadySent = await db.isNotificationSent(user.telegramId, show.id!, `upcoming_show_${notificationTimeStr}`);
          if (alreadySent) {
            continue;
          }

          const notificationMinutes = parseNotificationTimes(notificationTimeStr)[0];
          
          // Calculate notification time
          const showStartTime = this.parseShowTime(show.day, show.start);
          const notificationTime = new Date(showStartTime);
          notificationTime.setMinutes(notificationTime.getMinutes() - notificationMinutes);

          const now = new Date();
          const timeDiff = notificationTime.getTime() - now.getTime();

          // Check if it's time to send notification (within 15 minutes window)
          if (timeDiff >= 0 && timeDiff <= 15 * 60 * 1000) {
            const stationName = this.getStationName(stationDomain);
            await this.telegramBot.sendNotification(user.telegramId, show, stationName, notificationTimeStr);
            
            // Mark notification as sent
            await db.markNotificationSent(user.telegramId, show.id!, `upcoming_show_${notificationTimeStr}`);
            
            logger.info(`Notification sent to user ${user.telegramId} for show ${show.title} by ${show.dj} (${notificationTimeStr} before)`);
          }
        } catch (error) {
          logger.error(`Failed to process notification time ${notificationTimeStr} for show ${show.title}:`, error);
        }
      }
    } catch (error) {
      logger.error(`Failed to check notification for show ${show.title}:`, error);
    }
  }

  private parseShowTime(day: string, time: string): Date {
    const [year, month, dayNum] = day.split('-').map(Number);
    const [hours, minutes] = time.split(':').map(Number);
    
    return new Date(year, month - 1, dayNum, hours, minutes);
  }

  private getStationName(domain: string): string {
    const names: Record<string, string> = {
      'technobase.fm': 'Technobase.FM',
      'housetime.fm': 'Housetime.FM',
      'hardbase.fm': 'Hardbase.FM',
      'trancebase.fm': 'Trancebase.FM',
      'coretime.fm': 'Coretime.FM',
      'clubtime.fm': 'Clubtime.FM',
      'teatime.fm': 'Teatime.FM',
      'replay.fm': 'Replay.FM'
    };
    return names[domain] || domain;
  }

  async sendTestNotification(telegramId: number): Promise<void> {
    const testShow: Show = {
      id: 999999,
      day: new Date().toISOString().split('T')[0],
      stationDomain: 'technobase.fm',
      dj: 'DJ Test',
      title: 'Test Show',
      start: '20:00',
      end: '22:00',
      style: 'Test Music'
    };

    await this.telegramBot.sendNotification(telegramId, testShow, 'Technobase.FM');
  }

  getStatus(): { isRunning: boolean; nextRun?: Date } {
    return {
      isRunning: this.isRunning,
      nextRun: this.cronJob ? (this.cronJob as any).nextDate() : undefined
    };
  }
}
