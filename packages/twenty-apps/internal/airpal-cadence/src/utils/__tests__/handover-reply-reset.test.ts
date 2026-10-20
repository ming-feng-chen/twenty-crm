import { describe, expect, it } from 'vitest';

import { DEFAULT_CADENCE_CONFIG } from 'src/engine';
import { decidePersonEdit } from 'src/utils/edit-decisions';
import {
  applyInputPatch,
  computePersonCadence,
  type PersonRecord,
  type TouchRecord,
} from 'src/utils/person-cadence';

const TODAY = '2026-10-17';
const RESET_AT = '2026-10-17T12:00:00.000Z';
const person: PersonRecord = {
  id: 'person-1',
  cadenceOwnerId: 'owner-a',
  cadenceStage: 'CONTACTED_NO_REPLY',
  cadenceHealth: 'ACTIVE',
  emails: { primaryEmail: 'contact@example.com' },
  linkedinLink: { primaryLinkUrl: 'https://linkedin.com/in/contact' },
};
const reply = (occurredAt: string): TouchRecord => ({
  id: 'reply-1',
  channel: 'EMAIL',
  direction: 'INBOUND',
  source: 'GMAIL',
  occurredOn: TODAY,
  occurredAt,
});
const compute = (subject: PersonRecord, touches: TouchRecord[]) =>
  computePersonCadence({
    person: subject,
    touches,
    config: DEFAULT_CADENCE_CONFIG,
    today: TODAY,
    suppressed: false,
  }).fields.cadenceActions;
const nativeHandover = (after: Partial<PersonRecord> = {}) =>
  decidePersonEdit({
    edit: {
      before: person,
      after: { ...person, cadenceOwnerId: 'owner-b', updatedAt: RESET_AT, ...after },
      updatedFields: ['cadenceOwnerId'],
    },
    touches: [],
    config: DEFAULT_CADENCE_CONFIG,
    today: TODAY,
    suppressed: false,
    now: new Date('2026-10-18T09:00:00.000Z'),
  }).patch;

describe('start-fresh reply reset', () => {
  it('uses the original native edit time even when the worker runs the next day', () => {
    expect(nativeHandover()).toEqual({
      cadenceOwnerSince: TODAY,
      cadenceReplyResetAt: RESET_AT,
    });
  });

  it('clears an earlier same-day reply and allows a later reply', () => {
    const updated = applyInputPatch(person, nativeHandover());

    expect(compute(person, [reply('2026-10-17T09:00:00Z')]).state).toBe('REPLY_OWED');
    expect(compute(updated, [reply('2026-10-17T09:00:00Z')]).replyOwedSince).toBeNull();
    expect(compute(updated, [reply('2026-10-17T14:00:00Z')]).state).toBe('REPLY_OWED');
  });

  it('uses logging time for a new same-day manual reply, but excludes backdated replies', () => {
    const updated = applyInputPatch(person, nativeHandover());
    const manual = {
      ...reply('2026-10-17T09:00:00Z'),
      occurredAt: null,
      source: 'MANUAL',
      createdAt: '2026-10-17T14:00:00Z',
    };

    expect(compute(updated, [manual]).state).toBe('REPLY_OWED');
    expect(compute(updated, [{ ...manual, createdAt: '2026-10-17T09:00:00Z' }]).replyOwedSince).toBeNull();
    expect(compute(updated, [{ ...manual, occurredOn: '2026-10-16' }]).replyOwedSince).toBeNull();
  });

  it('preserves the reset and owed reply on an explicit keep-position handover', () => {
    const touches = [reply('2026-10-17T09:00:00Z')];
    const before = { ...person, cadenceReplyResetAt: '2026-10-16T12:00:00Z' };
    const after = {
      ...before,
      cadenceOwnerId: 'owner-b',
      cadenceOwnerChangeRequest: {
        toOwnerId: 'owner-b',
        mode: 'KEEP_POSITION',
        requestedAt: RESET_AT,
        requestedByWorkspaceMemberId: 'owner-a',
      },
    };
    const { patch } = decidePersonEdit({
      edit: { before, after, updatedFields: ['cadenceOwnerId', 'cadenceOwnerChangeRequest'] },
      touches,
      config: DEFAULT_CADENCE_CONFIG,
      today: TODAY,
      suppressed: false,
    });

    expect(patch).toEqual({});
    expect(compute(applyInputPatch(after, patch), touches).state).toBe('REPLY_OWED');
  });
});
