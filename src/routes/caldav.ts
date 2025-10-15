import { FastifyInstance } from 'fastify';
import { serviceManager } from '../services/service-manager';
import { logger } from '../utils/logger';

export async function caldavRoutes(fastify: FastifyInstance) {
  const caldavService = serviceManager.getCalDAVService();

  // GET /caldav - List available calendars
  fastify.get('/caldav', async (request, reply) => {
    try {
      const stations = caldavService.getAvailableStations();
      const calendars = [];

      for (const station of stations) {
        const info = await caldavService.getCalendarInfo(station);
        calendars.push({
          name: info.name,
          domain: station,
          url: info.url,
          description: info.description,
          eventCount: info.eventCount,
          lastModified: info.lastModified
        });
      }

      return reply.send({
        success: true,
        data: {
          calendars,
          instructions: {
            title: 'CalDAV Kalender abonnieren',
            steps: [
              '1. Kopiere die gewünschte Kalender-URL',
              '2. Füge sie in deiner Kalender-App hinzu:',
              '   - Outlook: Datei → Konto hinzufügen → Internetkalender',
              '   - Apple Calendar: Ablage → Neues Abonnement',
              '   - Google Calendar: + → Aus URL',
              '   - Thunderbird: Kalender → Neuer Kalender → Im Netzwerk'
            ],
            note: 'Der Kalender wird automatisch aktualisiert, wenn neue Sendeplandaten verfügbar sind.'
          }
        }
      });
    } catch (error) {
      logger.error('Failed to get CalDAV calendars:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve calendars'
      });
    }
  });

  // GET /caldav/:station/calendar.ics - Get iCalendar file for specific station
  fastify.get<{ Params: { station: string } }>('/caldav/:station/calendar.ics', async (request, reply) => {
    try {
      const { station } = request.params;
      
      // Validate station
      const availableStations = caldavService.getAvailableStations();
      if (!availableStations.includes(station)) {
        return reply.status(404).send({
          success: false,
          error: `Station not found: ${station}`
        });
      }

      // Get days parameter (default 7 days)
      const query = request.query as { days?: string };
      const days = parseInt(query.days || '7') || 7;
      const maxDays = 30; // Limit to prevent abuse
      const validDays = Math.min(Math.max(days, 1), maxDays);

      // Generate calendar
      const icalContent = await caldavService.generateCalendar(station, validDays);

      // Set appropriate headers
      reply.header('Content-Type', 'text/calendar; charset=utf-8');
      reply.header('Content-Disposition', `attachment; filename="${station}-calendar.ics"`);
      reply.header('Cache-Control', 'public, max-age=300'); // Cache for 5 minutes
      reply.header('Last-Modified', new Date().toUTCString());

      return reply.send(icalContent);
    } catch (error) {
      logger.error(`Failed to generate calendar for ${request.params.station}:`, error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to generate calendar'
      });
    }
  });

  // GET /caldav/:station/info - Get calendar information
  fastify.get<{ Params: { station: string } }>('/caldav/:station/info', async (request, reply) => {
    try {
      const { station } = request.params;
      
      // Validate station
      const availableStations = caldavService.getAvailableStations();
      if (!availableStations.includes(station)) {
        return reply.status(404).send({
          success: false,
          error: `Station not found: ${station}`
        });
      }

      const info = await caldavService.getCalendarInfo(station);
      
      return reply.send({
        success: true,
        data: info
      });
    } catch (error) {
      logger.error(`Failed to get calendar info for ${request.params.station}:`, error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve calendar information'
      });
    }
  });

  // PROPFIND /caldav/:station/ - CalDAV discovery (for advanced clients)
  fastify.register(async function (fastify) {
    fastify.addHook('onRequest', async (request, reply) => {
      // Only handle PROPFIND requests
      if (request.method !== 'PROPFIND') {
        return;
      }
    });

    fastify.route({
      method: 'PROPFIND',
      url: '/caldav/:station/',
      handler: async (request, reply) => {
        try {
          const params = request.params as { station: string };
          const { station } = params;
          
          // Validate station
          const availableStations = caldavService.getAvailableStations();
          if (!availableStations.includes(station)) {
            return reply.status(404).send('Station not found');
          }

          const info = await caldavService.getCalendarInfo(station);
          
          // Return CalDAV XML response
          const xml = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:response>
    <D:href>/caldav/${station}/</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>${info.name}</D:displayname>
        <D:resourcetype>
          <D:collection/>
          <C:calendar/>
        </D:resourcetype>
        <C:calendar-description>${info.description}</C:calendar-description>
        <C:supported-calendar-component-set>
          <C:comp name="VEVENT"/>
        </C:supported-calendar-component-set>
        <C:calendar-timezone>Europe/Berlin</C:calendar-timezone>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
  <D:response>
    <D:href>/caldav/${station}/calendar.ics</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>${info.name} Calendar</D:displayname>
        <D:getcontenttype>text/calendar</D:getcontenttype>
        <D:getlastmodified>${info.lastModified.toUTCString()}</D:getlastmodified>
        <D:getetag>"${info.lastModified.getTime()}"</D:getetag>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
</D:multistatus>`;

          reply.header('Content-Type', 'application/xml; charset=utf-8');
          return reply.send(xml);
        } catch (error) {
          const params = request.params as { station: string };
          logger.error(`Failed to handle PROPFIND for ${params.station}:`, error);
          return reply.status(500).send('Internal Server Error');
        }
      }
    });
  });
}
