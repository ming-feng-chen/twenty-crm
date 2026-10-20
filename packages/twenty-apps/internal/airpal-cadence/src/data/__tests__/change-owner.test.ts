import { type CoreApiClient } from 'twenty-client-sdk/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { changeOwner } from 'src/data/actions';
import { type OwnerChangeMode } from 'src/utils/edit-decisions';

const mocks = vi.hoisted(() => ({
  loadSharedContext: vi.fn(),
  loadPersonState: vi.fn(),
  computeForState: vi.fn(),
  recomputePerson: vi.fn(),
}));

vi.mock('src/data/store', () => ({
  loadSharedContext: mocks.loadSharedContext,
  loadPersonState: mocks.loadPersonState,
}));
vi.mock('src/data/recompute', () => ({
  computeForState: mocks.computeForState,
  recomputePerson: mocks.recomputePerson,
}));

const NOW = '2026-10-17T12:00:00.000Z';

describe('changeOwner reply reset', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.clearAllMocks();
    mocks.loadSharedContext.mockResolvedValue({ today: '2026-10-17', active: { config: { timeZone: 'Europe/London' } } });
    mocks.loadPersonState.mockResolvedValue({
      person: {
        id: 'person-1',
        cadenceOwnerId: 'owner-a',
        cadenceReplyResetAt: '2026-10-16T12:00:00.000Z',
      },
    });
    mocks.computeForState.mockReturnValue({
      fields: { cadenceActions: { replyOwedSince: '2026-10-17', isLinkedInPosition: false } },
    });
    mocks.recomputePerson.mockResolvedValue({ status: 'updated' });
  });

  afterEach(() => vi.useRealTimers());

  const execute = async (mode: OwnerChangeMode, ownerId: string | null = 'owner-b') => {
    const mutation = vi.fn().mockResolvedValue({ updatePerson: { id: 'person-1' } });
    const client = { mutation } as unknown as CoreApiClient;
    const result = await changeOwner({
      appClient: client,
      actorClient: client,
      personId: 'person-1',
      ownerId,
      mode,
      requestedByWorkspaceMemberId: 'owner-a',
    });

    return { result, mutation };
  };

  it('writes the exact reset alongside the owner and civil cadence date', async () => {
    const { result, mutation } = await execute('START_FRESH');

    expect(mutation).toHaveBeenCalledWith({
      updatePerson: {
        __args: {
          id: 'person-1',
          data: {
            cadenceOwnerId: 'owner-b',
            cadenceOwnerSince: '2026-10-17',
            cadenceReplyResetAt: NOW,
            cadenceOwnerChangeRequest: {
              toOwnerId: 'owner-b',
              mode: 'START_FRESH',
              requestedAt: NOW,
              requestedByWorkspaceMemberId: 'owner-a',
            },
          },
        },
        id: true,
      },
    });
    expect(result.warnings).toEqual(['Starting fresh clears the owed reply (since 2026-10-17).']);
    expect(mocks.recomputePerson).toHaveBeenCalledTimes(1);
  });

  it.each(['KEEP_POSITION', 'START_FRESH'] as const)(
    'leaves the reset untouched for %s when this is not a handover',
    async (mode) => {
      const { mutation } = await execute(mode, null);
      const data = mutation.mock.calls[0][0].updatePerson.__args.data;

      expect(data).not.toHaveProperty('cadenceReplyResetAt');
      expect(data).not.toHaveProperty('cadenceOwnerSince');
    },
  );

  it('preserves both boundaries and the reply warning on keep position', async () => {
    const { result, mutation } = await execute('KEEP_POSITION');
    const data = mutation.mock.calls[0][0].updatePerson.__args.data;

    expect(data).not.toHaveProperty('cadenceReplyResetAt');
    expect(data).not.toHaveProperty('cadenceOwnerSince');
    expect(result.warnings).toEqual(['They are owed a reply (since 2026-10-17).']);
  });

  it('uses the request day when midnight passed after loading the context', async () => {
    vi.setSystemTime('2026-10-17T23:00:01.000Z');
    const { mutation } = await execute('START_FRESH');
    const data = mutation.mock.calls[0][0].updatePerson.__args.data;

    expect(data.cadenceOwnerSince).toBe('2026-10-18');
    expect(data.cadenceReplyResetAt).toBe('2026-10-17T23:00:01.000Z');
  });
});
