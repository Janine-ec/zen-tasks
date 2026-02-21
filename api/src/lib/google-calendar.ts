import { google } from 'googleapis';
import type { CalendarEvent, CalendarSlot } from './types';

// Initialize OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);

// Set refresh token
if (process.env.GOOGLE_REFRESH_TOKEN) {
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });
}

const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

/**
 * Get upcoming calendar events for the next N days
 * @param days Number of days to look ahead (default: 60)
 */
export async function getUpcomingEvents(days: number = 60): Promise<CalendarEvent[]> {
  try {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: futureDate.toISOString(),
      maxResults: 100,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items || [];

    return events.map((event) => ({
      id: event.id || '',
      summary: event.summary || 'Untitled Event',
      description: event.description,
      start: event.start?.dateTime || event.start?.date || '',
      end: event.end?.dateTime || event.end?.date || '',
      location: event.location,
    }));
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    // Gracefully degrade - return empty array if calendar fails
    return [];
  }
}

interface FreeBusyPeriod {
  start: string;
  end: string;
}

/**
 * Get free/busy information for the next N hours
 * @param durationHours Number of hours to look ahead (default: 2)
 */
export async function getFreeBusy(durationHours: number = 2): Promise<FreeBusyPeriod[]> {
  try {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setHours(futureDate.getHours() + durationHours);

    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin: now.toISOString(),
        timeMax: futureDate.toISOString(),
        items: [{ id: 'primary' }],
      },
    });

    const busyPeriods = response.data.calendars?.primary?.busy || [];

    return busyPeriods.map((period) => ({
      start: period.start || '',
      end: period.end || '',
    }));
  } catch (error) {
    console.error('Error fetching free/busy data:', error);
    // Gracefully degrade - return empty array if calendar fails
    return [];
  }
}

/**
 * Find free slots in a time window, excluding busy periods
 * @param busyPeriods Array of busy time periods
 * @param windowEnd End of the time window to consider
 * @param minMinutes Minimum duration for a free slot (default: 15)
 */
export function findFreeSlots(
  busyPeriods: FreeBusyPeriod[],
  windowEnd: Date,
  minMinutes: number = 15
): CalendarSlot[] {
  const now = new Date();
  const freeSlots: CalendarSlot[] = [];

  // Sort busy periods by start time
  const sortedBusy = [...busyPeriods].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );

  let currentTime = now;

  for (const busy of sortedBusy) {
    const busyStart = new Date(busy.start);
    const busyEnd = new Date(busy.end);

    // Check if there's a free slot before this busy period
    if (currentTime < busyStart) {
      const durationMinutes = (busyStart.getTime() - currentTime.getTime()) / (1000 * 60);

      if (durationMinutes >= minMinutes) {
        freeSlots.push({
          start: currentTime.toISOString(),
          end: busyStart.toISOString(),
          duration_minutes: Math.floor(durationMinutes),
        });
      }
    }

    // Move current time to the end of this busy period
    if (busyEnd > currentTime) {
      currentTime = busyEnd;
    }
  }

  // Check if there's a free slot after the last busy period
  if (currentTime < windowEnd) {
    const durationMinutes = (windowEnd.getTime() - currentTime.getTime()) / (1000 * 60);

    if (durationMinutes >= minMinutes) {
      freeSlots.push({
        start: currentTime.toISOString(),
        end: windowEnd.toISOString(),
        duration_minutes: Math.floor(durationMinutes),
      });
    }
  }

  return freeSlots;
}
