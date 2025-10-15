import * as cheerio from 'cheerio';
import type { Element } from 'cheerio';
import { db, BotDJ } from '../database';
import { logger } from '../utils/logger';
import { config } from '../config';

export interface ScrapedDJ {
  djName: string;
  realName?: string;
  isActive: boolean;
}

export class DJScraperService {
  private baseUrls: Map<string, string> = new Map();

  constructor() {
    // Initialize base URLs for different stations
    this.baseUrls.set('technobase.fm', 'https://www.technobase.fm');
    this.baseUrls.set('housetime.fm', 'https://www.housetime.fm');
    this.baseUrls.set('hardbase.fm', 'https://www.hardbase.fm');
    this.baseUrls.set('trancebase.fm', 'https://www.trancebase.fm');
    this.baseUrls.set('coretime.fm', 'https://www.coretime.fm');
    this.baseUrls.set('clubtime.fm', 'https://www.clubtime.fm');
    this.baseUrls.set('teatime.fm', 'https://www.teatime.fm');
    this.baseUrls.set('replay.fm', 'https://www.replay.fm');
  }

  async scrapeAllStations(): Promise<void> {
    logger.info('Starting DJ scraping for all stations');
    
    for (const stationDomain of config.stations) {
      try {
        await this.scrapeStation(stationDomain);
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        logger.error(`Failed to scrape DJs for ${stationDomain}:`, error);
      }
    }
    
    logger.info('DJ scraping completed for all stations');
  }

  async scrapeStation(stationDomain: string): Promise<ScrapedDJ[]> {
    try {
      const baseUrl = this.baseUrls.get(stationDomain);
      if (!baseUrl) {
        throw new Error(`No base URL configured for station: ${stationDomain}`);
      }

      const url = `${baseUrl}/team`;
      logger.info(`Scraping DJs from ${url}`);

      const html = await this.fetchHtml(url);
      const djs = this.parseDJs(html, stationDomain);

      // Save to database
      for (const dj of djs) {
        await db.upsertBotDJ({
          stationDomain,
          djName: dj.djName,
          realName: dj.realName,
          isActive: dj.isActive
        });
      }

      logger.info(`Scraped ${djs.length} DJs for ${stationDomain}`);
      return djs;

    } catch (error) {
      logger.error(`Failed to scrape DJs for ${stationDomain}:`, error);
      throw error;
    }
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

    const response = await fetch(url, fetchOptions);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.text();
  }

  private parseDJs(html: string, stationDomain: string): ScrapedDJ[] {
    const $ = cheerio.load(html);
    const djs: ScrapedDJ[] = [];

    // Look for Resident DJs section
    $('h3:contains("Resident DJs"), h2:contains("Resident DJs")').each((_, header) => {
      const $header = $(header);
      const $section = $header.nextUntil('h2, h3, h4').addBack();
      
      // Find DJ entries in this section
      $section.find('li, .dj-item, .team-member').each((_, element) => {
        const dj = this.parseDJItem($, $(element));
        if (dj) {
          djs.push(dj);
        }
      });
    });

    // Fallback: look for any DJ-like entries
    if (djs.length === 0) {
      $('li, .dj-item, .team-member').each((_, element) => {
        const $element = $(element);
        const text = $element.text().trim();
        
        // Check if this looks like a DJ entry
        if (this.looksLikeDJEntry(text)) {
          const dj = this.parseDJItem($, $element);
          if (dj) {
            djs.push(dj);
          }
        }
      });
    }

    return djs;
  }

  private parseDJItem($: cheerio.CheerioAPI, $item: cheerio.Cheerio<cheerio.Element>): ScrapedDJ | null {
    const text = $item.text().trim();
    
    // Skip if empty or too short
    if (!text || text.length < 3) {
      return null;
    }

    // Look for DJ name patterns
    const djMatch = text.match(/(?:DJ\s+)?([A-Za-z0-9\s\-\.]+?)(?:\s+###?\s+([A-Za-z\s\-\.]+))?/);
    
    if (!djMatch) {
      return null;
    }

    let djName = djMatch[1].trim();
    const realName = djMatch[2]?.trim();

    // Clean up DJ name
    djName = this.cleanDJName(djName);
    
    // Skip if name is too short or generic
    if (djName.length < 2 || djName.toLowerCase().includes('various') || djName.toLowerCase().includes('guest')) {
      return null;
    }

    return {
      djName,
      realName: realName || undefined,
      isActive: true
    };
  }

  private cleanDJName(name: string): string {
    // Remove extra whitespace
    name = name.replace(/\s+/g, ' ').trim();
    
    // Ensure DJ prefix is consistent
    if (name.toLowerCase().startsWith('dj ')) {
      name = 'DJ ' + name.substring(3);
    } else if (!name.toLowerCase().startsWith('dj')) {
      // Add DJ prefix if not present
      name = 'DJ ' + name;
    }
    
    // Remove duplicate DJ prefixes
    name = name.replace(/^DJ\s+DJ\s+/i, 'DJ ');
    
    return name;
  }

  private looksLikeDJEntry(text: string): boolean {
    // Check for common DJ name patterns
    const patterns = [
      /^DJ\s+[A-Za-z0-9\s\-\.]+/i,
      /^[A-Za-z0-9\s\-\.]+\s+###?\s+[A-Za-z\s\-\.]+/,
      /^[A-Za-z0-9\s\-\.]+\s*$/i
    ];
    
    return patterns.some(pattern => pattern.test(text));
  }

  async getAvailableDJs(stationDomain?: string): Promise<BotDJ[]> {
    return await db.getBotDJs(stationDomain);
  }

  async searchDJs(query: string, stationDomain?: string): Promise<BotDJ[]> {
    const allDJs = await this.getAvailableDJs(stationDomain);
    const lowerQuery = query.toLowerCase();
    
    return allDJs.filter(dj => 
      dj.djName.toLowerCase().includes(lowerQuery) ||
      (dj.realName && dj.realName.toLowerCase().includes(lowerQuery))
    );
  }
}
