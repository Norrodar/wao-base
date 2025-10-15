# WAO-Base - Sendeplan Scraper

Ein Node.js/TypeScript-Service mit Web-GUI, der Sendepläne von FM-Stationen (technobase.fm, housetime.fm) scraped, in SQLite speichert und per REST-API + GUI als JSON anzeigt/exportiert.

## Features

- 🎵 **Multi-Station Support**: Technobase.FM, Housetime.FM und weitere
- 📅 **Automatisches Scraping**: Cron-basierte Aktualisierung
- 🗄️ **SQLite Storage**: Lokale Datenbank mit Retention-Policy
- 🌐 **REST API**: Vollständige API für Datenzugriff
- 💻 **Web GUI**: Dark Theme React-Frontend
- 🐳 **Docker Support**: Ready für Unraid/Container
- 📊 **Health Monitoring**: Healthcheck-Endpoint
- 🔄 **JSON Export**: Download von Sendeplandaten
- 📅 **CalDAV Support**: iCalendar-Integration für Kalender-Apps
- 🤖 **Telegram Bot**: DJ-Benachrichtigungen und Sendeplan-Abfragen

## Unterstütze Stationen
- https://www.technobase.fm/ 
- https://www.housetime.fm/ 
- https://www.hardbase.fm/ 
- https://www.trancebase.fm/ 
- https://www.coretime.fm/ 
- https://www.clubtime.fm/ 
- https://www.teatime.fm/ 
- https://www.replay.fm/ 

## Architektur

### Backend
- **Node.js 20** + **TypeScript**
- **Fastify** Web-Framework
- **Cheerio** HTML-Parsing
- **better-sqlite3** Datenbank
- **node-cron** Scheduling
- **Pino** Logging
- **ical-generator** CalDAV/iCalendar
- **node-telegram-bot-api** Telegram Bot

### Frontend
- **React 18** + **TypeScript**
- **Vite** Build-Tool
- **Lucide React** Icons
- Dark Theme UI

### Datenmodell
```sql
stations(domain UNIQUE)
days(station_domain, day ISO YYYY-MM-DD, UNIQUE(station_domain, day))
shows(day, dj, title, start, end, style, UNIQUE(day, dj, title, start, end))
```

## Installation

### Docker (Empfohlen)

1. **Repository klonen**:
```bash
git clone <repository-url>
cd wao-base
```

2. **Environment konfigurieren**:
```bash
cp env.example .env
# .env bearbeiten
```

3. **Container starten**:
```bash
docker compose up -d --build
```

### Lokale Entwicklung

1. **Dependencies installieren**:
```bash
npm install
cd frontend && npm install
```

2. **Backend starten**:
```bash
npm run dev:backend
```

3. **Frontend starten** (neues Terminal):
```bash
npm run dev:frontend
```

## Konfiguration

### Environment Variables

```bash
# Zeitzone
WAOBASE_TZ=Europe/Berlin

# Container User (Unraid)
WAOBASE_PUID=1000
WAOBASE_PGID=1000

# Server
WAOBASE_PORT=8080
WAOBASE_BASE_URL=http://wao-base.local

# Stationen (kommagetrennt)
WAOBASE_STATIONS=technobase.fm,housetime.fm

# Cron Schedule (alle 2 Stunden)
WAOBASE_CRON_SCHEDULE=0 */2 * * *

# Datenretention (Tage)
WAOBASE_RETENTION_DAYS=60

# Proxy (optional)
WAOBASE_HTTP_PROXY=
WAOBASE_HTTPS_PROXY=

# Logging
WAOBASE_LOG_LEVEL=info
WAOBASE_NODE_ENV=production

# Telegram Bot
WAOBASE_TELEGRAM_ENABLED=false
WAOBASE_TELEGRAM_BOT_TOKEN=your_bot_token_here
WAOBASE_TELEGRAM_WEBHOOK_URL=https://your-domain.com/bot/webhook
```

### Cron Schedule Beispiele

```bash
# Alle 2 Stunden
WAOBASE_CRON_SCHEDULE=0 */2 * * *

# Alle 30 Minuten
WAOBASE_CRON_SCHEDULE=*/30 * * * *

# Täglich um 6 Uhr
WAOBASE_CRON_SCHEDULE=0 6 * * *

# Montag bis Freitag alle 2 Stunden
WAOBASE_CRON_SCHEDULE=0 */2 * * 1-5
```

## API Endpoints

### Health
- `GET /health` - System Health Check

### Stationen
- `GET /api/stations` - Alle Stationen

### Sendeplan
- `GET /api/schedule?station=technobase.fm&date=2025-01-15` - Sendeplan für Datum
- `GET /api/schedule/range?station=technobase.fm&from=2025-01-15&to=2025-01-20` - Sendeplan für Zeitraum

### Scraper
- `POST /api/scrape` - Manueller Scrape
  ```json
  {
    "station": "technobase.fm",
    "dates": ["2025-01-15", "2025-01-16"]
  }
  ```

