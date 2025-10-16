import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Show } from './types';

// Moment.js locale für Deutsch
import 'moment/locale/de';
moment.locale('de');

const localizer = momentLocalizer(moment);

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: {
    dj: string;
    style: string;
    show: Show;
  };
}

interface CalendarComponentProps {
  shows: Show[];
  onEventClick?: (show: Show) => void;
  onDateClick?: (date: string) => void;
}

export function CalendarComponent({ shows, onEventClick, onDateClick }: CalendarComponentProps) {
  // Konvertiere Shows zu Calendar Events
  const events: CalendarEvent[] = shows.map((show, index) => {
    const startTime = moment(`${show.day} ${show.start}`, 'YYYY-MM-DD HH:mm');
    const endTime = moment(`${show.day} ${show.end}`, 'YYYY-MM-DD HH:mm');
    
    return {
      id: `show-${index}`,
      title: `${show.dj} - ${show.title}`,
      start: startTime.toDate(),
      end: endTime.toDate(),
      resource: {
        dj: show.dj,
        style: show.style,
        show: show
      }
    };
  });

  const handleEventClick = (event: CalendarEvent) => {
    if (onEventClick) {
      onEventClick(event.resource.show);
    }
  };

  const handleSelectSlot = (slotInfo: { start: Date; end: Date; slots: Date[] }) => {
    if (onDateClick) {
      const dateStr = moment(slotInfo.start).format('YYYY-MM-DD');
      onDateClick(dateStr);
    }
  };

  const eventStyleGetter = (event: CalendarEvent) => {
    // Verschiedene Farben basierend auf dem Style
    const styleColors: { [key: string]: string } = {
      'House': '#3B82F6', // Blau
      'Techno': '#EF4444', // Rot
      'Trance': '#10B981', // Grün
      'Progressive': '#F59E0B', // Orange
      'Deep House': '#8B5CF6', // Lila
      'Minimal': '#6B7280', // Grau
    };

    const backgroundColor = styleColors[event.resource.style] || '#6366F1'; // Standard: Indigo
    
    return {
      style: {
        backgroundColor,
        borderRadius: '4px',
        opacity: 0.8,
        color: 'white',
        border: '0px',
        display: 'block'
      }
    };
  };

  return (
    <div className="h-96">
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: '100%' }}
        views={['week', 'month']}
        defaultView="week"
        step={30}
        timeslots={2}
        onSelectEvent={handleEventClick}
        onSelectSlot={handleSelectSlot}
        selectable
        eventPropGetter={eventStyleGetter}
        messages={{
          next: 'Weiter',
          previous: 'Zurück',
          today: 'Heute',
          month: 'Monat',
          week: 'Woche',
          day: 'Tag',
          agenda: 'Agenda',
          date: 'Datum',
          time: 'Zeit',
          event: 'Event',
          noEventsInRange: 'Keine Shows in diesem Zeitraum',
          showMore: (total: number) => `+${total} weitere`
        }}
        formats={{
          dayFormat: 'dddd',
          dayHeaderFormat: 'dddd, DD. MMMM',
          dayRangeHeaderFormat: ({ start, end }: { start: Date; end: Date }) => 
            `${moment(start).format('DD. MMMM')} - ${moment(end).format('DD. MMMM YYYY')}`,
          monthHeaderFormat: 'MMMM YYYY',
          timeGutterFormat: 'HH:mm',
          eventTimeRangeFormat: ({ start, end }: { start: Date; end: Date }) => 
            `${moment(start).format('HH:mm')} - ${moment(end).format('HH:mm')}`
        }}
      />
    </div>
  );
}
