import type {
  CadenceContact,
  CadenceTouch,
  CadenceTouchDirection,
} from '../types';

// The predecessor's "social" channel is 'follow' here, and its "other" is 'call'.

export const contact = (
  overrides: Partial<CadenceContact> = {},
): CadenceContact => ({
  stage: 'contactedNoReply',
  health: 'active',
  hasOwner: true,
  ownerSince: null,
  hasEmail: true,
  hasLinkedinUrl: true,
  optedOut: false,
  cadenceResumedAt: null,
  snoozeUntil: null,
  revisitDate: null,
  nextActionDateOverride: null,
  ...overrides,
});

export const touch = (
  day: string,
  channel: string,
  direction: CadenceTouchDirection = 'outbound',
  outcome: string | null = null,
): CadenceTouch => ({
  channel,
  direction,
  outcome,
  occurredAt: new Date(`${day}T00:00:00Z`),
});
