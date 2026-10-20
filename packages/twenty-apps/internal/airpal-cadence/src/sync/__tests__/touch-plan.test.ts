import { describe, expect, it } from 'vitest';

import { matchBounce } from 'src/sync/bounce';
import {
  dayGroupKey,
  decideTouchAction,
  type ExistingTouch,
  planConvergence,
  retiredExternalId,
  type SyncTouchCandidate,
  syncTouchId,
} from 'src/sync/touch-plan';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const candidate: SyncTouchCandidate = {
  source: 'GMAIL',
  personId: 'person-aditi',
  channel: 'EMAIL',
  direction: 'OUTBOUND',
  occurredOn: '2026-10-15',
  externalId: 'message-1',
};
const ownId = syncTouchId(candidate);

const touch = (overrides: Partial<ExistingTouch>): ExistingTouch => ({
  id: 'touch-x',
  personId: 'person-aditi',
  channel: 'EMAIL',
  direction: 'OUTBOUND',
  occurredOn: '2026-10-15',
  source: 'MANUAL',
  externalId: null,
  outcome: null,
  createdAt: '2026-10-15T10:00:00.000Z',
  deletedAt: null,
  ...overrides,
});

describe('syncTouchId', () => {
  it('is a valid UUID, stable, and different per person, message and source', () => {
    expect(ownId).toMatch(UUID);
    expect(syncTouchId(candidate)).toBe(ownId);
    expect(syncTouchId({ ...candidate, personId: 'person-ben' })).not.toBe(ownId);
    expect(syncTouchId({ ...candidate, externalId: 'message-2' })).not.toBe(ownId);
    expect(syncTouchId({ ...candidate, source: 'CALENDAR' })).not.toBe(ownId);
  });

  it('does not depend on the day, so a moved meeting keeps its touch', () => {
    expect(syncTouchId({ ...candidate, occurredOn: '2026-10-20' })).toBe(ownId);
  });
});

