import { ApiResponse, Station, Show, Config, ScraperStatus, CalDAVResponse, CalendarInfo } from './types';

const API_BASE = '/api';

class ApiClient {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }

  // Stations
  async getStations(): Promise<Station[]> {
    const response = await this.request<Station[]>('/stations');
    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch stations');
    }
    return response.data || [];
  }

  // Schedule
  async getSchedule(station: string, date?: string): Promise<Show[]> {
    const params = new URLSearchParams({ station });
    if (date) params.append('date', date);
    
    const response = await this.request<Show[]>(`/schedule?${params}`);
    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch schedule');
    }
    return response.data || [];
  }

  async getScheduleRange(station: string, from: string, to: string): Promise<Show[]> {
    const params = new URLSearchParams({ station, from, to });
    
    const response = await this.request<Show[]>(`/schedule/range?${params}`);
    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch schedule range');
    }
    return response.data || [];
  }

  // Scraper
  async startScrape(station?: string, dates?: string[]): Promise<void> {
    const response = await this.request('/scrape', {
      method: 'POST',
      body: JSON.stringify({ station, dates }),
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to start scrape');
    }
  }

  // Config
  async getConfig(): Promise<Config> {
    const response = await this.request<Config>('/config');
    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch config');
    }
    return response.data!;
  }

  async updateConfig(config: Partial<Config>): Promise<void> {
    const response = await this.request('/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to update config');
    }
  }

  // Status
  async getStatus(): Promise<ScraperStatus> {
    const response = await this.request<ScraperStatus>('/status');
    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch status');
    }
    return response.data!;
  }

  // Health
  async getHealth(): Promise<any> {
    const response = await fetch('/health');
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }
    return await response.json();
  }

  // CalDAV
  async getCalendars(): Promise<CalDAVResponse> {
    const response = await fetch('/caldav');
    if (!response.ok) {
      throw new Error(`Failed to fetch calendars: ${response.status}`);
    }
    return await response.json();
  }

  async getCalendarInfo(station: string): Promise<CalendarInfo> {
    const response = await fetch(`/caldav/${station}/info`);
    if (!response.ok) {
      throw new Error(`Failed to fetch calendar info: ${response.status}`);
    }
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch calendar info');
    }
    return result.data;
  }

  getCalendarUrl(station: string, days?: number): string {
    const baseUrl = window.location.origin;
    const url = new URL(`/caldav/${station}/calendar.ics`, baseUrl);
    if (days) {
      url.searchParams.set('days', days.toString());
    }
    return url.toString();
  }
}

export const api = new ApiClient();
