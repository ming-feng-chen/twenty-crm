import { describe, expect, it, vi } from 'vitest';

import { writeSyncTouches } from 'src/sync/data/touch-writer';
import { type ExistingTouch, type SyncTouchCandidate } from 'src/sync/touch-plan';

const candidate = (hour: number, externalId = `email-${hour}`): SyncTouchCandidate => ({
  source: 'GMAIL', personId: 'person-1', channel: 'EMAIL', direction: 'OUTBOUND',
  occurredOn: '2026-10-15', occurredAt: `2026-10-15T${hour}:00:00.000Z`, externalId,
});

const connection = (rows: readonly unknown[]) => ({
  edges: rows.map((node) => ({ node })), pageInfo: { hasNextPage: false },
});

const stored = (overrides: Partial<ExistingTouch> = {}): ExistingTouch => ({
  id: 'existing', personId: 'person-1', channel: 'EMAIL', direction: 'OUTBOUND',
  occurredOn: '2026-10-15', occurredAt: '2026-10-15T09:00:00.000Z',
  externalId: 'morning-email', source: 'GMAIL', createdAt: '2026-10-15T10:00:00.000Z',
  ...overrides,
});

describe('writeSyncTouches exact email timing', () => {
  it('carries the candidate time onto the survivor if its original row was merged concurrently', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ touches: connection([stored()]) })
      .mockResolvedValueOnce({ touches: connection([stored({ id: 'manual-survivor', source: 'MANUAL' })]) });
    const mutation = vi.fn().mockResolvedValue({});
    const result = await writeSyncTouches({ query, mutation } as never, [candidate(16)]);

    expect(result.converged).toEqual([{
      survivorId: 'manual-survivor', deleted: [], update: { occurredAt: '2026-10-15T16:00:00.000Z' },
    }]);
    expect(mutation).toHaveBeenCalledWith(expect.objectContaining({
      updateTouches: expect.objectContaining({
        __args: expect.objectContaining({
          filter: expect.objectContaining({ and: expect.arrayContaining([{ id: { eq: 'manual-survivor' } }]) }),
          data: { occurredAt: '2026-10-15T16:00:00.000Z' },
        }),
      }),
    }));
  });

  it('updates the existing daily touch instead of losing a later same-day email', async () => {
    const query = vi.fn().mockResolvedValue({ touches: connection([stored()]) });
    const mutation = vi.fn().mockResolvedValue({ updateTouches: [{ id: 'existing' }] });
    const result = await writeSyncTouches({ query, mutation } as never, [candidate(16)]);

    expect(result.created).toEqual([]);
    expect(result.timingUpdated).toEqual(['existing']);
    expect(mutation).toHaveBeenCalledWith({
      updateTouches: {
        __args: {
          filter: {
            and: [
              { id: { eq: 'existing' } },
              { or: [{ occurredAt: { is: 'NULL' } }, { occurredAt: { lt: '2026-10-15T16:00:00.000Z' } }] },
            ],
          },
          data: { occurredAt: '2026-10-15T16:00:00.000Z' },
        },
        id: true,
      },
    });
  });

  it('does not let older messages in the same batch overwrite the latest time', async () => {
    const query = vi.fn().mockResolvedValue({ touches: connection([stored()]) });
    const mutation = vi.fn().mockResolvedValue({});
    const result = await writeSyncTouches({ query, mutation } as never, [candidate(16), candidate(14)]);

    expect(result.timingUpdated).toEqual(['existing']);
    expect(result.skipped).toHaveLength(1);
    expect(mutation).toHaveBeenCalledTimes(1);
  });

  it('enriches a manual touch with precise time while preserving its identity', async () => {
    const query = vi.fn().mockResolvedValue({ touches: connection([stored({ source: 'MANUAL', externalId: null, occurredAt: null })]) });
    const mutation = vi.fn().mockResolvedValue({});
    const result = await writeSyncTouches({ query, mutation } as never, [candidate(14)]);

    expect(result.enriched).toEqual(['existing']);
    expect(result.created).toEqual([]);
    expect(mutation).toHaveBeenCalledWith(expect.objectContaining({
      updateTouch: expect.objectContaining({ __args: { id: 'existing', data: { externalId: 'email-14' } } }),
    }));
    expect(mutation).toHaveBeenCalledWith(expect.objectContaining({
      updateTouches: expect.objectContaining({
        __args: expect.objectContaining({ data: { occurredAt: '2026-10-15T14:00:00.000Z' } }),
      }),
    }));
  });

  it('persists the timestamp on a new daily touch', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ touches: connection([]) })
      .mockResolvedValueOnce({ people: connection([{ id: 'person-1', name: { firstName: 'Aditi' } }]) })
      .mockResolvedValueOnce({ touches: connection([stored()]) });
    const mutation = vi.fn().mockResolvedValue({});
    const result = await writeSyncTouches({ query, mutation } as never, [candidate(14)]);

    expect(result.created).toHaveLength(1);
    expect(mutation).toHaveBeenCalledWith(expect.objectContaining({
      createTouches: expect.objectContaining({
        __args: { data: [expect.objectContaining({ occurredAt: '2026-10-15T14:00:00.000Z', occurredOn: '2026-10-15' })] },
      }),
    }));
  });
});
