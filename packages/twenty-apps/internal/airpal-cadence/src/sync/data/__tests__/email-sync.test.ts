import { describe, expect, it, vi } from 'vitest';

import { buildAirPalIdentity } from 'src/sync/airpal-identity';
import { syncMessages } from 'src/sync/data/email-sync';

const { writeSyncTouches } = vi.hoisted(() => ({ writeSyncTouches: vi.fn().mockResolvedValue({ created: [] }) }));

vi.mock('src/sync/data/touch-writer', () => ({
  BOUNCED: 'BOUNCED', findEmailTouch: vi.fn(), markBounced: vi.fn(), writeSyncTouches,
}));

describe('syncMessages exact times', () => {
  it('passes each synced message instant through to the daily touch writer', async () => {
    const message = {
      id: 'message-1', receivedAt: '2026-10-15T14:00:00+01:00',
      subject: 'Interested in a call',
    };
    const query = vi.fn()
      .mockResolvedValueOnce({
        messageParticipants: {
          edges: [
            { node: { id: 'from', role: 'FROM', handle: 'aditi@example.com', personId: 'person-1', message } },
            { node: { id: 'to', role: 'TO', handle: 'rep@airpal.co.uk', workspaceMemberId: 'member-1', message } },
          ],
          pageInfo: { hasNextPage: false },
        },
      })
      .mockResolvedValueOnce({ messageChannelMessageAssociations: { edges: [], pageInfo: { hasNextPage: false } } });
    const client = { query } as never;
    const context = {
      identity: buildAirPalIdentity([{ id: 'member-1', userEmail: 'rep@airpal.co.uk' }]),
      timeZone: 'Europe/London', today: '2026-10-15', now: new Date('2026-10-15T16:00:00Z'),
    };

    await syncMessages(client, ['message-1'], context);

    expect(writeSyncTouches).toHaveBeenCalledWith(client, [{
      source: 'GMAIL', personId: 'person-1', channel: 'EMAIL', direction: 'INBOUND',
      occurredOn: '2026-10-15', occurredAt: '2026-10-15T13:00:00.000Z', externalId: 'message-1',
    }], context.now);
  });
});
