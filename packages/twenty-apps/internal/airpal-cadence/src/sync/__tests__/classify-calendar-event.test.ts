import { describe, expect, it } from 'vitest';

import { buildAirPalIdentity } from 'src/sync/airpal-identity';
import {
  classifyCalendarEvent,
  type SyncCalendarEvent,
} from 'src/sync/classify-calendar-event';
import { eventDateOf, hasEventStarted } from 'src/sync/sync-dates';

const identity = buildAirPalIdentity([{ id: 'member-rep', userEmail: 'rep@airpal.co.uk' }]);
const now = new Date('2026-10-16T13:00:00Z'); // 14:00 in London (BST)
const context = { identity, timeZone: 'Europe/London', today: '2026-10-16', now };

const event = (overrides: Partial<SyncCalendarEvent>): SyncCalendarEvent => ({
  id: 'event-1',
  startsAt: '2026-10-16T09:00:00.000Z',
  isFullDay: false,
  isCanceled: false,
  deletedAt: null,
  participants: [
    { handle: 'rep@airpal.co.uk', workspaceMemberId: 'member-rep', responseStatus: 'ACCEPTED' },
    { handle: 'aditi@example.com', personId: 'person-aditi', responseStatus: 'ACCEPTED' },
    { handle: 'ben@example.org', personId: 'person-ben', responseStatus: 'NEEDS_ACTION' },
  ],
  ...overrides,
});

describe('classifyCalendarEvent', () => {
  it('gives each CRM person a meeting touch once the meeting has begun', () => {
    expect(classifyCalendarEvent(event({}), context)).toEqual({
      kind: 'touches',
      occurredOn: '2026-10-16',
      touches: [
        { personId: 'person-aditi', occurredOn: '2026-10-16', calendarEventId: 'event-1' },
        { personId: 'person-ben', occurredOn: '2026-10-16', calendarEventId: 'event-1' },
      ],
    });
  });

  it('waits for a meeting later today or in the future', () => {
    expect(
      classifyCalendarEvent(event({ startsAt: '2026-10-16T15:00:00Z' }), context),
    ).toEqual({ kind: 'noTouch', reason: 'notStarted', occurredOn: '2026-10-16' });
    expect(
      classifyCalendarEvent(event({ startsAt: '2026-10-20T09:00:00Z' }), context),
    ).toEqual({ kind: 'noTouch', reason: 'notStarted', occurredOn: '2026-10-20' });
  });

  it('creates nothing for a cancelled, deleted or undated event', () => {
    expect(classifyCalendarEvent(event({ isCanceled: true }), context)).toMatchObject({
      kind: 'noTouch',
      reason: 'cancelled',
    });
    expect(classifyCalendarEvent(event({ deletedAt: '2026-10-16T10:00:00Z' }), context)).toMatchObject({
      kind: 'noTouch',
      reason: 'deleted',
    });
    expect(classifyCalendarEvent(event({ startsAt: null }), context)).toMatchObject({
      kind: 'noTouch',
      reason: 'noDate',
    });
  });

  it('leaves out members, people who declined, and handles not in the CRM', () => {
    const result = classifyCalendarEvent(
      event({
        participants: [
          { handle: 'rep@airpal.co.uk', personId: 'person-rep-record', responseStatus: 'ACCEPTED' },
          { handle: 'aditi@example.com', personId: 'person-aditi', responseStatus: 'DECLINED' },
          { handle: 'stranger@example.com', personId: null, responseStatus: 'ACCEPTED' },
        ],
      }),
      context,
    );

    expect(result).toEqual({ kind: 'noTouch', reason: 'noCrmPerson', occurredOn: '2026-10-16' });
  });

  it('dates an all-day event on its own date', () => {
    const allDay = event({ startsAt: '2026-10-16T00:00:00.000Z', isFullDay: true });

    expect(classifyCalendarEvent(allDay, context)).toMatchObject({
      kind: 'touches',
      occurredOn: '2026-10-16',
    });
    expect(
      classifyCalendarEvent(event({ startsAt: '2026-10-17T00:00:00.000Z', isFullDay: true }), context),
    ).toMatchObject({ kind: 'noTouch', reason: 'notStarted', occurredOn: '2026-10-17' });
  });
});

describe('event dates', () => {
  it('uses the London day for a timed event and the date for an all-day one', () => {
    expect(eventDateOf({ startsAt: '2026-10-15T23:30:00Z', isFullDay: false }, 'Europe/London')).toBe(
      '2026-10-16',
    );
    expect(eventDateOf({ startsAt: '2026-10-16T00:00:00Z', isFullDay: true }, 'America/New_York')).toBe(
      '2026-10-16',
    );
    expect(eventDateOf({ startsAt: 'nonsense', isFullDay: true }, 'Europe/London')).toBeNull();
  });

  it('knows when a meeting has begun', () => {
    const clock = { now, today: '2026-10-16', timeZone: 'Europe/London' };

    expect(hasEventStarted({ startsAt: '2026-10-16T13:00:00Z', isFullDay: false }, clock)).toBe(true);
    expect(hasEventStarted({ startsAt: '2026-10-16T13:00:01Z', isFullDay: false }, clock)).toBe(false);
    expect(hasEventStarted({ startsAt: '2026-10-16T00:00:00Z', isFullDay: true }, clock)).toBe(true);
    expect(hasEventStarted({ startsAt: '2026-10-17T00:00:00Z', isFullDay: true }, clock)).toBe(false);
  });
});
