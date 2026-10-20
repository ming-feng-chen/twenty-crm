import { describe, expect, it } from 'vitest';

import {
  addDays,
  checkFutureDate,
  checkTouchDate,
  daysBetween,
  describeDue,
  formatDateTime,
  formatDay,
  formatLongDay,
  isCivilDate,
  toCivilDate,
  todayIn,
} from 'src/ui/dates';

describe('formatDay', () => {
  it('formats as "Mon 20 Oct"', () => {
    expect(formatDay('2026-10-19')).toBe('Mon 19 Oct');
    expect(formatDay('2026-10-20')).toBe('Tue 20 Oct');
    expect(formatDay('2026-01-01')).toBe('Thu 1 Jan');
  });

  it('adds the year only when it is not the current one', () => {
    expect(formatDay('2026-10-16', { today: '2026-10-16' })).toBe('Fri 16 Oct');
    expect(formatDay('2025-12-31', { today: '2026-01-02' })).toBe('Wed 31 Dec 2025');
  });

  it('shows a dash for no date and the raw text for nonsense', () => {
    expect(formatDay(null)).toBe('—');
    expect(formatDay('soon')).toBe('soon');
  });
});

describe('formatLongDay', () => {
  it('spells the header date out', () => {
    expect(formatLongDay('2026-10-16')).toBe('Friday 16 October 2026');
  });
});

describe('formatDateTime', () => {
  it('shows the wall clock of the cadence time zone (BST in October)', () => {
    expect(formatDateTime('2026-10-16T19:34:51.264Z', 'Europe/London')).toBe(
      'Fri 16 Oct 2026, 20:34',
    );
  });

  it('crosses midnight in the zone, not in UTC', () => {
    expect(formatDateTime('2026-10-16T23:30:00Z', 'Europe/London')).toBe(
      'Sat 17 Oct 2026, 00:30',
    );
  });
});

describe('civil dates', () => {
  it('accepts real dates only', () => {
    expect(isCivilDate('2026-02-28')).toBe(true);
    expect(isCivilDate('2026-02-30')).toBe(false);
    expect(isCivilDate('2026-2-3')).toBe(false);
    expect(isCivilDate(null)).toBe(false);
  });

  it('reads DATE values and midnight timestamps', () => {
    expect(toCivilDate('2026-10-16')).toBe('2026-10-16');
    expect(toCivilDate('2026-10-16T00:00:00.000Z')).toBe('2026-10-16');
    expect(toCivilDate('')).toBeNull();
    expect(toCivilDate(undefined)).toBeNull();
  });

  it('adds days and counts between them across month ends', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-10-12', '2026-10-16')).toBe(4);
  });
});

describe('todayIn', () => {
  it('uses the cadence time zone, not UTC', () => {
    const lateEvening = new Date('2026-10-16T23:30:00Z');

    expect(todayIn('Europe/London', lateEvening)).toBe('2026-10-17');
    expect(todayIn('UTC', lateEvening)).toBe('2026-10-16');
  });

  it('falls back to London for an unknown zone', () => {
    expect(todayIn('Mars/Base', new Date('2026-10-16T23:30:00Z'))).toBe('2026-10-17');
  });
});

describe('describeDue', () => {
  it('words due-ness', () => {
    expect(describeDue('2026-10-16', '2026-10-16')).toBe('Due today');
    expect(describeDue('2026-10-15', '2026-10-16')).toBe('Overdue by 1 day');
    expect(describeDue('2026-10-12', '2026-10-16')).toBe('Overdue by 4 days');
    expect(describeDue(null, '2026-10-16')).toBe('No date');
  });
});

describe('date checks', () => {
  it('refuses a future touch date and accepts today or earlier', () => {
    expect(checkTouchDate('2026-10-16', '2026-10-16')).toEqual({ ok: true });
    expect(checkTouchDate('2026-10-01', '2026-10-16')).toEqual({ ok: true });
    expect(checkTouchDate('2026-10-17', '2026-10-16').ok).toBe(false);
    expect(checkTouchDate('', '2026-10-16').ok).toBe(false);
  });

  it('wants snooze and hold dates after today', () => {
    expect(checkFutureDate('2026-10-17', '2026-10-16')).toEqual({ ok: true });
    expect(checkFutureDate('2026-10-16', '2026-10-16').ok).toBe(false);
    expect(checkFutureDate('', '2026-10-16').ok).toBe(false);
    expect(checkFutureDate('', '2026-10-16', { optional: true })).toEqual({ ok: true });
  });
});
