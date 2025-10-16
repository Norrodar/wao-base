export interface Station {
  domain: string;
  name?: string;
  enabled: boolean;
  lastScraped?: string;
}

export interface Show {
  id?: number;
  day: string;
  stationDomain: string;
  dj: string;
  title: string;
  start: string;
  end: string;
  style: string;
  createdAt?: string;
}

export interface Config {
  stations: string[];
  cronSchedule: string;
  retentionDays: number;
  httpProxy?: string;
  httpsProxy?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ScheduleQuery {
  station: string;
  date?: string;
  from?: string;
  to?: string;
}

export interface ScraperStatus {
  isRunning: boolean;
  nextRun?: string;
}

export interface CalendarInfo {
  name: string;
  domain: string;
  url: string;
  description: string;
  eventCount: number;
  lastModified: string;
}

export interface CalDAVResponse {
  success: boolean;
  data: {
    calendars: CalendarInfo[];
    instructions: {
      title: string;
      steps: string[];
      note: string;
    };
  };
}

export interface DJ {
  id: number;
  stationDomain: string;
  djName: string;
  realName?: string;
  isActive: boolean;
  lastUpdated: string;
}

export interface BotStatus {
  enabled: boolean;
  bot: {
    isRunning: boolean;
  };
  notifications: {
    isRunning: boolean;
  };
}