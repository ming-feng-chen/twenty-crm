import type { CadenceConfig } from './types';

const freezeDeep = <TValue>(value: TValue): TValue => {
  if (typeof value === 'object' && value !== null) {
    for (const nested of Object.values(value)) {
      freezeDeep(nested);
    }

    Object.freeze(value);
  }

  return value;
};

// Connection request, LinkedIn message x2 (gated on acceptance), Email x7,
// then a drip email every 30 calendar days for ever.
export const DEFAULT_CADENCE_CONFIG = freezeDeep<CadenceConfig>({
  id: 'default',
  name: 'Outreach cadence',
  timeZone: 'Europe/London',
  skipWeekends: true,
  steps: [
    {
      key: 'connectionRequest',
      label: 'Connection request',
      channel: 'linkedinConnection',
      repeat: 1,
      gapBefore: { amount: 3, unit: 'businessDays' },
      requiredData: 'linkedinUrl',
      whenDataMissing: 'skip',
    },
    {
      key: 'linkedinMessage',
      label: 'LinkedIn message',
      channel: 'linkedinMessage',
      repeat: 2,
      gapBefore: { amount: 3, unit: 'businessDays' },
      requiredData: 'linkedinUrl',
      whenDataMissing: 'skip',
      gate: 'linkedinAccepted',
    },
    {
      key: 'email',
      label: 'Email',
      channel: 'email',
      repeat: 7,
      gapBefore: { amount: 3, unit: 'businessDays' },
      requiredData: 'email',
      whenDataMissing: 'block',
    },
    {
      key: 'drip',
      label: 'Drip',
      channel: 'email',
      repeat: 'forever',
      gapBefore: { amount: 30, unit: 'calendarDays' },
      occurrenceNoun: 'email',
      requiredData: 'email',
      whenDataMissing: 'block',
    },
  ],
  connectionRequest: {
    channel: 'linkedinConnection',
    acceptedOutcome: 'accepted',
    acceptanceTimeout: { amount: 14, unit: 'calendarDays' },
    inMailChannel: 'inmail',
  },
  bounce: { channel: 'email', outcome: 'bounced' },
  strikeSilenceGap: { amount: 3, unit: 'businessDays' },
  strikeLimit: 3,
  nonAdvancingChannels: ['follow', 'comment', 'like', 'profileView'],
  conversationalChannels: ['call', 'meeting'],
});
