import ical, { ICalCalendar, ICalEvent } from 'ical-generator';
import { v4 as uuidv4 } from 'uuid';
import { Show, Station } from '../types';
import { db } from '../database';
import { logger } from '../utils/logger';
import { config } from '../config';

export class CalDAVService {
  private calendars: Map<string, ICalCalendar> = new Map();

  constructor() {
    this.initializeCalendars();
  }

  private initializeCalendars(): void {
    for (const stationDomain of config.stations) {
      const calendar = ical({
        name: this.getStationName(stationDomain),
        description: `Sendeplan für ${this.getStationName(stationDomain)}`,
        timezone: config.timezone,
        url: `${config.baseUrl}/caldav/${stationDomain}/calendar.ics`,
        source: `${config.baseUrl}/caldav/${stationDomain}/calendar.ics`,
        prodId: {
          company: 'WAO-Base',
          product: 'Sendeplan Scraper',
          language: 'DE'
        }
      });

      this.calendars.set(stationDomain, calendar);
    }
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

  async generateCalendar(stationDomain: string, days: number = 7): Promise<string> {
    try {
      const calendar = this.calendars.get(stationDomain);
      if (!calendar) {
        throw new Error(`Calendar not found for station: ${stationDomain}`);
      }

      // Clear existing events
      calendar.clear();

      // Get shows for the specified number of days
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + days);
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 1); // Include yesterday

      const shows = await db.getShows(
        stationDomain,
        undefined,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      );

      // Group shows by day
      const showsByDay = this.groupShowsByDay(shows);

      // Create events for each show
      for (const [day, dayShows] of showsByDay) {
        for (const show of dayShows) {
          const event = this.createEvent(show, stationDomain);
          calendar.createEvent(event);
        }
      }

      // Add a summary event for the day if there are shows
      for (const [day, dayShows] of showsByDay) {
        if (dayShows.length > 0) {
          const summaryEvent = this.createSummaryEvent(day, dayShows, stationDomain);
          calendar.createEvent(summaryEvent);
        }
      }

      logger.info(`Generated calendar for ${stationDomain} with ${shows.length} shows`);
      return calendar.toString();

    } catch (error) {
      logger.error(`Failed to generate calendar for ${stationDomain}:`, error);
      throw error;
    }
  }

  private groupShowsByDay(shows: Show[]): Map<string, Show[]> {
    const grouped = new Map<string, Show[]>();
    
    for (const show of shows) {
      if (!grouped.has(show.day)) {
        grouped.set(show.day, []);
      }
      grouped.get(show.day)!.push(show);
    }

    return grouped;
  }

  private createEvent(show: Show, stationDomain: string): ICalEvent {
    const startDateTime = this.parseDateTime(show.day, show.start);
    const endDateTime = this.parseDateTime(show.day, show.end);

    const event = this.calendar.createEvent({
      id: uuidv4(),
      start: startDateTime,
      end: endDateTime,
      summary: `${show.title} - ${show.dj}`,
      description: this.createEventDescription(show),
      location: this.getStationName(stationDomain),
      url: `https://www.${stationDomain}`,
      categories: [{
        name: show.style
      }],
      status: 'CONFIRMED',
      busyStatus: 'FREE',
      transparency: 'TRANSPARENT',
      organizer: {
        name: show.dj,
        email: `dj@${stationDomain}`
      },
      alarms: [{
        type: 'display',
        trigger: 900, // 15 minutes before
        description: `Show startet in 15 Minuten: ${show.title}`
      }]
    });

    return event;
  }

  private createSummaryEvent(day: string, shows: Show[], stationDomain: string): ICalEvent {
    const startDateTime = this.parseDateTime(day, '00:00');
    const endDateTime = this.parseDateTime(day, '23:59');

    const showList = shows
      .map(show => `${show.start} - ${show.title} (${show.dj})`)
      .join('\n');

    const event = this.calendar.createEvent({
      id: uuidv4(),
      start: startDateTime,
      end: endDateTime,
      summary: `📻 ${this.getStationName(stationDomain)} - ${shows.length} Shows`,
      description: `Sendeplan für ${this.formatDate(day)}:\n\n${showList}`,
      location: this.getStationName(stationDomain),
      url: `https://www.${stationDomain}`,
      categories: [{
        name: 'Sendeplan'
      }],
      status: 'CONFIRMED',
      busyStatus: 'FREE',
      transparency: 'TRANSPARENT',
      allDay: true
    });

    return event;
  }

  private parseDateTime(day: string, time: string): Date {
    const [year, month, dayNum] = day.split('-').map(Number);
    const [hours, minutes] = time.split(':').map(Number);
    
    return new Date(year || 2024, (month || 1) - 1, dayNum || 1, hours || 0, minutes || 0);
  }

  private formatDate(day: string): string {
    const date = new Date(day);
    return date.toLocaleDateString('de-DE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  private createEventDescription(show: Show): string {
    return `🎵 ${show.title}
👤 DJ: ${show.dj}
🎭 Style: ${show.style}
⏰ Zeit: ${show.start} - ${show.end}

Abonniere den Sendeplan für automatische Updates!`;
  }

  async getCalendarInfo(stationDomain: string): Promise<{
    name: string;
    description: string;
    url: string;
    lastModified: Date;
    eventCount: number;
  }> {
    const calendar = this.calendars.get(stationDomain);
    if (!calendar) {
      throw new Error(`Calendar not found for station: ${stationDomain}`);
    }

    // Get recent shows count
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 7);
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 1);

    const shows = await db.getShows(
      stationDomain,
      undefined,
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );

    return {
      name: this.getStationName(stationDomain),
      description: `Sendeplan für ${this.getStationName(stationDomain)}`,
      url: `${config.baseUrl}/caldav/${stationDomain}/calendar.ics`,
      lastModified: new Date(),
      eventCount: shows.length
    };
  }

  getAvailableStations(): string[] {
    return Array.from(this.calendars.keys());
  }
}
