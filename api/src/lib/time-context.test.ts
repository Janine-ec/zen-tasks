import { afterEach, describe, expect, it, vi } from 'vitest';
import { getTimeContext } from './time-context';

// Jan 15 2024 = Monday, Jan 13 2024 = Saturday, Jan 14 2024 = Sunday
function mockTime(isoLocal: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(isoLocal));
}

describe('getTimeContext', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('timeOfDay boundaries', () => {
    it('returns early_morning before 9am', () => {
      mockTime('2024-01-15T06:30:00');
      expect(getTimeContext().timeOfDay).toBe('early_morning');
    });

    it('returns early_morning at midnight', () => {
      mockTime('2024-01-15T00:00:00');
      expect(getTimeContext().timeOfDay).toBe('early_morning');
    });

    it('returns early_morning at 8:59', () => {
      mockTime('2024-01-15T08:59:00');
      expect(getTimeContext().timeOfDay).toBe('early_morning');
    });

    it('returns morning at 9:00', () => {
      mockTime('2024-01-15T09:00:00');
      expect(getTimeContext().timeOfDay).toBe('morning');
    });

    it('returns morning at 11:59', () => {
      mockTime('2024-01-15T11:59:00');
      expect(getTimeContext().timeOfDay).toBe('morning');
    });

    it('returns afternoon at noon', () => {
      mockTime('2024-01-15T12:00:00');
      expect(getTimeContext().timeOfDay).toBe('afternoon');
    });

    it('returns afternoon at 16:59', () => {
      mockTime('2024-01-15T16:59:00');
      expect(getTimeContext().timeOfDay).toBe('afternoon');
    });

    it('returns evening at 17:00', () => {
      mockTime('2024-01-15T17:00:00');
      expect(getTimeContext().timeOfDay).toBe('evening');
    });

    it('returns evening at 19:59', () => {
      mockTime('2024-01-15T19:59:00');
      expect(getTimeContext().timeOfDay).toBe('evening');
    });

    it('returns night at 20:00', () => {
      mockTime('2024-01-15T20:00:00');
      expect(getTimeContext().timeOfDay).toBe('night');
    });

    it('returns night at 23:00', () => {
      mockTime('2024-01-15T23:00:00');
      expect(getTimeContext().timeOfDay).toBe('night');
    });
  });

  describe('isWeekend', () => {
    it('is false on Monday', () => {
      mockTime('2024-01-15T10:00:00');
      expect(getTimeContext().isWeekend).toBe(false);
    });

    it('is false on Friday', () => {
      mockTime('2024-01-19T10:00:00');
      expect(getTimeContext().isWeekend).toBe(false);
    });

    it('is true on Saturday', () => {
      mockTime('2024-01-13T10:00:00');
      expect(getTimeContext().isWeekend).toBe(true);
    });

    it('is true on Sunday', () => {
      mockTime('2024-01-14T10:00:00');
      expect(getTimeContext().isWeekend).toBe(true);
    });
  });

  describe('isBusinessHours', () => {
    it('is true on a weekday at 10am', () => {
      mockTime('2024-01-15T10:00:00');
      expect(getTimeContext().isBusinessHours).toBe(true);
    });

    it('is true at exactly 8am on a weekday', () => {
      mockTime('2024-01-15T08:00:00');
      expect(getTimeContext().isBusinessHours).toBe(true);
    });

    it('is false at 7:59am (before business hours)', () => {
      mockTime('2024-01-15T07:59:00');
      expect(getTimeContext().isBusinessHours).toBe(false);
    });

    it('is false at 18:00 (end of business hours)', () => {
      mockTime('2024-01-15T18:00:00');
      expect(getTimeContext().isBusinessHours).toBe(false);
    });

    it('is false on Saturday even at 10am', () => {
      mockTime('2024-01-13T10:00:00');
      expect(getTimeContext().isBusinessHours).toBe(false);
    });

    it('is false on Sunday even at 10am', () => {
      mockTime('2024-01-14T10:00:00');
      expect(getTimeContext().isBusinessHours).toBe(false);
    });
  });

  describe('other fields', () => {
    it('currentTime is an ISO string', () => {
      mockTime('2024-01-15T10:00:00');
      expect(getTimeContext().currentTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('dayOfWeek is the full weekday name', () => {
      mockTime('2024-01-15T10:00:00'); // Monday
      expect(getTimeContext().dayOfWeek).toBe('Monday');
    });

    it('dayOfWeek is correct for Saturday', () => {
      mockTime('2024-01-13T10:00:00'); // Saturday
      expect(getTimeContext().dayOfWeek).toBe('Saturday');
    });
  });
});