### Konfiguration
- `GET /api/config` - Aktuelle Konfiguration
- `PUT /api/config` - Konfiguration aktualisieren

### Status
- `GET /api/status` - Scraper Status

### Bot (wenn aktiviert)
- `GET /api/bot/status` - Bot und Notification Status
- `GET /api/bot/djs` - Verfügbare DJs
- `GET /api/bot/users` - Aktive Bot-User
- `POST /api/bot/scrape-djs` - DJ-Liste aktualisieren
- `POST /api/bot/test-notification` - Test-Benachrichtigung senden

### CalDAV
- `GET /caldav` - Verfügbare Kalender
- `GET /caldav/:station/calendar.ics` - iCalendar-Datei für Station
- `GET /caldav/:station/info` - Kalender-Informationen
- `PROPFIND /caldav/:station/` - CalDAV Discovery (für erweiterte Clients)

## Web GUI

Das Frontend ist unter `http://localhost:8080` verfügbar:

### Dashboard
- **Station auswählen**: Dropdown mit verfügbaren Stationen
- **Datum wählen**: Datepicker für Sendeplan
- **Aktualisieren**: Manueller Scrape-Trigger
- **JSON Export**: Download der Sendeplandaten

### CalDAV
- **Kalender-Übersicht**: Verfügbare CalDAV-Kalender
- **URL-Kopieren**: Einfaches Kopieren der Kalender-URLs
- **App-Integration**: Anleitungen für verschiedene Kalender-Apps

### Config
- **Stationen**: Übersicht konfigurierter Stationen
- **Einstellungen**: Cron Schedule, Retention, etc.

## Docker für Unraid

### docker-compose.yml
```yaml
version: '3.8'
services:
  wao-base:
    build: .
    container_name: wao-base
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      - TZ=${TZ:-Europe/Berlin}
      - PUID=${PUID:-1000}
      - PGID=${PGID:-1000}
      # ... weitere env vars
    volumes:
      - ./data:/app/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### Volume Mapping
- `./data:/app/data` - SQLite Datenbank

## Entwicklung

### Tests
```bash
npm test
npm run test:watch
```

### Linting
```bash
npm run lint
npm run lint:fix
```

### Build
```bash
npm run build
```

## Scraper Details

### HTML-Parsing
Der Scraper analysiert die HTML-Struktur der Sendeplan-Seiten:

```html
<div class="content-list schedule-list">
  <div class="item" itemtype="http://schema.org/BroadcastEvent">
    <div class="time-djname">
      <h2 class="title">
        <span itemprop="startDate">08:00</span>
      </h2>
    </div>
    <div class="description">
      <div class="show-info">
        <div class="dj-row">
          <span itemprop="dj">DJ Name</span>
        </div>
        <div class="title-row">
          <span itemprop="name">Show Title</span>
        </div>
        <div class="genre-row">
          <span itemprop="genre">Style</span>
        </div>
      </div>
    </div>
  </div>
</div>
```

### Robuste Fehlerbehandlung
- Graceful Handling leerer Tage
- Fallback für fehlende Endzeiten
- Retry-Logik bei Netzwerkfehlern
- Validierung der geparsten Daten

## CalDAV Integration

### Kalender abonnieren

Die Sendepläne können direkt in Kalender-Apps abonniert werden:

#### Verfügbare Kalender-URLs
- **Technobase.FM**: `http://localhost:8080/caldav/technobase.fm/calendar.ics`
- **Housetime.FM**: `http://localhost:8080/caldav/housetime.fm/calendar.ics`

#### Kalender-App Integration

**Microsoft Outlook:**
1. Datei → Konto hinzufügen
2. "Internetkalender" auswählen
3. Kalender-URL einfügen
4. "Hinzufügen" klicken

**Apple Calendar:**
1. Ablage → Neues Abonnement
2. Kalender-URL einfügen
3. "Abonnieren" klicken

**Google Calendar:**
1. "+" → "Aus URL"
2. Kalender-URL einfügen
3. "Kalender hinzufügen" klicken

**Thunderbird:**
1. Kalender → Neuer Kalender
2. "Im Netzwerk" auswählen
3. Kalender-URL einfügen

### Kalender-Features

- **Automatische Updates**: Kalender werden alle 5 Minuten aktualisiert
- **Event-Details**: DJ, Show-Titel, Style, Start-/Endzeit
- **Erinnerungen**: 15 Minuten vor Show-Start
- **Tagesübersicht**: Zusätzliche Events mit Tageszusammenfassung
- **Zeitbereich**: Standardmäßig 7 Tage, konfigurierbar via `?days=N` Parameter

### CalDAV-Endpoints

```bash
# Kalender-Übersicht
GET /caldav

# iCalendar-Datei (7 Tage)
GET /caldav/technobase.fm/calendar.ics

# iCalendar-Datei (30 Tage)
GET /caldav/technobase.fm/calendar.ics?days=30

# Kalender-Informationen
GET /caldav/technobase.fm/info

# CalDAV Discovery (für erweiterte Clients)
PROPFIND /caldav/technobase.fm/
```

