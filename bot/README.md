# WAO-Base Telegram Bot

Dieser Ordner enthält die Telegram-Bot-Integration für WAO-Base.

## Features

- 📅 Sendeplan-Abfragen per Bot-Command
- 🔔 Benachrichtigungen bei neuen Shows
- 🎧 DJ-Favoriten Management
- ⏰ Flexible Benachrichtigungszeiten (30m, 4.5h, 1d)
- 📊 Multi-Station Support

## Environment Variables

```bash
# Telegram Bot
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_WEBHOOK_URL=https://your-domain.com/bot/webhook
```

## Integration

Der Bot nutzt die bestehende REST-API:
- `GET /api/schedule` für Sendeplan-Abfragen
- `GET /api/stations` für verfügbare Stationen
- `POST /api/scrape` für manuelle Updates
- `GET /api/bot/djs` für DJ-Listen

## Status

✅ **Vollständig implementiert** - Bereit für produktiven Einsatz
