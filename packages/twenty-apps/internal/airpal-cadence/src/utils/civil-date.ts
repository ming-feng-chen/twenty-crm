import { toCivilDate } from 'src/engine';

const DATE_PREFIX = /^\d{4}-\d{2}-\d{2}/;

// DATE fields arrive as 'YYYY-MM-DD' (or, from some code paths, an ISO
// timestamp at UTC midnight). Anything else is treated as no date.
export const toDateOnly = (value: unknown): string | null =>
  typeof value === 'string' && DATE_PREFIX.test(value)
    ? value.slice(0, 10)
    : null;

// "Today" is the civil date in the cadence's time zone, never the server's.
export const todayIn = (timeZone: string, now: Date = new Date()): string =>
  toCivilDate(now, timeZone);

// The hour on the wall clock in the cadence's time zone, 0-23.
export const localHourIn = (timeZone: string, now: Date = new Date()): number =>
  Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(now),
  );
