import type { TimeContext } from './types';

/**
 * Get current time context for time-of-day awareness
 * Based on the logic from workflow 05 - Enrich with Calendar node
 */
export function getTimeContext(): TimeContext {
  const now = new Date();
  const hours = now.getHours();
  const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });
  const isWeekend = [0, 6].includes(now.getDay());

  let timeOfDay: TimeContext['timeOfDay'];
  if (hours < 9) {
    timeOfDay = 'early_morning';
  } else if (hours < 12) {
    timeOfDay = 'morning';
  } else if (hours < 17) {
    timeOfDay = 'afternoon';
  } else if (hours < 20) {
    timeOfDay = 'evening';
  } else {
    timeOfDay = 'night';
  }

  const isBusinessHours = hours >= 8 && hours < 18 && !isWeekend;

  return {
    currentTime: now.toISOString(),
    timeOfDay,
    dayOfWeek,
    isWeekend,
    isBusinessHours,
  };
}
