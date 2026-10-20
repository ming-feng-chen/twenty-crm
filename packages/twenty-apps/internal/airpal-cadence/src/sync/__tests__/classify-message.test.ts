import { describe, expect, it } from 'vitest';

import { buildAirPalIdentity } from 'src/sync/airpal-identity';
import {
  classifyMessage,
  type SyncMessage,
  type SyncMessageParticipant,
} from 'src/sync/classify-message';

const identity = buildAirPalIdentity([
  { id: 'member-rep', userEmail: 'Rep@AirPal.co.uk' },
  { id: 'member-boss', userEmail: 'boss@airpal.co.uk' },
]);
const context = { identity, timeZone: 'Europe/London', today: '2026-10-16' };

const rep: SyncMessageParticipant = {
  role: 'FROM',
  handle: 'rep@airpal.co.uk',
  workspaceMemberId: 'member-rep',
  personId: null,
};
const aditi = (role: string): SyncMessageParticipant => ({
  role,
  handle: 'aditi@example.com',
  personId: 'person-aditi',
  workspaceMemberId: null,
});
const ben = (role: string): SyncMessageParticipant => ({
  role,
  handle: 'ben@example.org',
  personId: 'person-ben',
  workspaceMemberId: null,
});
const repAs = (role: string): SyncMessageParticipant => ({ ...rep, role });

const message = (overrides: Partial<SyncMessage>): SyncMessage => ({
  id: 'message-1',
  receivedAt: '2026-10-15T09:30:00.000Z',
  subject: 'Intro from AirPal',
  isDraft: false,
  deletedAt: null,
  sentByConnectedAccount: false,
  participants: [],
  ...overrides,
});

describe('classifyMessage — direction', () => {
  it('is INBOUND for the CRM person who sent it', () => {
    const result = classifyMessage(
      message({ participants: [aditi('FROM'), repAs('TO')] }),
      context,
    );

    expect(result).toEqual({
      kind: 'touches',
      direction: 'INBOUND',
      occurredOn: '2026-10-15',
      subjectRestricted: false,
      touches: [
        {
          personId: 'person-aditi',
          direction: 'INBOUND',
          occurredOn: '2026-10-15',
          occurredAt: '2026-10-15T09:30:00.000Z',
          messageId: 'message-1',
          handle: 'aditi@example.com',
        },
      ],
    });
  });

  it('is OUTBOUND, one touch per CRM recipient, when a member sent it', () => {
    const result = classifyMessage(
      message({
        participants: [rep, aditi('TO'), ben('CC'), aditi('BCC'), repAs('CC')],
      }),
      context,
    );

    expect(result.kind).toBe('touches');
    expect(result.kind === 'touches' && result.direction).toBe('OUTBOUND');
    expect(
      result.kind === 'touches' && result.touches.map((touch) => touch.personId),
    ).toEqual(['person-aditi', 'person-ben']);
  });

  it('counts the sender as AirPal by login email even before Twenty links the member', () => {
    const result = classifyMessage(
      message({
        participants: [
          { role: 'FROM', handle: 'REP@airpal.co.uk', personId: 'person-rep-record', workspaceMemberId: null },
          aditi('TO'),
        ],
      }),
      context,
    );

    expect(result.kind === 'touches' && result.direction).toBe('OUTBOUND');
    expect(result.kind === 'touches' && result.touches.map((t) => t.personId)).toEqual([
      'person-aditi',
    ]);
  });

  it('counts the sender as AirPal when the connected account sent it (alias)', () => {
    const result = classifyMessage(
      message({
        sentByConnectedAccount: true,
        participants: [
          { role: 'FROM', handle: 'sales@airpal.co.uk', personId: null, workspaceMemberId: null },
          aditi('TO'),
        ],
      }),
      context,
    );

    expect(result.kind === 'touches' && result.direction).toBe('OUTBOUND');
  });

  it('never gives a member their own touch, even with a person record', () => {
    const result = classifyMessage(
      message({
        participants: [
          aditi('FROM'),
          { role: 'TO', handle: 'boss@airpal.co.uk', personId: 'person-boss', workspaceMemberId: 'member-boss' },
        ],
      }),
      context,
    );

    expect(result.kind === 'touches' && result.touches.map((t) => t.personId)).toEqual([
      'person-aditi',
    ]);
  });

  it('ignores Reply-To participants as recipients', () => {
    const result = classifyMessage(
      message({ participants: [rep, ben('REPLY_TO')] }),
      context,
    );

    expect(result).toEqual({ kind: 'skip', reason: 'noCrmRecipient' });
  });

  it('gives nothing to a CRM person who was only copied on someone else’s email', () => {
    const result = classifyMessage(
      message({
        participants: [
          { role: 'FROM', handle: 'assistant@example.com', personId: null, workspaceMemberId: null },
          aditi('CC'),
          repAs('TO'),
        ],
      }),
      context,
    );

    expect(result).toEqual({ kind: 'skip', reason: 'senderNotInCrm' });
  });

  it('is INBOUND only for the sender when other CRM people are copied', () => {
    const result = classifyMessage(
      message({ participants: [aditi('FROM'), ben('CC'), repAs('TO')] }),
      context,
    );

    expect(result.kind === 'touches' && result.touches.map((t) => t.personId)).toEqual([
      'person-aditi',
    ]);
  });
});

