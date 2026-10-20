import { describe, expect, it } from 'vitest';

import {
  addBusinessDays,
  addCalendarDays,
  businessDaysBetween,
  isWeekend,
  nextBusinessDay,
  toCivilDate,
} from '../business-days';
import { DEFAULT_CADENCE_CONFIG } from '../default-cadence-config';

// Ported from the predecessor's business-days.test.ts with identical expectations.

const CALENDAR = DEFAULT_CADENCE_CONFIG;
const LONDON = DEFAULT_CADENCE_CONFIG.timeZone;

// August 2026: the 17th is a Monday.
const MON = '2026-08-17';
const FRI = '2026-08-21';
const SAT = '2026-08-22';
const SUN = '2026-08-23';

describe('isWeekend', () => {
  it('knows Saturday and Sunday from the working week', () => {
    expect(isWeekend(SAT)).toBe(true);
    expect(isWeekend(SUN)).toBe(true);
    expect(isWeekend(MON)).toBe(false);
    expect(isWeekend(FRI)).toBe(false);
  });
});

describe('addBusinessDays', () => {
  it('adds within a week without touching a weekend', () => {
    expect(addBusinessDays(MON, 3, CALENDAR)).toBe('2026-08-20');
  });

  it('skips the weekend', () => {
    expect(addBusinessDays(FRI, 1, CALENDAR)).toBe('2026-08-24');
    expect(addBusinessDays(FRI, 3, CALENDAR)).toBe('2026-08-26');
    expect(addBusinessDays('2026-08-19', 3, CALENDAR)).toBe('2026-08-24');
  });

  it('counts from a weekend day onto the working week', () => {
    expect(addBusinessDays(SAT, 1, CALENDAR)).toBe('2026-08-24');
    expect(addBusinessDays(SUN, 3, CALENDAR)).toBe('2026-08-26');
  });

  it('leaves a weekend date alone at +0 rather than rounding it forward', () => {
    expect(addBusinessDays(SAT, 0, CALENDAR)).toBe(SAT);
    expect(nextBusinessDay(SAT, CALENDAR)).toBe('2026-08-24');
    expect(nextBusinessDay(MON, CALENDAR)).toBe(MON);
  });

  it('runs backwards too', () => {
    expect(addBusinessDays('2026-08-24', -1, CALENDAR)).toBe(FRI);
    expect(addBusinessDays('2026-08-26', -3, CALENDAR)).toBe(FRI);
  });

  it('crosses a month and a year boundary', () => {
    expect(addBusinessDays('2026-08-31', 3, CALENDAR)).toBe('2026-09-03');
    expect(addBusinessDays('2026-12-31', 1, CALENDAR)).toBe('2027-01-01');
    expect(addBusinessDays('2027-01-01', 1, CALENDAR)).toBe('2027-01-04');
  });

  it('does not skip holidays — deliberate, there is no holiday calendar', () => {
    expect(addBusinessDays('2026-12-24', 1, CALENDAR)).toBe('2026-12-25');
  });
});

describe('addCalendarDays', () => {
  it('does not skip weekends — the drip and InMail branch count calendar days', () => {
    expect(addCalendarDays(FRI, 1)).toBe(SAT);
    expect(addCalendarDays(MON, 30)).toBe('2026-09-16');
    expect(addCalendarDays(MON, 14)).toBe('2026-08-31');
  });
});

describe('businessDaysBetween', () => {
  it('counts working days of silence', () => {
    expect(businessDaysBetween(MON, MON, CALENDAR)).toBe(0);
    expect(businessDaysBetween(MON, '2026-08-20', CALENDAR)).toBe(3);
    expect(businessDaysBetween(FRI, '2026-08-24', CALENDAR)).toBe(1);
    expect(businessDaysBetween(FRI, '2026-08-26', CALENDAR)).toBe(3);
  });

  it('counts a weekend as no elapsed working time', () => {
    expect(businessDaysBetween(FRI, SAT, CALENDAR)).toBe(0);
    expect(businessDaysBetween(FRI, SUN, CALENDAR)).toBe(0);
  });

  it('is the inverse of addBusinessDays for business-day starts', () => {
    expect(
      businessDaysBetween(MON, addBusinessDays(MON, 3, CALENDAR), CALENDAR),
    ).toBe(3);
    expect(
      businessDaysBetween(FRI, addBusinessDays(FRI, 3, CALENDAR), CALENDAR),
    ).toBe(3);
  });

  it('goes negative backwards', () => {
    expect(businessDaysBetween('2026-08-20', MON, CALENDAR)).toBe(-3);
  });
});

describe('toCivilDate in Europe/London', () => {
  it("uses London's calendar, not the server's", () => {
    expect(toCivilDate(new Date('2026-06-30T23:30:00Z'), LONDON)).toBe(
      '2026-07-01',
    );
    expect(toCivilDate(new Date('2026-06-30T22:59:00Z'), LONDON)).toBe(
      '2026-06-30',
    );
  });

  it('handles GMT, when London and UTC agree', () => {
    expect(toCivilDate(new Date('2026-01-15T23:30:00Z'), LONDON)).toBe(
      '2026-01-15',
    );
  });

  it('is correct on both sides of the clock change', () => {
    expect(toCivilDate(new Date('2026-03-29T00:30:00Z'), LONDON)).toBe(
      '2026-03-29',
    );
    expect(toCivilDate(new Date('2026-10-24T23:30:00Z'), LONDON)).toBe(
      '2026-10-25',
    );
    expect(toCivilDate(new Date('2026-10-25T23:30:00Z'), LONDON)).toBe(
      '2026-10-25',
    );
  });

  it('survives a weekend boundary at the edge of the day', () => {
    const logged = toCivilDate(new Date('2026-08-21T23:30:00Z'), LONDON);

    expect(logged).toBe(SAT);
    expect(addBusinessDays(logged, 3, CALENDAR)).toBe('2026-08-26');
  });
});

describe('input validation', () => {
  it('rejects malformed and impossible dates loudly', () => {
    expect(() => isWeekend('17-08-2026')).toThrow(/YYYY-MM-DD/);
    expect(() => isWeekend('2026-8-17')).toThrow(/YYYY-MM-DD/);
    expect(() => isWeekend('2026-02-30')).toThrow(/Not a real calendar date/);
    expect(() => addBusinessDays(MON, 1.5, CALENDAR)).toThrow(/whole number/);
    expect(() => toCivilDate(new Date('nonsense'), LONDON)).toThrow(
      /invalid Date/,
    );
  });
});