## Telegram Bot

### Bot Setup

1. **Bot erstellen:**
   - Chat mit [@BotFather](https://t.me/botfather) auf Telegram
   - `/newbot` → Bot-Name und Username wählen
   - Token kopieren und in `.env` eintragen

2. **Bot aktivieren:**
   ```bash
   WAOBASE_TELEGRAM_ENABLED=true
   WAOBASE_TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
   ```

3. **Container neu starten:**
   ```bash
   docker compose restart
   ```

### Bot Commands

**🎵 /waobot** - Bot starten und Willkommensnachricht  
**🎧 /djs** - Deine Lieblings-DJs anzeigen  
**➕ /adddj <Name>** - DJ zu Favoriten hinzufügen  
**➖ /removedj <Name>** - DJ aus Favoriten entfernen  
**⏰ /notify <Zeit>** - Benachrichtigungszeiten ändern  
**📅 /schedule** - Heutigen Sendeplan anzeigen  
**❓ /help** - Hilfe anzeigen  

### Bot Features

- **DJ-Favoriten**: Persönliche DJ-Liste pro User
- **Benachrichtigungen**: Flexible Zeitformate (30m, 4.5h, 1d) mit Komma-Trennung
- **Multi-Station**: Unterstützt alle konfigurierten Stationen
- **Smart Matching**: Erkennt DJs auch bei Namensvariationen
- **Inline Keyboard**: Benutzerfreundliche Auswahlmenüs

### Beispiel-Interaktion

```
User: /waobot
Bot: 🎵 Willkommen beim WAO-Base Bot!
     Hallo Max! 👋
     Ich benachrichtige dich, wenn deine Lieblings-DJs on air gehen.

User: /adddj Cloud Seven
Bot: ✅ DJ Cloud Seven zu deinen Lieblings-DJs hinzugefügt!
     Station: Technobase.FM

User: /notify 30m, 4h, 1d
Bot: ✅ Benachrichtigungseinstellung aktualisiert!
     Du wirst jetzt 30m, 4h, 1d vor Show-Start benachrichtigt.

[4 Stunden vor Show-Start]
Bot: 🎵 Show-Erinnerung (4h vorher)!
     DJ Cloud Seven legt heute um 20:00 auf Technobase.FM auf!
     🎧 Show: Kellerkirmes
     🎭 Style: Hands Up / Dance
     ⏰ Zeit: 20:00 - 22:00
```

### DJ-Scraper

Der Bot scraped automatisch die DJ-Listen von allen Stationen:

- **Technobase.FM**: [Team-Seite](https://www.technobase.fm/team) - Resident DJs
- **Housetime.FM**: Team-Seite - Resident DJs  
- **Hardbase.FM**: Team-Seite - Resident DJs
- **Trancebase.FM**: Team-Seite - Resident DJs
- **Coretime.FM**: Team-Seite - Resident DJs
- **Clubtime.FM**: Team-Seite - Resident DJs
- **Teatime.FM**: Team-Seite - Resident DJs
- **Replay.FM**: Team-Seite - Resident DJs

**Beispiel-DJs:**
- DJ Cloud Seven (Dennis K.)
- DJ TiRa (Timo R.)
- DJ Salvatore (Silvio H.)
- Tim Noiz (Tim D.)
- Petsch (Patrick K.)
- Voggi (Sven V.)

### Notification-System

- **Cron-Job**: Läuft alle 15 Minuten
- **Zeitfenster**: 15-Minuten-Toleranz für Benachrichtigungen
- **Duplikat-Schutz**: Verhindert mehrfache Benachrichtigungen
- **Flexible Zeiten**: 30m, 4.5h, 1d, etc. mit Komma-Trennung
- **User-Präferenzen**: Individuelle Benachrichtigungszeiten pro User
- **Multi-Station**: Benachrichtigungen für alle Stationen

## Erweiterungen

### Telegram Bot ✅
- Vollständig implementiert und funktionsfähig
- DJ-Favoriten und erweiterte Benachrichtigungen
- Flexible Zeitformate (30m, 4.5h, 1d) mit Komma-Trennung
- Multi-Station Support

### Weitere Stationen
Neue Stationen können einfach hinzugefügt werden:
1. Station zur `STATIONS` Environment-Variable hinzufügen
2. Bei Bedarf Scraper-Logik anpassen
3. Container neu starten

## Troubleshooting

### Container startet nicht
```bash
docker compose logs wao-base
```

### Health Check schlägt fehl
```bash
curl http://localhost:8080/health
```

### Keine Daten im Frontend
1. Scraper-Status prüfen: `GET /api/status`
2. Manuellen Scrape starten: `POST /api/scrape`
3. Logs prüfen: `docker compose logs -f wao-base`

### Datenbank-Probleme
```bash
# Datenbank zurücksetzen
docker compose down
rm -rf data/
docker compose up -d
```

## Lizenz

MIT License - siehe LICENSE Datei für Details.
