export interface Station {
  domain: string;
  name?: string;
  enabled: boolean;
  lastScraped?: Date;
}

export interface Day {
  stationDomain: string;
  day: string; // ISO YYYY-MM-DD
  scrapedAt: Date;
}

export interface Show {
  id?: number;
  day: string; // ISO YYYY-MM-DD
  dj: string;
  title: string;
  start: string; // HH:MM
  end: string; // HH:MM
  style: string;
  stationDomain: string;
  createdAt?: string;
}

export interface ScrapedShow {
  dj: string;
  title: string;
  start: string;
  end: string;
  style: string;
}

export interface ScrapeResult {
  station: string;
  date: string;
  shows: ScrapedShow[];
  success: boolean;
  error?: string;
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
