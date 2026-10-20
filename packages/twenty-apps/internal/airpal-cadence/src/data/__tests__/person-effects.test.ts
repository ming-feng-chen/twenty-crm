import { type CoreApiClient } from 'twenty-client-sdk/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { applyPersonEdit } from 'src/data/person-effects';
import { type SharedContext } from 'src/data/store';
import { DEFAULT_CADENCE_CONFIG } from 'src/engine';
import { type EditDecision } from 'src/utils/edit-decisions';
import { applyInputPatch, computePersonCadence, type PersonRecord } from 'src/utils/person-cadence';

const mocks = vi.hoisted(() => ({ recomputePerson: vi.fn() }));
vi.mock('src/data/recompute', () => ({ recomputePerson: mocks.recomputePerson }));

const person: PersonRecord = {
  id: 'person-1',
  cadenceOwnerId: 'owner-a',
  cadenceStage: 'CONTACTED_NO_REPLY',
  cadenceHealth: 'ACTIVE',
};
const shared = {
  active: { config: DEFAULT_CADENCE_CONFIG },
  today: '2026-10-17',
} as SharedContext;

describe('queued native owner edits', () => {
  beforeEach(() => vi.clearAllMocks());

  const processOlderHandover = async (currentPerson: PersonRecord) => {
    const captured = vi.fn<(decision: EditDecision) => void>();
    mocks.recomputePerson.mockImplementation(async (_client, _personId, _shared, decide) => {
      captured(decide({ person: currentPerson, touches: [], suppressed: false }));
      return { personId: 'person-1', status: 'unchanged' };
    });

    await applyPersonEdit({
      client: {} as CoreApiClient,
      shared,
      personId: 'person-1',
      edit: {
        before: person,
        after: { ...person, cadenceOwnerId: 'owner-b', updatedAt: '2026-10-17T10:00:00Z' },
        updatedFields: ['cadenceOwnerId'],
      },
      actorWorkspaceMemberId: 'owner-a',
    });

    return captured.mock.calls[0][0].patch;
  };

  it('does not rewind a later owner change or revive a reply from before that change', async () => {
    const current = {
      ...person,
      cadenceOwnerId: 'owner-c',
      cadenceOwnerSince: '2026-10-17',
      cadenceReplyResetAt: '2026-10-17T12:00:00Z',
    };
    const patch = await processOlderHandover(current);

    expect(patch).toEqual({});
    const result = computePersonCadence({
      person: applyInputPatch(current, patch),
      touches: [{
        id: 'reply-1', channel: 'EMAIL', direction: 'INBOUND', source: 'GMAIL',
        occurredOn: '2026-10-17', occurredAt: '2026-10-17T11:00:00Z',
      }],
      config: DEFAULT_CADENCE_CONFIG,
      today: '2026-10-17',
      suppressed: false,
    });

    expect(result.fields.cadenceActions.replyOwedSince).toBeNull();
  });

  it.each(['2026-10-17T10:00:00Z', '2026-10-17T12:00:00Z'])(
    'keeps reset %s on replay or after an owner cycle returns to the same owner',
    async (cadenceReplyResetAt) => {
      expect(await processOlderHandover({
        ...person, cadenceOwnerId: 'owner-b', cadenceReplyResetAt,
      })).toEqual({});
    },
  );

  it('does not overwrite a newer keep-position request when the owner matches again', async () => {
    expect(await processOlderHandover({
      ...person,
      cadenceOwnerId: 'owner-b',
      cadenceReplyResetAt: '2026-10-16T12:00:00Z',
      cadenceOwnerChangeRequest: {
        toOwnerId: 'owner-b', mode: 'KEEP_POSITION', requestedAt: '2026-10-17T12:00:00Z',
        requestedByWorkspaceMemberId: 'owner-a',
      },
    })).toEqual({});
  });

  it('applies a current native handover once', async () => {
    expect(await processOlderHandover({ ...person, cadenceOwnerId: 'owner-b' })).toEqual({
      cadenceOwnerSince: '2026-10-17',
      cadenceReplyResetAt: '2026-10-17T10:00:00.000Z',
    });
  });
});
