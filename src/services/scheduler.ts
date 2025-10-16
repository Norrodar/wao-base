import * as cron from 'node-cron';
import { config } from '../config';
import { logger } from '../utils/logger';
import { ScraperManager } from '../scraper';
import { db } from '../database';
import { Station, Show } from '../types';

export class SchedulerService {
  private scraperManager: ScraperManager;
  private cronJob?: cron.ScheduledTask;
  private isRunning = false;

  constructor() {
    this.scraperManager = new ScraperManager();
    this.initializeStations();
  }

  private async initializeStations(): Promise<void> {
    try {
      for (const stationDomain of config.stations) {
        const station: Station = {
          domain: stationDomain,
          name: this.getStationName(stationDomain),
          enabled: true
        };
        await db.upsertStation(station);
      }
      logger.info('Stations initialized');
    } catch (error) {
      logger.error('Failed to initialize stations:', error);
    }
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

  start(): void {
    if (this.cronJob) {
      logger.warn('Scheduler is already running');
      return;
    }

    logger.info(`Starting scheduler with cron: ${config.cronSchedule}`);
    
    this.cronJob = cron.schedule(config.cronSchedule, async () => {
      if (this.isRunning) {
        logger.warn('Previous scrape job still running, skipping...');
        return;
      }
      
      await this.runScheduledScrape();
    }, {
      scheduled: true,
      timezone: config.timezone
    });

    // Run initial scrape
    this.runScheduledScrape();
  }

  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = undefined;
      logger.info('Scheduler stopped');
    }
  }

  async runScheduledScrape(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Scrape job already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting scheduled scrape job');

    try {
      const dates = this.generateDateRange();
      logger.info(`Scraping dates: ${dates.join(', ')}`);

      for (const stationDomain of config.stations) {
        const station = await db.getStation(stationDomain);
        if (!station || !station.enabled) {
          logger.info(`Skipping disabled station: ${stationDomain}`);
          continue;
        }

        logger.info(`Scraping ${stationDomain}`);
        
        // Track results for this station
        const stationResults: {[date: string]: number} = {};
        
        for (const date of dates) {
          try {
            const result = await this.scraperManager.scrapeStation(stationDomain, date);
            
            if (result.success && result.shows.length > 0) {
              await this.saveShows(stationDomain, date, result.shows);
              stationResults[date] = result.shows.length;
            } else {
              stationResults[date] = 0;
            }
          } catch (error) {
            logger.error(`Failed to scrape ${stationDomain} for ${date}:`, error);
            stationResults[date] = 0;
          }

          // Small delay between requests
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // Log station summary
        for (const [date, count] of Object.entries(stationResults)) {
          const dateStr = new Date(date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
          if (count > 0) {
            logger.info(`    ${dateStr}.: Found ${count} Shows`);
          } else {
            logger.info(`    ${dateStr}.: Found nothing`);
          }
        }

        // Update last scraped timestamp
        await db.upsertStation({
          ...station,
          lastScraped: new Date()
        });
      }

      // Cleanup old data
      await db.cleanupOldData();
      
      logger.info('Scheduled scrape job completed');
    } catch (error) {
      logger.error('Scheduled scrape job failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  async runManualScrape(station?: string, dates?: string[]): Promise<void> {
    logger.info(`Starting manual scrape: station=${station || 'all'}, dates=${dates?.join(',') || 'default'}`);

    const targetStations = station ? [station] : config.stations;
    const targetDates = dates || this.generateDateRange();

    for (const stationDomain of targetStations) {
      const stationData = await db.getStation(stationDomain);
      if (!stationData) {
        logger.warn(`Station not found: ${stationDomain}`);
        continue;
      }

      for (const date of targetDates) {
        try {
          const result = await this.scraperManager.scrapeStation(stationDomain, date);
          
          if (result.success && result.shows.length > 0) {
            await this.saveShows(stationDomain, date, result.shows);
            logger.info(`Saved ${result.shows.length} shows for ${stationDomain} on ${date}`);
          } else {
            logger.warn(`No shows found for ${stationDomain} on ${date}: ${result.error || 'Unknown error'}`);
          }
        } catch (error) {
          logger.error(`Failed to scrape ${stationDomain} for ${date}:`, error);
        }

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  private async saveShows(stationDomain: string, date: string, shows: any[]): Promise<void> {
    // Save day record
    await db.upsertDay({
      stationDomain,
      day: date,
      scrapedAt: new Date()
    });

    // Convert and save shows
    const showRecords: Show[] = shows.map(show => ({
      day: date,
      stationDomain,
      dj: show.dj,
      title: show.title,
      start: show.start,
      end: show.end,
      style: show.style
    }));

    await db.upsertShows(showRecords);
  }

  private generateDateRange(): string[] {
    const dates: string[] = [];
    const today = new Date();
    
    // Yesterday, today, and next 5 days
    for (let i = -1; i <= 5; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date.toISOString().split('T')[0]); // YYYY-MM-DD format
    }
    
    return dates;
  }

  getStatus(): { isRunning: boolean; nextRun?: Date } {
    return {
      isRunning: this.isRunning,
      nextRun: this.cronJob ? (this.cronJob as any).nextDate() : undefined
    };
  }
}
