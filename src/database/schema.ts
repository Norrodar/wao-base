export const createTables = `
-- Stations table
CREATE TABLE IF NOT EXISTS stations (
  domain TEXT PRIMARY KEY,
  name TEXT,
  enabled BOOLEAN DEFAULT 1,
  last_scraped DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Days table
CREATE TABLE IF NOT EXISTS days (
  station_domain TEXT NOT NULL,
  day TEXT NOT NULL, -- ISO YYYY-MM-DD
  scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (station_domain, day),
  FOREIGN KEY (station_domain) REFERENCES stations(domain) ON DELETE CASCADE
);

-- Shows table
CREATE TABLE IF NOT EXISTS shows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day TEXT NOT NULL, -- ISO YYYY-MM-DD
  station_domain TEXT NOT NULL,
  dj TEXT NOT NULL,
  title TEXT NOT NULL,
  start_time TEXT NOT NULL, -- HH:MM
  end_time TEXT NOT NULL, -- HH:MM
  style TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(day, station_domain, dj, title, start_time, end_time),
  FOREIGN KEY (station_domain) REFERENCES stations(domain) ON DELETE CASCADE
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_shows_day ON shows(day);
CREATE INDEX IF NOT EXISTS idx_shows_station ON shows(station_domain);
CREATE INDEX IF NOT EXISTS idx_shows_day_station ON shows(day, station_domain);
CREATE INDEX IF NOT EXISTS idx_days_station ON days(station_domain);
CREATE INDEX IF NOT EXISTS idx_days_day ON days(day);

-- Bot tables
CREATE TABLE IF NOT EXISTS bot_users (
  telegram_id INTEGER PRIMARY KEY,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  language_code TEXT DEFAULT 'de',
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bot_user_preferences (
  telegram_id INTEGER NOT NULL,
  notification_times TEXT DEFAULT '2h', -- JSON array of notification times
  timezone TEXT DEFAULT 'Europe/Berlin',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (telegram_id),
  FOREIGN KEY (telegram_id) REFERENCES bot_users(telegram_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bot_favorite_djs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id INTEGER NOT NULL,
  station_domain TEXT NOT NULL,
  dj_name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(telegram_id, station_domain, dj_name),
  FOREIGN KEY (telegram_id) REFERENCES bot_users(telegram_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bot_djs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  station_domain TEXT NOT NULL,
  dj_name TEXT NOT NULL,
  real_name TEXT,
  is_active BOOLEAN DEFAULT 1,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(station_domain, dj_name)
);

CREATE TABLE IF NOT EXISTS bot_notifications_sent (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id INTEGER NOT NULL,
  show_id INTEGER NOT NULL,
  notification_type TEXT NOT NULL, -- 'upcoming_show'
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(telegram_id, show_id, notification_type),
  FOREIGN KEY (telegram_id) REFERENCES bot_users(telegram_id) ON DELETE CASCADE,
  FOREIGN KEY (show_id) REFERENCES shows(id) ON DELETE CASCADE
);

-- Bot indexes
CREATE INDEX IF NOT EXISTS idx_bot_users_active ON bot_users(is_active);
CREATE INDEX IF NOT EXISTS idx_bot_favorite_djs_user ON bot_favorite_djs(telegram_id);
CREATE INDEX IF NOT EXISTS idx_bot_favorite_djs_station ON bot_favorite_djs(station_domain);
CREATE INDEX IF NOT EXISTS idx_bot_djs_station ON bot_djs(station_domain);
CREATE INDEX IF NOT EXISTS idx_bot_djs_active ON bot_djs(is_active);
CREATE INDEX IF NOT EXISTS idx_bot_notifications_sent_user ON bot_notifications_sent(telegram_id);
CREATE INDEX IF NOT EXISTS idx_bot_notifications_sent_show ON bot_notifications_sent(show_id);
`;

export const cleanupOldData = (retentionDays: number) => `
DELETE FROM shows 
WHERE day < date('now', '-${retentionDays} days');

DELETE FROM days 
WHERE day < date('now', '-${retentionDays} days');
`;
