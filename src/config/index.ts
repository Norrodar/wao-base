export const config = {
  port: parseInt(process.env.WAOBASE_PORT || '8080', 10),
  baseUrl: process.env.WAOBASE_BASE_URL || 'http://localhost:8080',
  stations: (process.env.WAOBASE_STATIONS || 'technobase.fm').split(',').map(s => s.trim()),
  cronSchedule: process.env.WAOBASE_CRON_SCHEDULE || '0 */2 * * *',
  retentionDays: parseInt(process.env.WAOBASE_RETENTION_DAYS || '60', 10),
  httpProxy: process.env.WAOBASE_HTTP_PROXY || undefined,
  httpsProxy: process.env.WAOBASE_HTTPS_PROXY || undefined,
  nodeEnv: process.env.WAOBASE_NODE_ENV || 'development',
  logLevel: process.env.WAOBASE_LOG_LEVEL || 'info',
  timezone: process.env.WAOBASE_TZ || 'Europe/Berlin',
  puid: parseInt(process.env.WAOBASE_PUID || '1000', 10),
  pgid: parseInt(process.env.WAOBASE_PGID || '1000', 10),
  dataDir: process.env.WAOBASE_DATA_DIR || './data',
  // Telegram Bot
  telegramBotToken: process.env.WAOBASE_TELEGRAM_BOT_TOKEN || '',
  telegramWebhookUrl: process.env.WAOBASE_TELEGRAM_WEBHOOK_URL || '',
  telegramEnabled: process.env.WAOBASE_TELEGRAM_ENABLED === 'true',
} as const;

export type Config = typeof config;
