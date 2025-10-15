/**
 * Utility functions for parsing notification time strings
 */

export interface ParsedTime {
  hours: number;
  minutes: number;
  totalMinutes: number;
}

/**
 * Parse time string like "30m", "4.5h", "1d", "2h30m"
 * Returns total minutes
 */
export function parseNotificationTime(timeStr: string): number {
  const normalized = timeStr.toLowerCase().trim();
  
  // Handle days
  if (normalized.endsWith('d')) {
    const days = parseFloat(normalized.slice(0, -1));
    return Math.round(days * 24 * 60);
  }
  
  // Handle hours
  if (normalized.endsWith('h')) {
    const hours = parseFloat(normalized.slice(0, -1));
    return Math.round(hours * 60);
  }
  
  // Handle minutes
  if (normalized.endsWith('m')) {
    const minutes = parseFloat(normalized.slice(0, -1));
    return Math.round(minutes);
  }
  
  // Handle decimal hours (e.g., "4.5" = 4.5 hours)
  const decimalHours = parseFloat(normalized);
  if (!isNaN(decimalHours)) {
    return Math.round(decimalHours * 60);
  }
  
  throw new Error(`Invalid time format: ${timeStr}`);
}

/**
 * Parse comma-separated time strings
 * Returns array of total minutes
 */
export function parseNotificationTimes(timeStr: string): number[] {
  const times = timeStr.split(',').map(t => t.trim()).filter(t => t.length > 0);
  return times.map(parseNotificationTime);
}

/**
 * Format minutes back to human-readable string
 */
export function formatNotificationTime(minutes: number): string {
  if (minutes >= 1440) { // 24 hours or more
    const days = Math.round(minutes / 1440 * 10) / 10;
    return `${days}d`;
  } else if (minutes >= 60) {
    const hours = Math.round(minutes / 60 * 10) / 10;
    return `${hours}h`;
  } else {
    return `${minutes}m`;
  }
}

/**
 * Validate notification time string
 */
export function isValidNotificationTime(timeStr: string): boolean {
  try {
    parseNotificationTime(timeStr);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate comma-separated notification times
 */
export function isValidNotificationTimes(timeStr: string): boolean {
  try {
    parseNotificationTimes(timeStr);
    return true;
  } catch {
    return false;
  }
}
