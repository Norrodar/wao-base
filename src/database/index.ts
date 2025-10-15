import Database from 'better-sqlite3';
import { join } from 'path';
import { config } from '../config';
import { createTables, cleanupOldData } from './schema';
import { Station, Day, Show } from '../types';
import { logger } from '../utils/logger';

export interface BotUser {
  telegramId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  languageCode: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BotUserPreferences {
  telegramId: number;
  notificationTimes: string[]; // Array of notification times like ['30m', '4.5h', '1d']
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BotFavoriteDJ {
  id: number;
  telegramId: number;
  stationDomain: string;
  djName: string;
  createdAt: Date;
}

export interface BotDJ {
  id: number;
  stationDomain: string;
  djName: string;
  realName?: string;
  isActive: boolean;
  lastUpdated: Date;
}

class DatabaseManager {
  private db: Database.Database;

  constructor() {
    const dbPath = join(config.dataDir, 'schedule.db');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initializeTables();
  }

  private initializeTables(): void {
    try {
      this.db.exec(createTables);
      logger.info('Database tables initialized');
    } catch (error) {
      logger.error('Failed to initialize database tables:', error);
      throw error;
    }
  }

  // Station methods
  async getStations(): Promise<Station[]> {
    const stmt = this.db.prepare('SELECT * FROM stations ORDER BY domain');
    return stmt.all() as Station[];
  }

  async getStation(domain: string): Promise<Station | null> {
    const stmt = this.db.prepare('SELECT * FROM stations WHERE domain = ?');
    return stmt.get(domain) as Station | null;
  }

  async upsertStation(station: Station): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO stations (domain, name, enabled, last_scraped, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(domain) DO UPDATE SET
        name = excluded.name,
        enabled = excluded.enabled,
        last_scraped = excluded.last_scraped,
        updated_at = CURRENT_TIMESTAMP
    `);
    stmt.run(station.domain, station.name, station.enabled ? 1 : 0, station.lastScraped?.toISOString());
  }

  // Day methods
  async getDays(stationDomain: string, from?: string, to?: string): Promise<Day[]> {
    let query = 'SELECT * FROM days WHERE station_domain = ?';
    const params: any[] = [stationDomain];

    if (from) {
      query += ' AND day >= ?';
      params.push(from);
    }
    if (to) {
      query += ' AND day <= ?';
      params.push(to);
    }

    query += ' ORDER BY day';

    const stmt = this.db.prepare(query);
    return stmt.all(...params) as Day[];
  }

  async upsertDay(day: Day): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO days (station_domain, day, scraped_at)
      VALUES (?, ?, ?)
      ON CONFLICT(station_domain, day) DO UPDATE SET
        scraped_at = excluded.scraped_at
    `);
    stmt.run(day.stationDomain, day.day, day.scrapedAt.toISOString());
  }

  // Show methods
  async getShows(stationDomain: string, date?: string, from?: string, to?: string): Promise<Show[]> {
    let query = 'SELECT * FROM shows WHERE station_domain = ?';
    const params: any[] = [stationDomain];

    if (date) {
      query += ' AND day = ?';
      params.push(date);
    } else if (from && to) {
      query += ' AND day >= ? AND day <= ?';
      params.push(from, to);
    }

    query += ' ORDER BY day, start_time';

    const stmt = this.db.prepare(query);
    return stmt.all(...params) as Show[];
  }

  async upsertShows(shows: Show[]): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO shows (day, station_domain, dj, title, start_time, end_time, style)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(day, station_domain, dj, title, start_time, end_time) DO NOTHING
    `);

    const transaction = this.db.transaction((shows: Show[]) => {
      for (const show of shows) {
        stmt.run(
          show.day,
          show.stationDomain,
          show.dj,
          show.title,
          show.start,
          show.end,
          show.style
        );
      }
    });

    transaction(shows);
  }

  // Cleanup methods
  async cleanupOldData(): Promise<void> {
    const stmt = this.db.prepare(cleanupOldData(config.retentionDays));
    const result = stmt.run();
    logger.info(`Cleaned up old data: ${result.changes} records removed`);
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const stmt = this.db.prepare('SELECT 1');
      stmt.get();
      return true;
    } catch (error) {
      logger.error('Database health check failed:', error);
      return false;
    }
  }

  // Bot User methods
  async upsertBotUser(user: Omit<BotUser, 'createdAt' | 'updatedAt'>): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO bot_users (telegram_id, username, first_name, last_name, language_code, is_active, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(telegram_id) DO UPDATE SET
        username = excluded.username,
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        language_code = excluded.language_code,
        is_active = excluded.is_active,
        updated_at = CURRENT_TIMESTAMP
    `);
    stmt.run(user.telegramId, user.username, user.firstName, user.lastName, user.languageCode, user.isActive ? 1 : 0);
  }

  async getBotUser(telegramId: number): Promise<BotUser | null> {
    const stmt = this.db.prepare('SELECT * FROM bot_users WHERE telegram_id = ?');
    const result = stmt.get(telegramId) as any;
    if (!result) return null;
    
    return {
      telegramId: result.telegram_id,
      username: result.username,
      firstName: result.first_name,
      lastName: result.last_name,
      languageCode: result.language_code,
      isActive: Boolean(result.is_active),
      createdAt: new Date(result.created_at),
      updatedAt: new Date(result.updated_at)
    };
  }

  // Bot User Preferences methods
  async upsertBotUserPreferences(preferences: Omit<BotUserPreferences, 'createdAt' | 'updatedAt'>): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO bot_user_preferences (telegram_id, notification_times, timezone, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(telegram_id) DO UPDATE SET
        notification_times = excluded.notification_times,
        timezone = excluded.timezone,
        updated_at = CURRENT_TIMESTAMP
    `);
    const notificationTimesJson = JSON.stringify(preferences.notificationTimes);
    stmt.run(preferences.telegramId, notificationTimesJson, preferences.timezone);
  }

  async getBotUserPreferences(telegramId: number): Promise<BotUserPreferences | null> {
    const stmt = this.db.prepare('SELECT * FROM bot_user_preferences WHERE telegram_id = ?');
    const result = stmt.get(telegramId) as any;
    if (!result) return null;
    
    let notificationTimes: string[];
    try {
      notificationTimes = JSON.parse(result.notification_times || '["2h"]');
    } catch {
      // Fallback for old format
      notificationTimes = result.notification_hours_before ? [`${result.notification_hours_before}h`] : ['2h'];
    }
    
    return {
      telegramId: result.telegram_id,
      notificationTimes,
      timezone: result.timezone,
      createdAt: new Date(result.created_at),
      updatedAt: new Date(result.updated_at)
    };
  }

  // Bot Favorite DJs methods
  async addBotFavoriteDJ(telegramId: number, stationDomain: string, djName: string): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO bot_favorite_djs (telegram_id, station_domain, dj_name)
      VALUES (?, ?, ?)
      ON CONFLICT(telegram_id, station_domain, dj_name) DO NOTHING
    `);
    stmt.run(telegramId, stationDomain, djName);
  }

  async removeBotFavoriteDJ(telegramId: number, stationDomain: string, djName: string): Promise<void> {
    const stmt = this.db.prepare(`
      DELETE FROM bot_favorite_djs 
      WHERE telegram_id = ? AND station_domain = ? AND dj_name = ?
    `);
    stmt.run(telegramId, stationDomain, djName);
  }

  async getBotFavoriteDJs(telegramId: number): Promise<BotFavoriteDJ[]> {
    const stmt = this.db.prepare('SELECT * FROM bot_favorite_djs WHERE telegram_id = ? ORDER BY station_domain, dj_name');
    const results = stmt.all(telegramId) as any[];
    
    return results.map(result => ({
      id: result.id,
      telegramId: result.telegram_id,
      stationDomain: result.station_domain,
      djName: result.dj_name,
      createdAt: new Date(result.created_at)
    }));
  }

  // Bot DJs methods
  async upsertBotDJ(dj: Omit<BotDJ, 'id' | 'lastUpdated'>): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO bot_djs (station_domain, dj_name, real_name, is_active, last_updated)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(station_domain, dj_name) DO UPDATE SET
        real_name = excluded.real_name,
        is_active = excluded.is_active,
        last_updated = CURRENT_TIMESTAMP
    `);
    stmt.run(dj.stationDomain, dj.djName, dj.realName, dj.isActive ? 1 : 0);
  }

  async getBotDJs(stationDomain?: string): Promise<BotDJ[]> {
    let query = 'SELECT * FROM bot_djs WHERE is_active = 1';
    const params: any[] = [];
    
    if (stationDomain) {
      query += ' AND station_domain = ?';
      params.push(stationDomain);
    }
    
    query += ' ORDER BY station_domain, dj_name';
    
    const stmt = this.db.prepare(query);
    const results = stmt.all(...params) as any[];
    
    return results.map(result => ({
      id: result.id,
      stationDomain: result.station_domain,
      djName: result.dj_name,
      realName: result.real_name,
      isActive: Boolean(result.is_active),
      lastUpdated: new Date(result.last_updated)
    }));
  }

  // Bot Notifications methods
  async markNotificationSent(telegramId: number, showId: number, notificationType: string): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO bot_notifications_sent (telegram_id, show_id, notification_type)
      VALUES (?, ?, ?)
      ON CONFLICT(telegram_id, show_id, notification_type) DO NOTHING
    `);
    stmt.run(telegramId, showId, notificationType);
  }

  async isNotificationSent(telegramId: number, showId: number, notificationType: string): Promise<boolean> {
    const stmt = this.db.prepare(`
      SELECT 1 FROM bot_notifications_sent 
      WHERE telegram_id = ? AND show_id = ? AND notification_type = ?
    `);
    const result = stmt.get(telegramId, showId, notificationType);
    return Boolean(result);
  }

  async getActiveBotUsers(): Promise<BotUser[]> {
    const stmt = this.db.prepare('SELECT * FROM bot_users WHERE is_active = 1');
    const results = stmt.all() as any[];
    
    return results.map(result => ({
      telegramId: result.telegram_id,
      username: result.username,
      firstName: result.first_name,
      lastName: result.last_name,
      languageCode: result.language_code,
      isActive: Boolean(result.is_active),
      createdAt: new Date(result.created_at),
      updatedAt: new Date(result.updated_at)
    }));
  }

  close(): void {
    this.db.close();
  }
}

export const db = new DatabaseManager();
