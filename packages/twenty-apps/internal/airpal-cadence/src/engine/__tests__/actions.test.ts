import { describe, expect, it } from 'vitest';

import { CADENCE_OVERFLOW_ACTIONS, cadenceActions } from '../actions';
import { DEFAULT_CADENCE_CONFIG } from '../default-cadence-config';
import { contact } from './fixtures';
import {
  ACTION_FROM_LEGACY,
  fromLegacyStatus,
  type LegacyPositionResult,
  type LegacyStatus,
} from './legacy-view';

// Ported from the predecessor's apps/web my-day-actions.test.ts with identical
// expectations. Its label, description and "unavailable" checks are UI copy and
// stay with the UI.

const LEGACY_ACTIONS = Object.fromEntries(
  Object.entries(ACTION_FROM_LEGACY).map(([legacy, action]) => [action, legacy]),
);

// By default a contact with both an address and a LinkedIn URL; stopped
// states are given Email 3 as the step in play.
const kinds = (status: LegacyStatus, subject = contact()): string[] => {
  const engineStatus = fromLegacyStatus(status);

  return cadenceActions({
    status: engineStatus,
    result:
      engineStatus.state === 'running'
        ? engineStatus.result
        : { position: { kind: 'step', stepKey: 'email', occurrence: 3 } },
    contact: subject,
    config: DEFAULT_CADENCE_CONFIG,
  }).map((action) => LEGACY_ACTIONS[action]);
};

const running = (result: LegacyPositionResult): LegacyStatus => ({
  state: 'running',
  result,
});

describe('ADR-0032 §1 — the action set is a function of the state', () => {
  it('a running LinkedIn step offers Did it, They accepted, They replied and Something else', () => {
    expect(
      kinds(
        running({
          position: { kind: 'connection_sent' },
          blockedReason: 'connection_pending',
        }),
      ),
    ).toEqual(['they_accepted', 'they_replied', 'something_else']);
  });

  it('offers Did it wherever a touch is prescribed', () => {
    expect(kinds(running({ position: { kind: 'email', n: 3 } }))).toEqual([
      'did_it',
      'they_replied',
      'something_else',
    ]);
    expect(
      kinds(running({ position: { kind: 'linkedin_message', n: 1 } })),
    ).toEqual(['did_it', 'they_replied', 'something_else']);
  });

  it('never offers Did it where the step in play cannot have been sent', () => {
    const actions = kinds(
      running({
        position: { kind: 'connection_sent' },
        blockedReason: 'connection_pending',
      }),
    );

    expect(actions).not.toContain('did_it');
  });

  // E1: there is one such rung now. The InMail rung, which also offered it, is
  // gone: a sent InMail moves the row on to Email 1.
  it('offers They accepted only on the rung where the connection is pending', () => {
    expect(
      kinds(
        running({
          position: { kind: 'connection_sent' },
          blockedReason: 'connection_pending',
        }),
      ),
    ).toContain('they_accepted');

    const elsewhere: LegacyPositionResult[] = [
      { position: { kind: 'email', n: 1 } },
      { position: { kind: 'linkedin_message', n: 2 } },
      { position: { kind: 'not_started' } },
      { position: { kind: 'drip_month', month: 2 } },
    ];

    for (const result of elsewhere) {
      expect(
        kinds(running(result)),
        `they_accepted must not be offered at ${result.position.kind}`,
      ).not.toContain('they_accepted');
    }
  });

  it('swaps the whole set for the InMail choice after fourteen days', () => {
    expect(
      kinds(
        running({ position: { kind: 'connection_sent' }, inMailAvailable: true }),
      ),
    ).toEqual(['sent_inmail', 'skip_to_email', 'they_replied']);
  });

  it('offers Add email address instead of Did it when there is no address', () => {
    expect(
      kinds(
        running({
          position: { kind: 'email', n: 1 },
          blockedReason: 'no_email_address',
        }),
        contact({ hasEmail: false }),
      ),
    ).toEqual(['add_email_address']);
  });

  it('gives reply owed the answer button, and in conversation the follow-up', () => {
    expect(kinds({ state: 'reply_owed', since: '2026-08-12' })).toEqual([
      'i_replied',
      'something_else',
    ]);
    expect(
      kinds({ state: 'in_conversation', strikes: 2, repliedOn: '2026-08-12' }),
    ).toEqual(['i_followed_up', 'they_replied', 'something_else']);
  });

  it('gives awaiting resume the resume prompt', () => {
    expect(kinds({ state: 'awaiting_resume', repliedOn: '2026-08-04' })).toEqual([
      'resume_cadence',
    ]);
  });

  it('offers nothing at all on an opt-out', () => {
    expect(kinds({ state: 'opted_out' })).toEqual([]);
  });

  it('falls back to Something else on the states ADR-0032 does not enumerate', () => {
    expect(kinds({ state: 'dead' })).toEqual(['something_else']);
    expect(kinds({ state: 'bounced' })).toEqual(['something_else']);
    expect(kinds({ state: 'hold', revisitOn: null })).toEqual(['something_else']);
    expect(kinds({ state: 'snoozed', until: '2026-09-01' })).toEqual([
      'something_else',
    ]);
  });
});

describe('the overflow is the same on every row', () => {
  it('carries snooze, hold and dead', () => {
    expect(CADENCE_OVERFLOW_ACTIONS).toEqual(['snooze', 'hold', 'markDead']);
  });
});

describe('pending acceptance after the cadence moves on', () => {
  it('keeps the inbound acceptance action available in stopped states except opt-out', () => {
    for (const state of ['dead', 'bounced', 'hold', 'snoozed', 'replyOwed', 'awaitingResume', 'inConversation', 'optedOut'] as const) {
      const status = {
        state, since: '2026-08-10', revisitOn: null, until: '2026-09-01',
        repliedOn: '2026-08-10', strikes: 1,
      };
      const actions = cadenceActions({
        status,
        result: { position: { kind: 'step', stepKey: 'email', occurrence: 2 } },
        contact: contact(), config: DEFAULT_CADENCE_CONFIG, connectionPending: true,
      });

      expect(actions.includes('theyAccepted')).toBe(state !== 'optedOut');
    }
  });
});
