import { useState, useEffect } from 'react';
import { Calendar, Settings, Download, RefreshCw, Radio, Clock, User, Music, CalendarDays, Copy, ExternalLink, Grid3X3, List, Users } from 'lucide-react';
import { api } from './api';
import { Station, Show, Config, ScraperStatus, CalendarInfo, DJ, BotStatus } from './types';
import { CalendarComponent } from './CalendarComponent';

type Tab = 'overview' | 'dashboard' | 'config' | 'caldav' | 'djs';
type ViewMode = 'calendar' | 'list';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedStation, setSelectedStation] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [shows, setShows] = useState<Show[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [status, setStatus] = useState<ScraperStatus | null>(null);
  const [calendars, setCalendars] = useState<CalendarInfo[]>([]);
  const [djs, setDjs] = useState<DJ[]>([]);
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [overviewShows, setOverviewShows] = useState<{[station: string]: Show[]}>({});

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedStation && selectedDate) {
      loadSchedule();
    }
  }, [selectedStation, selectedDate]);

  useEffect(() => {
    if (selectedStation && activeTab === 'overview') {
      loadOverviewData();
    }
  }, [selectedStation, activeTab]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [stationsData, configData, statusData, calendarsData, djsData, botStatusData] = await Promise.all([
        api.getStations(),
        api.getConfig(),
        api.getStatus(),
        api.getCalendars(),
        api.getDJs().catch(() => []), // Don't fail if DJs endpoint is not available
        api.getBotStatus().catch(() => null) // Don't fail if bot status is not available
      ]);
      
      setStations(stationsData);
      setConfig(configData);
      setStatus(statusData);
      setCalendars(calendarsData.data.calendars);
      setDjs(djsData);
      setBotStatus(botStatusData);
      
      if (stationsData.length > 0 && !selectedStation) {
        setSelectedStation(stationsData[0].domain);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadSchedule = async () => {
    if (!selectedStation || !selectedDate) return;
    
    try {
      setLoading(true);
      setError(null);
      const schedule = await api.getSchedule(selectedStation, selectedDate);
      setShows(schedule || []);
    } catch (err) {
      console.error('Error loading schedule:', err);
      setError(err instanceof Error ? err.message : 'Failed to load schedule');
      setShows([]);
    } finally {
      setLoading(false);
    }
  };

  const loadOverviewData = async () => {
    if (!selectedStation) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Load data for the next 7 days
      const today = new Date();
      const from = today.toISOString().split('T')[0];
      const to = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const schedule = await api.getScheduleRange(selectedStation, from, to);
      setOverviewShows(prev => ({
        ...prev,
        [selectedStation]: schedule || []
      }));
    } catch (err) {
      console.error('Error loading overview data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load overview data');
      setOverviewShows(prev => ({
        ...prev,
        [selectedStation]: []
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setLoading(true);
      setError(null);
      setMessage('Scraping started...');
      
      await api.startScrape(selectedStation, [selectedDate]);
      
      // Wait a bit then reload schedule
      setTimeout(() => {
        loadSchedule();
        setMessage(null);
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start scrape');
      setMessage(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadJson = () => {
    const data = {
      station: selectedStation,
      date: selectedDate,
      shows: shows
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `schedule-${selectedStation}-${selectedDate}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyCalendarUrl = (calendarUrl: string) => {
    navigator.clipboard.writeText(calendarUrl).then(() => {
      setMessage('Kalender-URL in die Zwischenablage kopiert!');
      setTimeout(() => setMessage(null), 3000);
    }).catch(() => {
      setError('Fehler beim Kopieren der URL');
    });
  };

  const handleOpenCalendar = (calendarUrl: string) => {
    window.open(calendarUrl, '_blank');
  };

  const handleScrapeDJs = async () => {
    try {
      setLoading(true);
      setError(null);
      setMessage('DJ-Scraping gestartet...');
      
      await api.scrapeDJs();
      
      // Wait a bit then reload DJs
      setTimeout(async () => {
        try {
          const djsData = await api.getDJs();
          setDjs(djsData);
          setMessage('DJ-Scraping abgeschlossen!');
          setTimeout(() => setMessage(null), 3000);
        } catch (err) {
          setError('Fehler beim Laden der DJs');
          setMessage(null);
        }
      }, 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim DJ-Scraping');
      setMessage(null);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (time: string) => {
    if (!time) return '-';
    return time;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Radio className="w-8 h-8 text-blue-400" />
              <h1 className="text-2xl font-bold">WAO-Base</h1>
            </div>
            <nav className="flex gap-2">
              <button
                onClick={() => setActiveTab('overview')}
                className={`btn ${activeTab === 'overview' ? 'btn-primary' : 'btn-secondary'}`}
              >
                <Grid3X3 className="w-4 h-4" />
                Übersicht
              </button>
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`btn ${activeTab === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`}
              >
                <List className="w-4 h-4" />
                Tagesansicht
              </button>
              <button
                onClick={() => setActiveTab('caldav')}
                className={`btn ${activeTab === 'caldav' ? 'btn-primary' : 'btn-secondary'}`}
              >
                <CalendarDays className="w-4 h-4" />
                CalDAV
              </button>
              <button
                onClick={() => setActiveTab('djs')}
                className={`btn ${activeTab === 'djs' ? 'btn-primary' : 'btn-secondary'}`}
              >
                <Users className="w-4 h-4" />
                DJs
              </button>
              <button
                onClick={() => setActiveTab('config')}
                className={`btn ${activeTab === 'config' ? 'btn-primary' : 'btn-secondary'}`}
              >
                <Settings className="w-4 h-4" />
                Config
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {error && (
          <div className="alert alert-error mb-4">
            {error}
          </div>
        )}
        
        {message && (
          <div className="alert alert-success mb-4">
            {message}
          </div>
        )}

        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Station Selection */}
            <div className="card">
              <h2 className="text-xl font-semibold mb-4">Station auswählen</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {stations.map(station => (
                  <button
                    key={station.domain}
                    onClick={() => setSelectedStation(station.domain)}
                    className={`p-4 rounded-lg border-2 transition-colors ${
                      selectedStation === station.domain
                        ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                        : 'border-gray-600 bg-gray-800 hover:border-gray-500'
                    }`}
                  >
                    <div className="font-medium">{station.name || station.domain}</div>
                    <div className="text-sm text-gray-400 mt-1">
                      {overviewShows[station.domain]?.length || 0} Shows
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Calendar View */}
            {selectedStation && (
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">
                    {stations.find(s => s.domain === selectedStation)?.name || selectedStation} - 7-Tage Übersicht
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setViewMode('calendar')}
                      className={`btn ${viewMode === 'calendar' ? 'btn-primary' : 'btn-secondary'}`}
                    >
                      <Calendar className="w-4 h-4" />
                      Kalender
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`btn ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`}
                    >
                      <List className="w-4 h-4" />
                      Liste
                    </button>
                  </div>
                </div>

                {loading ? (
                  <div className="flex justify-center py-8">
                    <div className="loading" />
                  </div>
                ) : viewMode === 'calendar' ? (
                  <CalendarComponent 
                    shows={overviewShows[selectedStation] || []} 
                    onDateClick={(date) => {
                      setSelectedDate(date);
                      setActiveTab('dashboard');
                    }}
                    onEventClick={(show) => {
                      setSelectedDate(show.day);
                      setActiveTab('dashboard');
                    }}
                  />
                ) : (
                  <ListView 
                    shows={overviewShows[selectedStation] || []} 
                    onShowClick={(show) => {
                      setSelectedDate(show.day);
                      setActiveTab('dashboard');
                    }}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Controls */}
            <div className="card">
              <h2 className="text-xl font-semibold mb-4">Sendeplan</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="form-group">
                  <label className="form-label">Station</label>
                  <select
                    value={selectedStation}
                    onChange={(e) => setSelectedStation(e.target.value)}
                    className="form-select"
                  >
                    {stations.map(station => (
                      <option key={station.domain} value={station.domain}>
                        {station.name || station.domain}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Datum</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Aktionen</label>
                  <div className="flex gap-2">
                    <button
                      onClick={handleRefresh}
                      disabled={loading}
                      className="btn btn-primary"
                    >
                      {loading ? <div className="loading" /> : <RefreshCw className="w-4 h-4" />}
                      Aktualisieren
                    </button>
                    <button
                      onClick={handleDownloadJson}
                      disabled={shows.length === 0}
                      className="btn btn-secondary"
                    >
                      <Download className="w-4 h-4" />
                      JSON
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Status */}
            {status && (
              <div className="card">
                <h3 className="text-lg font-semibold mb-2">Status</h3>
                <div className="flex items-center gap-4">
                  <span className={`status-indicator ${status.isRunning ? 'status-running' : 'status-healthy'}`}>
                    {status.isRunning ? 'Läuft' : 'Bereit'}
                  </span>
                  {status.nextRun && (
                    <span className="text-sm text-gray-400">
                      Nächster Lauf: {new Date(status.nextRun).toLocaleString('de-DE')}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Schedule */}
            <div className="card">
              <h3 className="text-lg font-semibold mb-4">
                {selectedStation && selectedDate && (
                  <>
                    {stations.find(s => s.domain === selectedStation)?.name || selectedStation} - {formatDate(selectedDate)}
                  </>
                )}
              </h3>
              
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="loading" />
                </div>
              ) : shows.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  Keine Shows gefunden für dieses Datum
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Zeit</th>
                        <th>DJ</th>
                        <th>Show</th>
                        <th>Style</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shows.map((show, index) => (
                        <tr key={index}>
                          <td>
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-gray-400" />
                              {formatTime(show.start)} - {formatTime(show.end)}
                            </div>
                          </td>
                          <td>
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-gray-400" />
                              {show.dj}
                            </div>
                          </td>
                          <td className="font-medium">{show.title}</td>
                          <td>
                            <div className="flex items-center gap-2">
                              <Music className="w-4 h-4 text-gray-400" />
                              {show.style}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'caldav' && (
          <div className="space-y-6">
            <div className="card">
              <h2 className="text-xl font-semibold mb-4">📅 CalDAV Kalender</h2>
              <p className="text-gray-400 mb-6">
                Abonniere die Sendepläne direkt in deiner Kalender-App. Die Kalender werden automatisch aktualisiert, 
                wenn neue Sendeplandaten verfügbar sind.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {calendars.map(calendar => (
                  <div key={calendar.domain} className="bg-gray-800 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-medium">{calendar.name}</h3>
                      <span className="text-sm text-gray-400">{calendar.eventCount} Events</span>
                    </div>
                    
                    <p className="text-sm text-gray-400 mb-4">{calendar.description}</p>
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={calendar.url}
                          readOnly
                          className="form-input text-sm"
                        />
                        <button
                          onClick={() => handleCopyCalendarUrl(calendar.url)}
                          className="btn btn-secondary"
                          title="URL kopieren"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenCalendar(calendar.url)}
                          className="btn btn-primary"
                          title="Kalender öffnen"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      </div>
                      
                      <div className="text-xs text-gray-500">
                        Letzte Aktualisierung: {new Date(calendar.lastModified).toLocaleString('de-DE')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h3 className="text-lg font-semibold mb-4">📱 Kalender-App Integration</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-3">Microsoft Outlook</h4>
                  <ol className="text-sm text-gray-400 space-y-1">
                    <li>1. Datei → Konto hinzufügen</li>
                    <li>2. "Internetkalender" auswählen</li>
                    <li>3. Kalender-URL einfügen</li>
                    <li>4. "Hinzufügen" klicken</li>
                  </ol>
                </div>
                
                <div>
                  <h4 className="font-medium mb-3">Apple Calendar</h4>
                  <ol className="text-sm text-gray-400 space-y-1">
                    <li>1. Ablage → Neues Abonnement</li>
                    <li>2. Kalender-URL einfügen</li>
                    <li>3. "Abonnieren" klicken</li>
                    <li>4. Einstellungen anpassen</li>
                  </ol>
                </div>
                
                <div>
                  <h4 className="font-medium mb-3">Google Calendar</h4>
                  <ol className="text-sm text-gray-400 space-y-1">
                    <li>1. "+" → "Aus URL"</li>
                    <li>2. Kalender-URL einfügen</li>
                    <li>3. "Kalender hinzufügen" klicken</li>
                    <li>4. Name und Farbe wählen</li>
                  </ol>
                </div>
                
                <div>
                  <h4 className="font-medium mb-3">Thunderbird</h4>
                  <ol className="text-sm text-gray-400 space-y-1">
                    <li>1. Kalender → Neuer Kalender</li>
                    <li>2. "Im Netzwerk" auswählen</li>
                    <li>3. Kalender-URL einfügen</li>
                    <li>4. "Weiter" und "Fertig"</li>
                  </ol>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                <h4 className="font-medium text-blue-400 mb-2">💡 Tipp</h4>
                <p className="text-sm text-blue-300">
                  Die Kalender werden automatisch alle 5 Minuten aktualisiert. Du kannst auch manuell aktualisieren, 
                  indem du in deiner Kalender-App "Aktualisieren" auswählst.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'djs' && (
          <div className="space-y-6">
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">🎧 DJs</h2>
                <div className="flex gap-2">
                  <button
                    onClick={handleScrapeDJs}
                    disabled={loading}
                    className="btn btn-primary"
                  >
                    {loading ? <div className="loading" /> : <RefreshCw className="w-4 h-4" />}
                    DJs aktualisieren
                  </button>
                </div>
              </div>
              
              {botStatus && (
                <div className="mb-4 p-3 bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-4">
                    <span className={`status-indicator ${botStatus.enabled ? 'status-running' : 'status-healthy'}`}>
                      Bot: {botStatus.enabled ? 'Aktiv' : 'Deaktiviert'}
                    </span>
                    {botStatus.enabled && (
                      <>
                        <span className={`status-indicator ${botStatus.bot.isRunning ? 'status-running' : 'status-healthy'}`}>
                          Bot Service: {botStatus.bot.isRunning ? 'Läuft' : 'Bereit'}
                        </span>
                        <span className={`status-indicator ${botStatus.notifications.isRunning ? 'status-running' : 'status-healthy'}`}>
                          Notifications: {botStatus.notifications.isRunning ? 'Aktiv' : 'Inaktiv'}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )}

              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="loading" />
                </div>
              ) : djs.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  Keine DJs gefunden. Klicke auf "DJs aktualisieren" um DJs zu scrapen.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {djs.map(dj => (
                    <div key={dj.id} className="bg-gray-800 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-lg">{dj.djName}</h3>
                        <span className={`px-2 py-1 rounded text-xs ${dj.isActive ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                          {dj.isActive ? 'Aktiv' : 'Inaktiv'}
                        </span>
                      </div>
                      
                      <div className="text-sm text-gray-400 mb-2">
                        Station: {dj.stationDomain}
                      </div>
                      
                      {dj.realName && (
                        <div className="text-sm text-gray-500">
                          Real Name: {dj.realName}
                        </div>
                      )}
                      
                      <div className="text-xs text-gray-500 mt-2">
                        Letzte Aktualisierung: {new Date(dj.lastUpdated).toLocaleString('de-DE')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'config' && config && (
          <div className="space-y-6">
            <div className="card">
              <h2 className="text-xl font-semibold mb-4">Konfiguration</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-medium mb-3">Stationen</h3>
                  <div className="space-y-2">
                    {config.stations.map(station => (
                      <div key={station} className="flex items-center justify-between p-3 bg-gray-800 rounded">
                        <span>{station}</span>
                        <span className="text-sm text-gray-400">Aktiv</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-medium mb-3">Einstellungen</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="form-label">Cron Schedule</label>
                      <input
                        type="text"
                        value={config.cronSchedule}
                        readOnly
                        className="form-input"
                      />
                    </div>
                    <div>
                      <label className="form-label">Retention (Tage)</label>
                      <input
                        type="number"
                        value={config.retentionDays}
                        readOnly
                        className="form-input"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}


// List View Component
function ListView({ shows, onShowClick }: { shows: Show[], onShowClick: (show: Show) => void }) {
  const groupedShows = shows.reduce((acc, show) => {
    if (!acc[show.day]) {
      acc[show.day] = [];
    }
    acc[show.day].push(show);
    return acc;
  }, {} as {[date: string]: Show[]});

  const sortedDays = Object.keys(groupedShows).sort();

  return (
    <div className="space-y-4">
      {sortedDays.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          Keine Shows in den nächsten 7 Tagen
        </div>
      ) : (
        sortedDays.map(date => {
          const dayShows = groupedShows[date];
          const dayDate = new Date(date);
          
          return (
            <div key={date} className="bg-gray-800 rounded-lg p-4">
              <h4 className="font-medium mb-3">
                {dayDate.toLocaleDateString('de-DE', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </h4>
              
              <div className="space-y-2">
                {dayShows.map((show, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-gray-700 rounded cursor-pointer hover:bg-gray-600 transition-colors"
                    onClick={() => onShowClick(show)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-mono text-blue-400">
                        {show.start} - {show.end}
                      </div>
                      <div>
                        <div className="font-medium">{show.dj}</div>
                        <div className="text-sm text-gray-400">{show.title}</div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">{show.style}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

export default App;