describe('classifyMessage — what creates nothing', () => {
  it('skips mail between AirPal members only', () => {
    expect(
      classifyMessage(
        message({ participants: [rep, { role: 'TO', handle: 'boss@airpal.co.uk', workspaceMemberId: 'member-boss' }] }),
        context,
      ),
    ).toEqual({ kind: 'skip', reason: 'internalOnly' });
  });

  it('skips mail with people not in the CRM', () => {
    expect(
      classifyMessage(
        message({ participants: [rep, { role: 'TO', handle: 'stranger@example.com', personId: null }] }),
        context,
      ),
    ).toEqual({ kind: 'skip', reason: 'noCrmRecipient' });
    expect(
      classifyMessage(
        message({ participants: [{ role: 'FROM', handle: 'stranger@example.com' }, repAs('TO')] }),
        context,
      ),
    ).toEqual({ kind: 'skip', reason: 'senderNotInCrm' });
  });

  it('skips automatic replies in both directions', () => {
    expect(
      classifyMessage(
        message({ subject: 'Automatic reply: Intro from AirPal', participants: [aditi('FROM'), repAs('TO')] }),
        context,
      ),
    ).toEqual({ kind: 'skip', reason: 'autoReply' });
    expect(
      classifyMessage(
        message({ subject: 'Out of office: Re: Pilot', participants: [rep, aditi('TO')] }),
        context,
      ),
    ).toEqual({ kind: 'skip', reason: 'autoReply' });
  });

  it('skips a CRM “person” who is a no-reply address', () => {
    expect(
      classifyMessage(
        message({
          participants: [
            { role: 'FROM', handle: 'no-reply@example.com', personId: 'person-robot' },
            repAs('TO'),
          ],
        }),
        context,
      ),
    ).toEqual({ kind: 'skip', reason: 'automatedSender' });
  });

  it('skips drafts, deleted, undated and future messages', () => {
    const participants = [aditi('FROM'), repAs('TO')];

    expect(classifyMessage(message({ participants, isDraft: true }), context)).toEqual({
      kind: 'skip',
      reason: 'draft',
    });
    expect(
      classifyMessage(message({ participants, deletedAt: '2026-10-15T10:00:00Z' }), context),
    ).toEqual({ kind: 'skip', reason: 'deleted' });
    expect(classifyMessage(message({ participants, receivedAt: null }), context)).toEqual({
      kind: 'skip',
      reason: 'noDate',
    });
    expect(classifyMessage(message({ participants, receivedAt: 'not a date' }), context)).toEqual({
      kind: 'skip',
      reason: 'noDate',
    });
    expect(
      classifyMessage(message({ participants, receivedAt: '2026-10-17T08:00:00Z' }), context),
    ).toEqual({ kind: 'skip', reason: 'future' });
  });

  it('skips a message without a single sender', () => {
    expect(classifyMessage(message({ participants: [aditi('TO')] }), context)).toEqual({
      kind: 'skip',
      reason: 'noSender',
    });
    expect(
      classifyMessage(message({ participants: [aditi('FROM'), ben('FROM'), repAs('TO')] }), context),
    ).toEqual({ kind: 'skip', reason: 'severalSenders' });
  });
});

describe('classifyMessage — bounces and dates', () => {
  it('hands a delivery failure back as a bounce', () => {
    expect(
      classifyMessage(
        message({
          subject: 'Delivery Status Notification (Failure)',
          participants: [{ role: 'FROM', handle: 'mailer-daemon@googlemail.com' }, repAs('TO')],
        }),
        context,
      ),
    ).toEqual({ kind: 'bounce', occurredOn: '2026-10-15' });
  });

  it('never treats a delay notice, or a daemon that is a CRM person, as a touch', () => {
    expect(
      classifyMessage(
        message({
          subject: 'Delivery Status Notification (Delay)',
          participants: [
            { role: 'FROM', handle: 'mailer-daemon@googlemail.com', personId: 'person-daemon' },
            repAs('TO'),
          ],
        }),
        context,
      ),
    ).toEqual({ kind: 'skip', reason: 'automatedSender' });
  });

  it('dates the touch on the London day, across midnight and BST', () => {
    const participants = [aditi('FROM'), repAs('TO')];
    const day = (receivedAt: string, today = '2026-10-16') => {
      const result = classifyMessage(message({ participants, receivedAt }), { ...context, today });

      return result.kind === 'touches' ? result.occurredOn : result;
    };

    // 23:30 UTC on 15 Oct is 00:30 on 16 Oct in London (BST).
    expect(day('2026-10-15T23:30:00Z')).toBe('2026-10-16');
    expect(day('2026-10-15T22:59:59Z')).toBe('2026-10-15');
    // In winter (GMT) London equals UTC.
    expect(day('2026-12-01T23:30:00Z', '2026-12-02')).toBe('2026-12-01');
    // 00:30 London on the 17th is still the future on the 16th.
    expect(day('2026-10-16T23:30:00Z')).toEqual({ kind: 'skip', reason: 'future' });
  });

  it('flags a subject Twenty redacted, which hides automatic replies', () => {
    const result = classifyMessage(
      message({
        subject: 'FIELD_RESTRICTED_ADDITIONAL_PERMISSIONS_REQUIRED',
        participants: [aditi('FROM'), repAs('TO')],
      }),
      context,
    );

    expect(result.kind === 'touches' && result.subjectRestricted).toBe(true);
  });
});
