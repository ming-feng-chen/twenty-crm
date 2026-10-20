// Civil dates (YYYY-MM-DD) as the UI shows and compares them. Formatting is
// done by hand rather than with Intl so the wording is the same in every
// browser: "Mon 20 Oct", British style, no comma.

export const DEFAULT_TIME_ZONE = 'Europe/London';

const CIVIL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const toUtcDate = (date: string): Date | null => {
  const match = CIVIL_DATE_PATTERN.exec(date);

  if (match === null) {
    return null;
  }

  const [, year, month, day] = match;
  const value = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));

  // Rejects 2026-02-30 and the like, which Date would roll over.
  return value.getUTCFullYear() === Number(year) &&
    value.getUTCMonth() === Number(month) - 1 &&
    value.getUTCDate() === Number(day)
    ? value
    : null;
};

export const isCivilDate = (value: unknown): value is string =>
  typeof value === 'string' && toUtcDate(value) !== null;

// DATE fields arrive as 'YYYY-MM-DD', sometimes as a midnight timestamp.
export const toCivilDate = (value: unknown): string | null => {
  if (typeof value !== 'string' || value.length < 10) {
    return null;
  }

  const candidate = value.slice(0, 10);

  return isCivilDate(candidate) ? candidate : null;
};

const isKnownTimeZone = (timeZone: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone });

    return true;
  } catch {
    return false;
  }
};

// Today on the wall calendar of the cadence's time zone, so My Day agrees
// with the engine (which dates everything in that zone), not with the laptop.
export const todayIn = (timeZone: string, now: Date = new Date()): string => {
  const zone = isKnownTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) =>
    parts.find((entry) => entry.type === type)?.value ?? '';

  return `${part('year')}-${part('month')}-${part('day')}`;
};

export const addDays = (date: string, days: number): string => {
  const value = toUtcDate(date);

  if (value === null) {
    throw new Error(`Not a date: ${date}`);
  }

  value.setUTCDate(value.getUTCDate() + days);

  return value.toISOString().slice(0, 10);
};

export const daysBetween = (from: string, to: string): number => {
  const start = toUtcDate(from);
  const end = toUtcDate(to);

  if (start === null || end === null) {
    return Number.NaN;
  }

  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
};

// "Mon 20 Oct"; the year is added only when it is not the current one.
export const formatDay = (
  date: string | null | undefined,
  { today }: { today?: string } = {},
): string => {
  if (date === null || date === undefined) {
    return '—';
  }

  const value = toUtcDate(date);

  if (value === null) {
    return date;
  }

  const text = `${WEEKDAYS_SHORT[value.getUTCDay()]} ${value.getUTCDate()} ${MONTHS_SHORT[value.getUTCMonth()]}`;
  const showYear =
    today !== undefined && today.slice(0, 4) !== date.slice(0, 4);

  return showYear ? `${text} ${value.getUTCFullYear()}` : text;
};

// "Friday 16 October 2026", for the page header.
export const formatLongDay = (date: string): string => {
  const value = toUtcDate(date);

  if (value === null) {
    return date;
  }

  return `${WEEKDAYS_LONG[value.getUTCDay()]} ${value.getUTCDate()} ${MONTHS_LONG[value.getUTCMonth()]} ${value.getUTCFullYear()}`;
};

// "Fri 16 Oct 2026, 20:34" for an instant, on the cadence's wall clock.
export const formatDateTime = (
  instant: string | null | undefined,
  timeZone: string = DEFAULT_TIME_ZONE,
): string => {
  if (instant === null || instant === undefined) {
    return '—';
  }

  const value = new Date(instant);

  if (Number.isNaN(value.getTime())) {
    return instant;
  }

  const zone = isKnownTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE;
  const day = todayIn(zone, value);
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(value);

  return `${formatDay(day)} ${day.slice(0, 4)}, ${time}`;
};

// "Overdue by 3 days" / "Due today" / "Due tomorrow".
export const describeDue = (date: string | null, today: string): string => {
  if (date === null) {
    return 'No date';
  }

  const days = daysBetween(today, date);

  if (Number.isNaN(days)) {
    return date;
  }

  if (days === 0) {
    return 'Due today';
  }

  if (days < 0) {
    return `Overdue by ${-days} ${-days === 1 ? 'day' : 'days'}`;
  }

  return days === 1 ? 'Due tomorrow' : `Due in ${days} days`;
};

export type DateCheck = { ok: true } | { ok: false; message: string };

// A touch is never dated after today (SPEC §6: future dates are refused).
export const checkTouchDate = (date: string, today: string): DateCheck => {
  if (!isCivilDate(date)) {
    return { ok: false, message: 'Pick the day it happened.' };
  }

  if (date > today) {
    return {
      ok: false,
      message: `That is in the future. A touch can be dated ${formatDay(today)} at the latest.`,
    };
  }

  return { ok: true };
};

// Snooze and Hold dates are about when to come back, so they must be later.
export const checkFutureDate = (
  date: string,
  today: string,
  { optional = false }: { optional?: boolean } = {},
): DateCheck => {
  if (date === '' && optional) {
    return { ok: true };
  }

  if (!isCivilDate(date)) {
    return { ok: false, message: 'Pick a date.' };
  }

  if (date <= today) {
    return { ok: false, message: 'Pick a day after today.' };
  }

  return { ok: true };
};