describe('decideTouchAction', () => {
  it('keeps the latest email time without consuming another same-day step', () => {
    const timed = { ...candidate, occurredAt: '2026-10-15T16:00:00.000Z' };
    const morning = touch({
      id: 'morning', source: 'GMAIL', externalId: 'morning-email',
      occurredAt: '2026-10-15T09:00:00.000Z',
    });

    expect(decideTouchAction(timed, [morning])).toEqual({ kind: 'recordTime', touchId: 'morning' });
    expect(decideTouchAction({ ...timed, occurredAt: '2026-10-15T08:00:00.000Z' }, [morning]))
      .toMatchObject({ kind: 'none' });
    expect(decideTouchAction(timed, [{ ...morning, source: 'MANUAL' }]))
      .toEqual({ kind: 'recordTime', touchId: 'morning' });
  });

  it('adds missing precision on retry without reviving an undone touch', () => {
    const timed = { ...candidate, occurredAt: '2026-10-15T09:00:00.000Z' };
    const existing = touch({ id: ownId, source: 'GMAIL', externalId: candidate.externalId });

    expect(decideTouchAction(timed, [existing])).toEqual({ kind: 'recordTime', touchId: ownId });
    expect(decideTouchAction(timed, [{ ...existing, deletedAt: '2026-10-15T12:00:00Z' }]))
      .toMatchObject({ kind: 'none' });
  });

  it('creates when nothing matches', () => {
    expect(decideTouchAction(candidate, [])).toEqual({ kind: 'create', id: ownId });
    // Another day, channel, direction or person does not match.
    expect(
      decideTouchAction(candidate, [
        touch({ occurredOn: '2026-10-14' }),
        touch({ channel: 'LINKEDIN_MESSAGE' }),
        touch({ direction: 'INBOUND' }),
        touch({ personId: 'person-ben' }),
      ]),
    ).toEqual({ kind: 'create', id: ownId });
  });

  it('skips when the same synced touch exists (retry, second participant)', () => {
    expect(
      decideTouchAction(candidate, [touch({ id: ownId, source: 'GMAIL', externalId: 'message-1' })]),
    ).toMatchObject({ kind: 'none' });
  });

  it('respects an Undo: a deleted synced touch is not recreated', () => {
    expect(
      decideTouchAction(candidate, [
        touch({ id: ownId, source: 'GMAIL', externalId: 'message-1', deletedAt: '2026-10-15T12:00:00Z' }),
      ]),
    ).toMatchObject({ kind: 'none' });
    expect(
      decideTouchAction(candidate, [
        touch({ id: 'manual-1', externalId: 'message-1', deletedAt: '2026-10-15T12:00:00Z' }),
      ]),
    ).toMatchObject({ kind: 'none' });
  });

  it('skips when a manual touch already carries the external id', () => {
    expect(
      decideTouchAction(candidate, [touch({ id: 'manual-1', externalId: 'message-1' })]),
    ).toMatchObject({ kind: 'none' });
  });

  it('enriches a manual "Did it" of the same day instead of duplicating it', () => {
    expect(
      decideTouchAction(candidate, [
        touch({ id: 'manual-2', createdAt: '2026-10-15T11:00:00Z' }),
        touch({ id: 'manual-1', createdAt: '2026-10-15T09:00:00Z' }),
      ]),
    ).toEqual({ kind: 'enrich', touchId: 'manual-1', reason: 'manual touch the same day' });
  });

  it('skips a second email the same day when a touch already stands for it', () => {
    expect(
      decideTouchAction(candidate, [
        touch({ id: 'synced-other', source: 'GMAIL', externalId: 'message-0' }),
      ]),
    ).toMatchObject({ kind: 'none' });
    expect(
      decideTouchAction(candidate, [touch({ id: 'manual-1', externalId: 'message-0' })]),
    ).toMatchObject({ kind: 'none' });
  });

  it('ignores a deleted same-day touch', () => {
    expect(
      decideTouchAction(candidate, [touch({ id: 'manual-1', deletedAt: '2026-10-15T12:00:00Z' })]),
    ).toEqual({ kind: 'create', id: ownId });
  });

  it('moves a meeting touch to its new day, and restores a retired one', () => {
    const meeting: SyncTouchCandidate = {
      ...candidate,
      source: 'CALENDAR',
      channel: 'MEETING',
      externalId: 'event-1',
      occurredOn: '2026-10-16',
    };
    const meetingId = syncTouchId(meeting);

    expect(
      decideTouchAction(meeting, [
        touch({ id: meetingId, source: 'CALENDAR', channel: 'MEETING', externalId: 'event-1', occurredOn: '2026-10-14' }),
      ]),
    ).toEqual({ kind: 'move', touchId: meetingId, from: '2026-10-14' });
    expect(
      decideTouchAction(meeting, [
        touch({
          id: meetingId,
          source: 'CALENDAR',
          channel: 'MEETING',
          externalId: retiredExternalId('event-1'),
          deletedAt: '2026-10-14T12:00:00Z',
        }),
      ]),
    ).toEqual({ kind: 'restore', touchId: meetingId });
  });

  it('never re-dates an email touch', () => {
    expect(
      decideTouchAction(candidate, [
        touch({ id: ownId, source: 'GMAIL', externalId: 'message-1', occurredOn: '2026-10-14' }),
      ]),
    ).toMatchObject({ kind: 'none' });
  });
});

