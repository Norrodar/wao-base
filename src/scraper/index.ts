import * as cheerio from 'cheerio';
import { ScrapedShow, ScrapeResult } from '../types';
import { logger } from '../utils/logger';
import { config } from '../config';

export class ScheduleScraper {
  private baseUrl: string;
  private proxy?: string;

  constructor(baseUrl: string, proxy?: string) {
    this.baseUrl = baseUrl;
    this.proxy = proxy;
  }

  async scrapeSchedule(station: string, date: string): Promise<ScrapeResult> {
    try {
      const url = this.buildUrl(station, date);
      logger.info(`Scraping ${station} for ${date}: ${url}`);

      const html = await this.fetchHtml(url);
      const shows = this.parseShows(html);

      logger.info(`Found ${shows.length} shows for ${station} on ${date}`);

      return {
        station,
        date,
        shows,
        success: true
      };
    } catch (error) {
      logger.error(`Failed to scrape ${station} for ${date}:`, error);
      return {
        station,
        date,
        shows: [],
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  buildUrl(station: string, date: string): string {
    // Format: https://www.{domain}/sendeplan?day=YYYY-MM-DD%2000:00:00
    const encodedDate = `${date}%2000:00:00`;
    return `https://www.${station}/sendeplan?day=${encodedDate}`;
  }

  private async fetchHtml(url: string): Promise<string> {
    const fetchOptions: RequestInit = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    };

    if (this.proxy) {
      // Note: In a real implementation, you'd need to configure the proxy properly
      // This is a placeholder for proxy configuration
      logger.info(`Using proxy: ${this.proxy}`);
    }

    const response = await fetch(url, fetchOptions);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.text();
  }

  parseShows(html: string): ScrapedShow[] {
    const $ = cheerio.load(html);
    const shows: ScrapedShow[] = [];

    // Select schedule items
    $('.content-list.schedule-list .item[itemtype="http://schema.org/BroadcastEvent"]').each((_, element) => {
      try {
        const show = this.parseShowItem($, $(element));
        if (show) {
          shows.push(show);
        }
      } catch (error) {
        logger.warn('Failed to parse show item:', error);
      }
    });

    return shows;
  }

  private parseShowItem($: cheerio.CheerioAPI, $item: cheerio.Cheerio<any>): ScrapedShow | null {
    // Parse time information
    const $timeContainer = $item.find('.time-djname > h2.title');
    const $startTime = $timeContainer.find('span[itemprop="startDate"]');
    
    if ($startTime.length === 0) {
      logger.warn('No start time found for show item');
      return null;
    }

    const startTime = $startTime.text().trim();
    
    // Find end time - it's usually the next span after startDate
    let endTime = '';
    const $nextSpan = $startTime.next('span');
    if ($nextSpan.length > 0) {
      endTime = $nextSpan.text().trim();
    } else {
      // Fallback: try to find end time in content attribute or other locations
      const endTimeContent = $startTime.attr('content');
      if (endTimeContent) {
        // Extract end time from ISO format if available
        const endMatch = endTimeContent.match(/T(\d{2}:\d{2})/);
        if (endMatch) {
          endTime = endMatch[1];
        }
      }
    }

    // Parse show information
    const $showInfo = $item.find('.description .show-info');
    
    // DJ
    const $dj = $showInfo.find('.dj-row [itemprop="dj"]');
    const dj = $dj.text().trim() || $dj.find('a').text().trim();

    // Title
    const $title = $showInfo.find('.title-row [itemprop="name"]');
    const title = $title.text().trim();

    // Style/Genre
    const $style = $showInfo.find('.genre-row [itemprop="genre"]');
    const style = $style.text().trim();

    // Validate required fields
    if (!startTime || !dj || !title) {
      logger.warn(`Incomplete show data: start=${startTime}, dj=${dj}, title=${title}`);
      return null;
    }

    return {
      dj,
      title,
      start: startTime,
      end: endTime || this.calculateEndTime(startTime),
      style: style || 'Unknown'
    };
  }

  calculateEndTime(startTime: string): string {
    // Simple fallback: assume 2-hour shows
    const [hours, minutes] = startTime.split(':').map(Number);
    const endHours = (hours + 2) % 24;
    return `${endHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }
}

export class ScraperManager {
  private scrapers: Map<string, ScheduleScraper> = new Map();

  constructor() {
    // Initialize scrapers for configured stations
    for (const station of config.stations) {
      const scraper = new ScheduleScraper(
        `https://www.${station}`,
        config.httpProxy || config.httpsProxy
      );
      this.scrapers.set(station, scraper);
    }
  }

  async scrapeStation(station: string, date: string): Promise<ScrapeResult> {
    const scraper = this.scrapers.get(station);
    if (!scraper) {
      throw new Error(`No scraper configured for station: ${station}`);
    }
    return await scraper.scrapeSchedule(station, date);
  }

  async scrapeMultipleDates(station: string, dates: string[]): Promise<ScrapeResult[]> {
    const results: ScrapeResult[] = [];
    
    for (const date of dates) {
      const result = await this.scrapeStation(station, date);
      results.push(result);
      
      // Add small delay between requests to be respectful
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return results;
  }

  getAvailableStations(): string[] {
    return Array.from(this.scrapers.keys());
  }
}
