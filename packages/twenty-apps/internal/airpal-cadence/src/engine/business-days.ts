import type {
  CadenceCalendar,
  CadenceDate,
  CadenceDateInput,
  CadenceDuration,
} from './types';

// Holidays are never skipped, deliberately: there is no holiday calendar.

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MILLISECONDS_PER_DAY = 86_400_000;

const civilDateFormatters = new Map<string, Intl.DateTimeFormat>();

const getCivilDateFormatter = (timeZone: string): Intl.DateTimeFormat => {
  const cached = civilDateFormatters.get(timeZone);

  if (cached !== undefined) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  civilDateFormatters.set(timeZone, formatter);

  return formatter;
};

// A named zone, never a fixed offset: BST and GMT differ by a day at the edges.
export const toCivilDate = (instant: Date, timeZone: string): CadenceDate => {
  if (Number.isNaN(instant.getTime())) {
    throw new TypeError('toCivilDate received an invalid Date');
  }

  const parts = getCivilDateFormatter(timeZone).formatToParts(instant);

  const part = (type: Intl.DateTimeFormatPartTypes): string => {
    const found = parts.find((candidate) => candidate.type === type);

    if (found === undefined) {
      throw new Error(`Intl did not return a ${type} part for ${timeZone}`);
    }

    return found.value;
  };

  return `${part('year')}-${part('month')}-${part('day')}`;
};

// UTC midnight is an arithmetic anchor only, so DST never enters day addition.
const anchor = (date: CadenceDate): number => {
  if (!DATE_PATTERN.test(date)) {
    throw new TypeError(`Expected a YYYY-MM-DD date, received: ${date}`);
  }

  const milliseconds = Date.parse(`${date}T00:00:00Z`);

  if (Number.isNaN(milliseconds)) {
    throw new TypeError(`Not a real calendar date: ${date}`);
  }

  // Some engines roll 2026-02-30 over to March instead of rejecting it.
  if (new Date(milliseconds).toISOString().slice(0, 10) !== date) {
    throw new TypeError(`Not a real calendar date: ${date}`);
  }

  return milliseconds;
};

const format = (milliseconds: number): CadenceDate =>
  new Date(milliseconds).toISOString().slice(0, 10);

const assertWholeNumber = (value: number, functionName: string): void => {
  if (!Number.isInteger(value)) {
    throw new TypeError(
      `${functionName} expects a whole number of days, received: ${value}`,
    );
  }
};

export const toCadenceDate = (
  input: CadenceDateInput,
  timeZone: string,
): CadenceDate => {
  if (typeof input === 'string') {
    anchor(input);

    return input;
  }

  return toCivilDate(input, timeZone);
};

export const isWeekend = (date: CadenceDate): boolean => {
  const day = new Date(anchor(date)).getUTCDay();

  return day === 0 || day === 6;
};

export const isBusinessDay = (
  date: CadenceDate,
  calendar: CadenceCalendar,
): boolean => !calendar.skipWeekends || !isWeekend(date);

export const addCalendarDays = (date: CadenceDate, days: number): CadenceDate => {
  assertWholeNumber(days, 'addCalendarDays');

  return format(anchor(date) + days * MILLISECONDS_PER_DAY);
};

// Counts business days landed on, so +0 on a Saturday stays on that Saturday.
export const addBusinessDays = (
  date: CadenceDate,
  days: number,
  calendar: CadenceCalendar,
): CadenceDate => {
  assertWholeNumber(days, 'addBusinessDays');

  if (!calendar.skipWeekends) {
    return addCalendarDays(date, days);
  }

  const step = days < 0 ? -1 : 1;
  let remaining = Math.abs(days);
  let milliseconds = anchor(date);

  while (remaining > 0) {
    milliseconds += step * MILLISECONDS_PER_DAY;

    if (!isWeekend(format(milliseconds))) {
      remaining -= 1;
    }
  }

  return format(milliseconds);
};

export const nextBusinessDay = (
  date: CadenceDate,
  calendar: CadenceCalendar,
): CadenceDate => {
  let milliseconds = anchor(date);

  while (!isBusinessDay(format(milliseconds), calendar)) {
    milliseconds += MILLISECONDS_PER_DAY;
  }

  return format(milliseconds);
};

// Counts the days after `from` up to and including `to`; Friday to Monday is 1.
export const businessDaysBetween = (
  from: CadenceDate,
  to: CadenceDate,
  calendar: CadenceCalendar,
): number => {
  const start = anchor(from);
  const end = anchor(to);

  if (start === end) {
    return 0;
  }

  const step = end > start ? MILLISECONDS_PER_DAY : -MILLISECONDS_PER_DAY;
  let milliseconds = start;
  let count = 0;

  while (milliseconds !== end) {
    milliseconds += step;

    if (isBusinessDay(format(milliseconds), calendar)) {
      count += step > 0 ? 1 : -1;
    }
  }

  return count;
};

export const addDuration = (
  date: CadenceDate,
  duration: CadenceDuration,
  calendar: CadenceCalendar,
): CadenceDate =>
  duration.unit === 'calendarDays'
    ? addCalendarDays(date, duration.amount)
    : addBusinessDays(date, duration.amount, calendar);