describe('planConvergence', () => {
  it('preserves the latest precise time when same-day copies converge', () => {
    expect(planConvergence([
      touch({ id: 'manual', externalId: 'm1', occurredAt: '2026-10-15T09:00:00.000Z' }),
      touch({ id: 'synced', source: 'GMAIL', externalId: 'm2', occurredAt: '2026-10-15T16:00:00.000Z' }),
    ])).toEqual({
      survivorId: 'manual', deleteIds: ['synced'],
      update: { occurredAt: '2026-10-15T16:00:00.000Z' },
    });
  });

  it('does nothing for a single touch or only manual touches', () => {
    expect(planConvergence([touch({})])).toBeNull();
    expect(planConvergence([touch({ id: 'm1' }), touch({ id: 'm2' })])).toBeNull();
  });

  it('keeps the manual touch and folds the synced copy into it', () => {
    expect(
      planConvergence([
        touch({ id: 'synced', source: 'GMAIL', externalId: 'message-1', createdAt: '2026-10-15T09:00:00Z' }),
        touch({ id: 'manual', createdAt: '2026-10-15T10:00:00Z' }),
      ]),
    ).toEqual({ survivorId: 'manual', deleteIds: ['synced'], update: { externalId: 'message-1' } });
  });

  it('keeps the oldest synced touch when two runs raced', () => {
    expect(
      planConvergence([
        touch({ id: 'b', source: 'GMAIL', externalId: 'message-2', createdAt: '2026-10-15T10:00:00Z' }),
        touch({ id: 'a', source: 'GMAIL', externalId: 'message-1', createdAt: '2026-10-15T10:00:00Z' }),
      ]),
    ).toEqual({ survivorId: 'a', deleteIds: ['b'], update: null });
  });

  it('passes a bounce on to the survivor', () => {
    expect(
      planConvergence([
        touch({ id: 'manual', externalId: 'message-1' }),
        touch({ id: 'synced', source: 'GMAIL', externalId: 'message-2', outcome: 'BOUNCED' }),
      ]),
    ).toEqual({ survivorId: 'manual', deleteIds: ['synced'], update: { outcome: 'BOUNCED' } });
  });

  it('gives racing runs the same answer whatever order they read the rows in', () => {
    const rows = [
      touch({ id: 's2', source: 'GMAIL', externalId: 'm2', createdAt: '2026-10-15T10:00:02Z' }),
      touch({ id: 'man', createdAt: '2026-10-15T10:00:03Z' }),
      touch({ id: 's1', source: 'GMAIL', externalId: 'm1', createdAt: '2026-10-15T10:00:01Z' }),
    ];

    expect(planConvergence(rows)).toEqual(planConvergence([...rows].reverse()));
    expect(planConvergence(rows)).toEqual({
      survivorId: 'man',
      deleteIds: ['s1', 's2'],
      update: { externalId: 'm1' },
    });
  });

  it('ignores deleted rows', () => {
    expect(
      planConvergence([
        touch({ id: 'synced', source: 'GMAIL', externalId: 'm1' }),
        touch({ id: 'manual', deletedAt: '2026-10-15T12:00:00Z' }),
      ]),
    ).toBeNull();
  });
});

describe('dayGroupKey', () => {
  it('compares the day, not the time a DATE came back with', () => {
    expect(dayGroupKey(touch({ occurredOn: '2026-10-15T00:00:00.000Z' }))).toBe(
      dayGroupKey(touch({ occurredOn: '2026-10-15' })),
    );
  });
});

describe('matchBounce', () => {
  const sent = (overrides: Partial<Parameters<typeof matchBounce>[0]['outbound'][number]>) => ({
    personId: 'person-aditi',
    direction: 'OUTBOUND' as const,
    occurredOn: '2026-10-15',
    messageId: 'message-1',
    handle: 'aditi@example.com',
    receivedAt: '2026-10-15T09:00:00Z',
    ...overrides,
  });

  it('marks the latest email sent to the failed address before the notice', () => {
    expect(
      matchBounce({
        bounceReceivedAt: '2026-10-15T09:01:00Z',
        bounceText: "Your message wasn't delivered to aditi@example.com.",
        outbound: [
          sent({ messageId: 'message-0', receivedAt: '2026-10-10T09:00:00Z', occurredOn: '2026-10-10' }),
          sent({}),
          sent({ messageId: 'message-later', receivedAt: '2026-10-15T10:00:00Z' }),
          sent({ personId: 'person-ben', handle: 'ben@example.org', messageId: 'message-1' }),
        ],
      }),
    ).toEqual([
      { personId: 'person-aditi', messageId: 'message-1', occurredOn: '2026-10-15', address: 'aditi@example.com' },
    ]);
  });

  it('marks nothing when the address is only quoted in the original headers', () => {
    expect(
      matchBounce({
        bounceReceivedAt: '2026-10-15T09:01:00Z',
        bounceText: "Your message wasn't delivered to carla@example.net.\nTo: aditi@example.com",
        outbound: [sent({})],
      }),
    ).toEqual([]);
  });

  it('marks nothing without text', () => {
    expect(matchBounce({ bounceReceivedAt: '2026-10-15T09:01:00Z', bounceText: null, outbound: [sent({})] })).toEqual([]);
  });
});
