import { describe, expect, it } from 'vitest';

import { DEFAULT_CADENCE_CONFIG } from '../default-cadence-config';
import { computePosition } from '../position';
import { prescribedTouch as prescribedForConfig } from '../prescribed';
import type { CadenceContact, CadenceTouch } from '../types';
import { contact, touch } from './fixtures';
import {
  fromLegacyResult,
  LEGACY_CHANNELS,
  toLegacyResult,
  type LegacyPosition,
  type LegacyPositionResult,
} from './legacy-view';

// Ported from the predecessor's prescribed.test.ts with identical expectations,
// written in its channel names through the legacy view.

const CONFIG = DEFAULT_CADENCE_CONFIG;

const prescribedTouch = (result: LegacyPositionResult): string | null => {
  const channel = prescribedForConfig(fromLegacyResult(result), CONFIG);

  return channel === null ? null : LEGACY_CHANNELS[channel];
};

// E1: no InMail position, so 'linkedin_inmail' (which prescribed a second
// InMail) is no longer a kind the engine can be in.
type EngineKind = Exclude<LegacyPosition['kind'], 'linkedin_inmail'>;

const EVERY_POSITION: Record<EngineKind, LegacyPosition> = {
  not_started: { kind: 'not_started' },
  warmed_up: { kind: 'warmed_up' },
  connection_sent: { kind: 'connection_sent' },
  linkedin_message: { kind: 'linkedin_message', n: 1 },
  email: { kind: 'email', n: 3 },
  drip_month: { kind: 'drip_month', month: 4 },
};

const EXPECTED: Record<EngineKind, string | null> = {
  not_started: 'linkedin_connection',
  warmed_up: 'linkedin_connection',
  connection_sent: null,
  linkedin_message: 'linkedin_message',
  email: 'email',
  drip_month: 'email',
};

describe('§1 — the Did it button derives what to log from the position', () => {
  it.each(Object.keys(EVERY_POSITION) as EngineKind[])(
    'maps %s',
    (kind) => {
      expect(prescribedTouch({ position: EVERY_POSITION[kind] })).toBe(
        EXPECTED[kind],
      );
    },
  );

  it('covers every kind in the union — exhaustiveness holds', () => {
    const kinds = Object.keys(EVERY_POSITION).sort();

    expect(Object.keys(EXPECTED).sort()).toEqual(kinds);

    for (const kind of kinds as EngineKind[]) {
      expect(() =>
        prescribedTouch({ position: EVERY_POSITION[kind] }),
      ).not.toThrow();
    }
  });

  it('logs both LinkedIn rungs as a message', () => {
    expect(
      prescribedTouch({ position: { kind: 'linkedin_message', n: 1 } }),
    ).toBe('linkedin_message');
    expect(
      prescribedTouch({ position: { kind: 'linkedin_message', n: 2 } }),
    ).toBe('linkedin_message');
  });

  it('logs every email rung and every drip month as an email', () => {
    for (let n = 1; n <= 7; n += 1) {
      expect(prescribedTouch({ position: { kind: 'email', n } })).toBe('email');
    }

    expect(prescribedTouch({ position: { kind: 'drip_month', month: 1 } })).toBe(
      'email',
    );
    expect(
      prescribedTouch({ position: { kind: 'drip_month', month: 12 } }),
    ).toBe('email');
  });

  it('prescribes nothing at connection_sent, whether pending or InMail-offered', () => {
    expect(
      prescribedTouch({
        position: { kind: 'connection_sent' },
        blockedReason: 'connection_pending',
      }),
    ).toBeNull();
    expect(
      prescribedTouch({
        position: { kind: 'connection_sent' },
        inMailAvailable: true,
      }),
    ).toBeNull();
  });

  it('starts at email 1 when there is no LinkedIn URL', () => {
    expect(
      prescribedTouch({
        position: { kind: 'not_started' },
        blockedReason: 'no_linkedin_url',
      }),
    ).toBe('email');
  });

  it('still prescribes a connection request when the block is about the email address', () => {
    expect(
      prescribedTouch({
        position: { kind: 'not_started' },
        blockedReason: 'no_email_address',
      }),
    ).toBe('linkedin_connection');
  });
});

describe('it agrees with the engine on real ladders', () => {
  const TODAY = '2026-08-17';
  const CONNECTION = touch('2026-07-01', 'linkedinConnection');
  const ACCEPTED = touch(
    '2026-07-03',
    'linkedinConnection',
    'inbound',
    'accepted',
  );

  const prescribedAt = (subject: CadenceContact, history: CadenceTouch[]) => {
    const channel = prescribedForConfig(
      computePosition(subject, history, TODAY, CONFIG),
      CONFIG,
    );

    return channel === null ? null : LEGACY_CHANNELS[channel];
  };

  it('walks the LinkedIn ladder', () => {
    const at = (history: CadenceTouch[]) => prescribedAt(contact(), history);

    expect(at([])).toBe('linkedin_connection');
    expect(at([touch('2026-06-28', 'follow')])).toBe('linkedin_connection');
    expect(at([CONNECTION])).toBeNull();
    expect(at([CONNECTION, ACCEPTED])).toBe('linkedin_message');
    expect(
      at([CONNECTION, ACCEPTED, touch('2026-07-06', 'linkedinMessage')]),
    ).toBe('linkedin_message');
    expect(
      at([
        CONNECTION,
        ACCEPTED,
        touch('2026-07-06', 'linkedinMessage'),
        touch('2026-07-09', 'linkedinMessage'),
      ]),
    ).toBe('email');
  });

  it('prescribes an email for a contact with no LinkedIn URL and nothing on file', () => {
    expect(prescribedAt(contact({ hasLinkedinUrl: false }), [])).toBe('email');
  });

  it('does not let a logged call turn the next email into the one after it', () => {
    const emails = [
      touch('2026-07-13', 'email'),
      touch('2026-07-16', 'email'),
      touch('2026-07-21', 'email'),
    ];
    const withCall = [...emails, touch('2026-07-22', 'call')];

    expect(
      toLegacyResult(computePosition(contact(), withCall, TODAY, CONFIG))
        .position,
    ).toEqual({ kind: 'email', n: 4 });
    expect(prescribedAt(contact(), withCall)).toBe('email');
  });
});
