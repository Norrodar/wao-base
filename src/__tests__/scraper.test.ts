import { ScheduleScraper } from '../scraper';

describe('ScheduleScraper', () => {
  let scraper: ScheduleScraper;

  beforeAll(() => {
    scraper = new ScheduleScraper('https://www.technobase.fm');
  });

  describe('scrapeSchedule', () => {
    it('should scrape shows from technobase.fm for today', async () => {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      const result = await scraper.scrapeSchedule('technobase.fm', today);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.station).toBe('technobase.fm');
      expect(result.date).toBe(today);
      expect(Array.isArray(result.shows)).toBe(true);
      expect(result.shows.length).toBeGreaterThan(0);
      
      // Check first show structure
      const firstShow = result.shows[0];
      expect(firstShow).toHaveProperty('dj');
      expect(firstShow).toHaveProperty('title');
      expect(firstShow).toHaveProperty('start');
      expect(firstShow).toHaveProperty('end');
      expect(firstShow).toHaveProperty('style');
      
      // Validate data types
      expect(typeof firstShow.dj).toBe('string');
      expect(typeof firstShow.title).toBe('string');
      expect(typeof firstShow.start).toBe('string');
      expect(typeof firstShow.end).toBe('string');
      expect(typeof firstShow.style).toBe('string');
      
      // Validate time format (HH:MM)
      expect(firstShow.start).toMatch(/^\d{2}:\d{2}$/);
      expect(firstShow.end).toMatch(/^\d{2}:\d{2}$/);
      
      console.log(`Found ${result.shows.length} shows for ${today}:`, result.shows);
    }, 10000); // 10 second timeout for network request

    it('should handle invalid dates gracefully', async () => {
      const result = await scraper.scrapeSchedule('technobase.fm', 'invalid-date');
      
      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.station).toBe('technobase.fm');
      expect(result.date).toBe('invalid-date');
      expect(Array.isArray(result.shows)).toBe(true);
      expect(result.shows.length).toBe(0);
      expect(result.error).toBeDefined();
      
      console.log('Error handling test result:', result);
    }, 10000);

    it('should extract valid show data from real website', async () => {
      const today = new Date().toISOString().split('T')[0];
      const result = await scraper.scrapeSchedule('technobase.fm', today);
      
      expect(result.success).toBe(true);
      expect(result.shows.length).toBeGreaterThan(0);
      
      // Validate all shows have required fields
      result.shows.forEach(show => {
        expect(show.dj).toBeTruthy();
        expect(show.title).toBeTruthy();
        expect(show.start).toBeTruthy();
        expect(show.end).toBeTruthy();
        expect(show.style).toBeTruthy();
        
        // Validate time format
        expect(show.start).toMatch(/^\d{2}:\d{2}$/);
        expect(show.end).toMatch(/^\d{2}:\d{2}$/);
      });
      
      console.log('All shows validation passed:', result.shows.length, 'shows');
    }, 10000);
  });

  describe('buildUrl', () => {
    it('should build correct URL for date', () => {
      const url = scraper['buildUrl']('technobase.fm', '2025-10-15');
      expect(url).toBe('https://www.technobase.fm/sendeplan?day=2025-10-15%2000:00:00');
    });

    it('should build correct URL for different stations', () => {
      const stations = ['housetime.fm', 'hardbase.fm', 'trancebase.fm'];
      
      stations.forEach(station => {
        const url = scraper['buildUrl'](station, '2025-10-15');
        expect(url).toBe(`https://www.${station}/sendeplan?day=2025-10-15%2000:00:00`);
      });
    });
  });

  describe('multiple stations', () => {
    const testStations = ['technobase.fm', 'housetime.fm', 'hardbase.fm'];
    
    testStations.forEach(station => {
      it(`should scrape ${station} successfully`, async () => {
        const stationScraper = new ScheduleScraper(`https://www.${station}`);
        const today = new Date().toISOString().split('T')[0];
        const result = await stationScraper.scrapeSchedule(station, today);
        
        expect(result).toBeDefined();
        expect(result.station).toBe(station);
        expect(result.date).toBe(today);
        expect(Array.isArray(result.shows)).toBe(true);
        
        // Some stations might not have shows on certain days, so we just check the structure
        if (result.shows.length > 0) {
          const firstShow = result.shows[0];
          expect(firstShow).toHaveProperty('dj');
          expect(firstShow).toHaveProperty('title');
          expect(firstShow).toHaveProperty('start');
          expect(firstShow).toHaveProperty('end');
          expect(firstShow).toHaveProperty('style');
        }
        
        console.log(`${station}: ${result.shows.length} shows found`);
      }, 15000);
    });
  });

  describe('calculateEndTime', () => {
    it('should calculate end time correctly', () => {
      const endTime = scraper['calculateEndTime']('08:00');
      expect(endTime).toBe('10:00');
      
      const endTime2 = scraper['calculateEndTime']('22:00');
      expect(endTime2).toBe('00:00');
    });
  });
});
