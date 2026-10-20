import { describe, expect, it } from 'vitest';

import { isWeekend } from '../business-days';
import { DEFAULT_CADENCE_CONFIG } from '../default-cadence-config';
import { spreadOverWindow } from '../spread';

// Ported from the predecessor's spread.test.ts with identical expectations.

const CALENDAR = DEFAULT_CADENCE_CONFIG;
const MONDAY = '2026-08-24';

const ids = (count: number): string[] =>
  Array.from({ length: count }, (_, index) => `c${index}`);

const dates = (count: number, from: string, window: number): string[] =>
  spreadOverWindow(ids(count), from, window, CALENDAR).map(
    (placement) => placement.nextActionDate,
  );

describe('spreadOverWindow', () => {
  it('spends the whole window and leaves no tail', () => {
    const placed = dates(25, MONDAY, 10);
    const perDay = new Map<string, number>();

    for (const date of placed) {
      perDay.set(date, (perDay.get(date) ?? 0) + 1);
    }

    expect(perDay.size).toBe(10);
    expect([...perDay.values()]).toEqual([3, 2, 3, 2, 3, 2, 3, 2, 3, 2]);
    expect(placed[0]).toBe(MONDAY);
  });

  it('never lands anybody on a weekend', () => {
    for (const date of dates(40, MONDAY, 15)) {
      expect(isWeekend(date), `${date} is a weekend`).toBe(false);
    }
  });

  it('starts on the next business day when asked to start on a weekend', () => {
    expect(dates(3, '2026-08-22', 5)[0]).toBe(MONDAY);
  });

  it('keeps the order it was given, so the longest overdue stays first', () => {
    const placed = spreadOverWindow(
      ['oldest', 'middle', 'newest'],
      MONDAY,
      6,
      CALENDAR,
    );

    expect(placed.map((placement) => placement.contactId)).toEqual([
      'oldest',
      'middle',
      'newest',
    ]);
    expect(placed[0].nextActionDate <= placed[1].nextActionDate).toBe(true);
    expect(placed[1].nextActionDate <= placed[2].nextActionDate).toBe(true);
  });

  it('spreads fewer people than days across the window rather than crowding the front', () => {
    expect(dates(3, MONDAY, 10)).toEqual([
      '2026-08-24',
      '2026-08-27',
      '2026-09-01',
    ]);
  });

  it('puts everybody on one day when the window is one day', () => {
    expect(new Set(dates(5, MONDAY, 1)).size).toBe(1);
  });

  it('returns nothing for nobody, rather than inventing a date', () => {
    expect(spreadOverWindow([], MONDAY, 10, CALENDAR)).toEqual([]);
  });

  it('refuses a window that is not at least one business day', () => {
    expect(() => spreadOverWindow(ids(3), MONDAY, 0, CALENDAR)).toThrow(
      /at least one business day/,
    );
    expect(() => spreadOverWindow(ids(3), MONDAY, -5, CALENDAR)).toThrow(
      /at least one business day/,
    );
    expect(() => spreadOverWindow(ids(3), MONDAY, 2.5, CALENDAR)).toThrow(
      /at least one business day/,
    );
  });
});
