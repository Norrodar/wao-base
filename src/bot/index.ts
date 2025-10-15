import TelegramBot from 'node-telegram-bot-api';
import { config } from '../config';
import { logger } from '../utils/logger';
import { db, BotUser, BotUserPreferences, BotFavoriteDJ } from '../database';
import { DJScraperService } from '../services/dj-scraper';
import { Show } from '../types';
import { parseNotificationTimes, formatNotificationTime, isValidNotificationTimes } from '../utils/time-parser';

export class TelegramBotService {
  private bot: TelegramBot | null = null;
  private djScraper: DJScraperService;
  private isRunning = false;

  constructor() {
    this.djScraper = new DJScraperService();
  }

  async start(): Promise<void> {
    if (!config.telegramEnabled || !config.telegramBotToken) {
      logger.info('Telegram bot is disabled or token not configured');
      return;
    }

    try {
      this.bot = new TelegramBot(config.telegramBotToken, { polling: true });
      this.isRunning = true;

      this.setupCommands();
      this.setupMessageHandlers();

      logger.info('Telegram bot started successfully');
    } catch (error) {
      logger.error('Failed to start Telegram bot:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.bot) {
      await this.bot.stopPolling();
      this.bot = null;
      this.isRunning = false;
      logger.info('Telegram bot stopped');
    }
  }

  private setupCommands(): void {
    if (!this.bot) return;

    // Set bot commands
    this.bot.setMyCommands([
      { command: 'waobot', description: '🎵 Sendeplan Bot starten' },
      { command: 'djs', description: '🎧 Meine Lieblings-DJs anzeigen' },
      { command: 'adddj', description: '➕ DJ zu Favoriten hinzufügen' },
      { command: 'removedj', description: '➖ DJ aus Favoriten entfernen' },
      { command: 'notify', description: '⏰ Benachrichtigungseinstellungen' },
      { command: 'schedule', description: '📅 Heutiger Sendeplan' },
      { command: 'help', description: '❓ Hilfe anzeigen' }
    ]);
  }

  private setupMessageHandlers(): void {
    if (!this.bot) return;

    // Handle /waobot command
    this.bot.onText(/\/waobot/, async (msg) => {
      await this.handleWaobotCommand(msg);
    });

    // Handle /djs command
    this.bot.onText(/\/djs/, async (msg) => {
      await this.handleDJsCommand(msg);
    });

    // Handle /adddj command
    this.bot.onText(/\/adddj\s+(.+)/, async (msg, match) => {
      await this.handleAddDJCommand(msg, match);
    });

    // Handle /removedj command
    this.bot.onText(/\/removedj\s+(.+)/, async (msg, match) => {
      await this.handleRemoveDJCommand(msg, match);
    });

    // Handle /notify command
    this.bot.onText(/\/notify\s+(\d+)/, async (msg, match) => {
      await this.handleNotifyCommand(msg, match);
    });

    // Handle /schedule command
    this.bot.onText(/\/schedule/, async (msg) => {
      await this.handleScheduleCommand(msg);
    });

    // Handle /help command
    this.bot.onText(/\/help/, async (msg) => {
      await this.handleHelpCommand(msg);
    });

    // Handle callback queries (inline keyboard)
    this.bot.on('callback_query', async (query) => {
      await this.handleCallbackQuery(query);
    });

    // Handle new users
    this.bot.on('message', async (msg) => {
      if (msg.from) {
        await this.ensureUserExists(msg.from);
      }
    });
  }

  private async handleWaobotCommand(msg: TelegramBot.Message): Promise<void> {
    if (!this.bot || !msg.from) return;

    const user = await this.ensureUserExists(msg.from);
    const preferences = await this.getUserPreferences(user.telegramId);

    const welcomeText = `🎵 **Willkommen beim WAO-Base Bot!**

Hallo ${user.firstName || 'DJ-Fan'}! 👋

Ich benachrichtige dich, wenn deine Lieblings-DJs on air gehen.

**Deine aktuellen Einstellungen:**
• Benachrichtigung: ${preferences.notificationTimes.map(t => formatNotificationTime(parseNotificationTimes(t)[0])).join(', ')} vor Show-Start
• Lieblings-DJs: ${(await db.getBotFavoriteDJs(user.telegramId)).length} ausgewählt

**Verfügbare Befehle:**
/djs - Deine Lieblings-DJs anzeigen
/adddj <Name> - DJ hinzufügen
/removedj <Name> - DJ entfernen
/notify <Stunden> - Benachrichtigungszeit ändern
/schedule - Heutigen Sendeplan anzeigen
/help - Hilfe anzeigen

Lass uns loslegen! 🚀`;

    await this.bot.sendMessage(msg.chat.id, welcomeText, { parse_mode: 'Markdown' });
  }

  private async handleDJsCommand(msg: TelegramBot.Message): Promise<void> {
    if (!this.bot || !msg.from) return;

    const favoriteDJs = await db.getBotFavoriteDJs(msg.from.id);
    
    if (favoriteDJs.length === 0) {
      await this.bot.sendMessage(msg.chat.id, 
        '🎧 Du hast noch keine Lieblings-DJs ausgewählt.\n\n' +
        'Verwende /adddj <Name> um DJs hinzuzufügen.\n' +
        'Beispiel: /adddj DJ Cloud Seven'
      );
      return;
    }

    let text = '🎧 **Deine Lieblings-DJs:**\n\n';
    
    // Group by station
    const djsByStation = favoriteDJs.reduce((acc, dj) => {
      if (!acc[dj.stationDomain]) {
        acc[dj.stationDomain] = [];
      }
      acc[dj.stationDomain].push(dj);
      return acc;
    }, {} as Record<string, BotFavoriteDJ[]>);

    for (const [station, djs] of Object.entries(djsByStation)) {
      text += `**${this.getStationName(station)}:**\n`;
      for (const dj of djs) {
        text += `• ${dj.djName}\n`;
      }
      text += '\n';
    }

    text += 'Verwende /removedj <Name> um DJs zu entfernen.';

    await this.bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
  }

  private async handleAddDJCommand(msg: TelegramBot.Message, match: RegExpExecArray | null): Promise<void> {
    if (!this.bot || !msg.from || !match) return;

    const djQuery = match[1].trim();
    const searchResults = await this.djScraper.searchDJs(djQuery);

    if (searchResults.length === 0) {
      await this.bot.sendMessage(msg.chat.id, 
        `❌ Keine DJs gefunden für "${djQuery}".\n\n` +
        'Versuche es mit einem anderen Namen oder verwende /help für mehr Informationen.'
      );
      return;
    }

    if (searchResults.length === 1) {
      // Add single DJ
      const dj = searchResults[0];
      await db.addBotFavoriteDJ(msg.from.id, dj.stationDomain, dj.djName);
      
      await this.bot.sendMessage(msg.chat.id, 
        `✅ **${dj.djName}** zu deinen Lieblings-DJs hinzugefügt!\n\n` +
        `Station: ${this.getStationName(dj.stationDomain)}`
      );
    } else {
      // Show selection menu
      const keyboard = searchResults.map(dj => [
        {
          text: `${dj.djName} (${this.getStationName(dj.stationDomain)})`,
          callback_data: `add_dj:${dj.stationDomain}:${dj.djName}`
        }
      ]);

      await this.bot.sendMessage(msg.chat.id, 
        `🔍 Mehrere DJs gefunden für "${djQuery}":\n\nWähle einen aus:`,
        {
          reply_markup: {
            inline_keyboard: keyboard
          }
        }
      );
    }
  }

  private async handleRemoveDJCommand(msg: TelegramBot.Message, match: RegExpExecArray | null): Promise<void> {
    if (!this.bot || !msg.from || !match) return;

    const djQuery = match[1].trim();
    const favoriteDJs = await db.getBotFavoriteDJs(msg.from.id);
    
    const matchingDJs = favoriteDJs.filter(dj => 
      dj.djName.toLowerCase().includes(djQuery.toLowerCase())
    );

    if (matchingDJs.length === 0) {
      await this.bot.sendMessage(msg.chat.id, 
        `❌ Kein Lieblings-DJ gefunden für "${djQuery}".\n\n` +
        'Verwende /djs um deine aktuellen Lieblings-DJs anzuzeigen.'
      );
      return;
    }

    if (matchingDJs.length === 1) {
      // Remove single DJ
      const dj = matchingDJs[0];
      await db.removeBotFavoriteDJ(msg.from.id, dj.stationDomain, dj.djName);
      
      await this.bot.sendMessage(msg.chat.id, 
        `✅ **${dj.djName}** aus deinen Lieblings-DJs entfernt!`
      );
    } else {
      // Show selection menu
      const keyboard = matchingDJs.map(dj => [
        {
          text: `${dj.djName} (${this.getStationName(dj.stationDomain)})`,
          callback_data: `remove_dj:${dj.stationDomain}:${dj.djName}`
        }
      ]);

      await this.bot.sendMessage(msg.chat.id, 
        `🔍 Mehrere Lieblings-DJs gefunden für "${djQuery}":\n\nWähle einen zum Entfernen:`,
        {
          reply_markup: {
            inline_keyboard: keyboard
          }
        }
      );
    }
  }

  private async handleNotifyCommand(msg: TelegramBot.Message, match: RegExpExecArray | null): Promise<void> {
    if (!this.bot || !msg.from || !match) return;

    const timeInput = match[1].trim();
    
    // Validate input
    if (!isValidNotificationTimes(timeInput)) {
      await this.bot.sendMessage(msg.chat.id, 
        '❌ Ungültiges Zeitformat!\n\n' +
        '**Gültige Formate:**\n' +
        '• `30m` - 30 Minuten\n' +
        '• `4.5h` - 4,5 Stunden\n' +
        '• `1d` - 1 Tag\n' +
        '• `30m, 4h, 1d` - Mehrere Zeiten (kommagetrennt)\n\n' +
        '**Beispiele:**\n' +
        '• `/notify 30m`\n' +
        '• `/notify 4.5h`\n' +
        '• `/notify 1d`\n' +
        '• `/notify 30m, 4h, 1d`',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    try {
      const notificationTimes = timeInput.split(',').map(t => t.trim());
      
      await db.upsertBotUserPreferences({
        telegramId: msg.from.id,
        notificationTimes,
        timezone: 'Europe/Berlin'
      });

      const formattedTimes = notificationTimes.map(t => 
        formatNotificationTime(parseNotificationTimes(t)[0])
      ).join(', ');

      await this.bot.sendMessage(msg.chat.id, 
        `✅ Benachrichtigungseinstellung aktualisiert!\n\n` +
        `Du wirst jetzt ${formattedTimes} vor Show-Start benachrichtigt.`
      );
    } catch (error) {
      await this.bot.sendMessage(msg.chat.id, 
        '❌ Fehler beim Speichern der Einstellungen. Bitte versuche es erneut.'
      );
    }
  }

  private async handleScheduleCommand(msg: TelegramBot.Message): Promise<void> {
    if (!this.bot || !msg.from) return;

    const today = new Date().toISOString().split('T')[0];
    const favoriteDJs = await db.getBotFavoriteDJs(msg.from.id);
    
    if (favoriteDJs.length === 0) {
      await this.bot.sendMessage(msg.chat.id, 
        '🎧 Du hast noch keine Lieblings-DJs ausgewählt.\n\n' +
        'Verwende /adddj <Name> um DJs hinzuzufügen.'
      );
      return;
    }

    let text = `📅 **Heutiger Sendeplan für deine Lieblings-DJs:**\n\n`;
    let hasShows = false;

    // Get shows for each favorite DJ
    for (const favoriteDJ of favoriteDJs) {
      const shows = await db.getShows(favoriteDJ.stationDomain, today);
      const djShows = shows.filter(show => 
        show.dj.toLowerCase().includes(favoriteDJ.djName.toLowerCase()) ||
        favoriteDJ.djName.toLowerCase().includes(show.dj.toLowerCase())
      );

      if (djShows.length > 0) {
        hasShows = true;
        text += `**${favoriteDJ.djName}** (${this.getStationName(favoriteDJ.stationDomain)}):\n`;
        
        for (const show of djShows) {
          text += `• ${show.start} - ${show.title}\n`;
        }
        text += '\n';
      }
    }

    if (!hasShows) {
      text = '📅 **Heutiger Sendeplan:**\n\n' +
             'Keine Shows deiner Lieblings-DJs heute. 😢\n\n' +
             'Verwende /adddj um mehr DJs hinzuzufügen!';
    }

    await this.bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
  }

  private async handleHelpCommand(msg: TelegramBot.Message): Promise<void> {
    if (!this.bot) return;

    const helpText = `❓ **WAO-Base Bot - Hilfe**

**Verfügbare Befehle:**

🎵 /waobot - Bot starten und Willkommensnachricht
🎧 /djs - Deine Lieblings-DJs anzeigen
➕ /adddj <Name> - DJ zu Favoriten hinzufügen
➖ /removedj <Name> - DJ aus Favoriten entfernen
⏰ /notify <Zeit> - Benachrichtigungszeiten ändern
📅 /schedule - Heutigen Sendeplan anzeigen
❓ /help - Diese Hilfe anzeigen

**Beispiele:**
• /adddj Cloud Seven
• /adddj DJ TiRa
• /removedj Cloud Seven
• /notify 30m
• /notify 4.5h
• /notify 1d
• /notify 30m, 4h, 1d
• /schedule

**Tipp:** Du kannst auch Teile des DJ-Namens verwenden, z.B. "Cloud" statt "DJ Cloud Seven".

**Unterstützte Stationen:**
• Technobase.FM
• Housetime.FM
• Hardbase.FM
• Trancebase.FM
• Coretime.FM
• Clubtime.FM
• Teatime.FM
• Replay.FM

Viel Spaß beim Hören! 🎧`;

    await this.bot.sendMessage(msg.chat.id, helpText, { parse_mode: 'Markdown' });
  }

  private async handleCallbackQuery(query: TelegramBot.CallbackQuery): Promise<void> {
    if (!this.bot || !query.data || !query.message) return;

    const [action, ...params] = query.data.split(':');
    
    if (action === 'add_dj' && params.length === 2) {
      const [stationDomain, djName] = params;
      await db.addBotFavoriteDJ(query.from.id, stationDomain, djName);
      
      await this.bot.answerCallbackQuery(query.id, 
        `✅ ${djName} hinzugefügt!`);
      
      await this.bot.editMessageText(
        `✅ **${djName}** zu deinen Lieblings-DJs hinzugefügt!\n\n` +
        `Station: ${this.getStationName(stationDomain)}`,
        {
          chat_id: query.message.chat.id,
          message_id: query.message.message_id,
          parse_mode: 'Markdown'
        }
      );
    }
    
    if (action === 'remove_dj' && params.length === 2) {
      const [stationDomain, djName] = params;
      await db.removeBotFavoriteDJ(query.from.id, stationDomain, djName);
      
      await this.bot.answerCallbackQuery(query.id, 
        `✅ ${djName} entfernt!`);
      
      await this.bot.editMessageText(
        `✅ **${djName}** aus deinen Lieblings-DJs entfernt!`,
        {
          chat_id: query.message.chat.id,
          message_id: query.message.message_id,
          parse_mode: 'Markdown'
        }
      );
    }
  }

  private async ensureUserExists(from: TelegramBot.User): Promise<BotUser> {
    const existingUser = await db.getBotUser(from.id);
    
    if (existingUser) {
      // Update user info
      await db.upsertBotUser({
        telegramId: from.id,
        username: from.username,
        firstName: from.first_name,
        lastName: from.last_name,
        languageCode: from.language_code || 'de',
        isActive: true
      });
      return existingUser;
    }

    // Create new user
    const newUser: Omit<BotUser, 'createdAt' | 'updatedAt'> = {
      telegramId: from.id,
      username: from.username,
      firstName: from.first_name,
      lastName: from.last_name,
      languageCode: from.language_code || 'de',
      isActive: true
    };

    await db.upsertBotUser(newUser);
    
    // Set default preferences
    await db.upsertBotUserPreferences({
      telegramId: from.id,
      notificationTimes: ['2h'],
      timezone: 'Europe/Berlin'
    });

    return {
      ...newUser,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  private async getUserPreferences(telegramId: number): Promise<BotUserPreferences> {
    const preferences = await db.getBotUserPreferences(telegramId);
    
    if (!preferences) {
      // Create default preferences
      const defaultPrefs: Omit<BotUserPreferences, 'createdAt' | 'updatedAt'> = {
        telegramId,
        notificationTimes: ['2h'],
        timezone: 'Europe/Berlin'
      };
      
      await db.upsertBotUserPreferences(defaultPrefs);
      
      return {
        ...defaultPrefs,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }

    return preferences;
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

  async sendNotification(telegramId: number, show: Show, stationName: string, notificationTime?: string): Promise<void> {
    if (!this.bot) return;

    const timeInfo = notificationTime ? ` (${notificationTime} vorher)` : '';
    const message = `🎵 **Show-Erinnerung${timeInfo}!**

**${show.dj}** legt heute um **${show.start}** auf **${stationName}** auf!

🎧 **Show:** ${show.title}
🎭 **Style:** ${show.style}
⏰ **Zeit:** ${show.start} - ${show.end}

Viel Spaß beim Hören! 🚀`;

    try {
      await this.bot.sendMessage(telegramId, message, { parse_mode: 'Markdown' });
      logger.info(`Notification sent to user ${telegramId} for show ${show.title}`);
    } catch (error) {
      logger.error(`Failed to send notification to user ${telegramId}:`, error);
    }
  }

  getStatus(): { isRunning: boolean } {
    return { isRunning: this.isRunning };
  }
}
