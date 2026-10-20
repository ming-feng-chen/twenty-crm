import { describe, expect, it, vi } from 'vitest';
import { loadTouchChannelOptions } from 'src/data/touch-channels';
import { buildRulesSnapshot, DEFAULT_CADENCE_RULES } from 'src/utils/cadence-rules';

const options = [...DEFAULT_CADENCE_RULES.touchChannels, { value: 'WHATSAPP_GROUP', label: 'WhatsApp group' }];
const answer = (touchChannels = options) => ({ cadences: { edges: [{ node: { id: 'cadence', isDefault: true, touchChannels } }] } });

describe('managed outreach channels', () => {
  it('reads saved channels without deploy-managed dropdown metadata', async () => {
    const client = { query: vi.fn().mockResolvedValue(answer()) };
    expect(await loadTouchChannelOptions({ client })).toEqual(options);
    expect(client.query.mock.calls[0][0]).toHaveProperty('cadences');
  });

  it('reads new saves immediately instead of caching an old channel list', async () => {
    const client = { query: vi.fn().mockResolvedValueOnce(answer()).mockResolvedValueOnce(answer(DEFAULT_CADENCE_RULES.touchChannels)) };
    expect(await loadTouchChannelOptions({ client })).toEqual(options);
    expect(await loadTouchChannelOptions({ client })).toEqual(DEFAULT_CADENCE_RULES.touchChannels);
  });

  it('uses the last applied list while a multi-record rules save is incomplete', async () => {
    const client = { query: vi.fn().mockResolvedValue({ cadences: { edges: [{ node: {
      id: 'cadence', isDefault: true, touchChannels: [],
      lastValidRules: buildRulesSnapshot('cadence', { ...DEFAULT_CADENCE_RULES, touchChannels: options }),
    } }] } }) };
    expect(await loadTouchChannelOptions({ client })).toEqual(options);
  });

  it('surfaces read failures and malformed stored lists', async () => {
    await expect(loadTouchChannelOptions({ client: { query: vi.fn().mockRejectedValue(new Error('read failed')) } })).rejects.toThrow('read failed');
    await expect(loadTouchChannelOptions({ client: { query: vi.fn().mockResolvedValue(answer([])) } })).rejects.toThrow('must be kept');
  });
});
