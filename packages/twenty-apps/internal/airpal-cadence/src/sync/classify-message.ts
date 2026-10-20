import { type TouchDirectionValue } from 'src/constants/cadence-values';
import {
  type AirPalIdentity,
  isAirPalParticipant,
  normalizeHandle,
} from 'src/sync/airpal-identity';
import {
  isAutomatedSender,
  isAutoReplySubject,
  isBounceSender,
  isBounceSubject,
  isRestrictedValue,
} from 'src/sync/automated-mail';
import { civilDateOf } from 'src/sync/sync-dates';

export type SyncMessageParticipant = {
  role?: string | null;
  handle?: string | null;
  personId?: string | null;
  workspaceMemberId?: string | null;
};

export type SyncMessage = {
  id: string;
  receivedAt?: string | null;
  subject?: string | null;
  isDraft?: boolean | null;
  deletedAt?: string | null;
  messageThreadId?: string | null;
  // A sync association says the connected account sent it (OUTGOING).
  sentByConnectedAccount: boolean;
  participants: readonly SyncMessageParticipant[];
};

export type EmailTouchCandidate = {
  personId: string;
  direction: TouchDirectionValue;
  occurredOn: string;
  occurredAt: string;
  messageId: string;
  // The address the person was reached at (outbound) or wrote from (inbound).
  handle: string | null;
};

export type MessageSkipReason =
  | 'deleted'
  | 'draft'
  | 'noDate'
  | 'future'
  | 'noSender'
  | 'severalSenders'
  | 'autoReply'
  | 'automatedSender'
  | 'internalOnly'
  | 'noCrmRecipient'
  | 'senderNotInCrm';

export type MessageClassification =
  | {
      kind: 'touches';
      direction: TouchDirectionValue;
      occurredOn: string;
      touches: EmailTouchCandidate[];
      subjectRestricted: boolean;
    }
  | { kind: 'bounce'; occurredOn: string }
  | { kind: 'skip'; reason: MessageSkipReason };

const RECIPIENT_ROLES = new Set(['TO', 'CC', 'BCC']);

const hasPerson = (
  participant: SyncMessageParticipant,
): participant is SyncMessageParticipant & { personId: string } =>
  typeof participant.personId === 'string' && participant.personId.length > 0;

// SPEC §5 for one message. INBOUND for the CRM person who sent it; OUTBOUND,
// one each, for the CRM people it was sent to (To, Cc or Bcc) when AirPal
// sent it. Drafts, undated or future messages, automatic and out-of-office
// replies (either way), automated senders and AirPal-only mail create
// nothing; a delivery failure is handed back as a bounce.
export const classifyMessage = (
  message: SyncMessage,
  {
    identity,
    timeZone,
    today,
  }: { identity: AirPalIdentity; timeZone: string; today: string },
): MessageClassification => {
  if (typeof message.deletedAt === 'string' && message.deletedAt.length > 0) {
    return { kind: 'skip', reason: 'deleted' };
  }

  if (message.isDraft === true) {
    return { kind: 'skip', reason: 'draft' };
  }

  const occurredOn = civilDateOf(message.receivedAt, timeZone);

  if (occurredOn === null) {
    return { kind: 'skip', reason: 'noDate' };
  }

  if (occurredOn > today) {
    return { kind: 'skip', reason: 'future' };
  }

  const senders = message.participants.filter(
    (participant) => participant.role === 'FROM',
  );
  const senderHandles = new Set(
    senders.map((sender) => normalizeHandle(sender.handle) ?? ''),
  );

  if (senders.length === 0) {
    return { kind: 'skip', reason: 'noSender' };
  }

  if (senderHandles.size > 1) {
    return { kind: 'skip', reason: 'severalSenders' };
  }

  const sender = senders[0];

  if (isBounceSender(sender.handle)) {
    return isBounceSubject(message.subject)
      ? { kind: 'bounce', occurredOn }
      : { kind: 'skip', reason: 'automatedSender' };
  }

  const isAutoReply = isAutoReplySubject(message.subject);
  const subjectRestricted = isRestrictedValue(message.subject);
  const sentByAirPal =
    message.sentByConnectedAccount || isAirPalParticipant(sender, identity);

  if (sentByAirPal) {
    const recipients = message.participants.filter(
      (participant) =>
        RECIPIENT_ROLES.has(participant.role ?? '') &&
        hasPerson(participant) &&
        !isAirPalParticipant(participant, identity),
    ) as (SyncMessageParticipant & { personId: string })[];

    if (recipients.length === 0) {
      const everyoneIsAirPal = message.participants.every(
        (participant) =>
          participant.role === 'FROM' ||
          isAirPalParticipant(participant, identity),
      );

      return {
        kind: 'skip',
        reason: everyoneIsAirPal ? 'internalOnly' : 'noCrmRecipient',
      };
    }

    // A member's own out-of-office reply to a contact is not outreach.
    if (isAutoReply) {
      return { kind: 'skip', reason: 'autoReply' };
    }

    const byPerson = new Map<string, EmailTouchCandidate>();

    for (const recipient of recipients) {
      if (!byPerson.has(recipient.personId)) {
        byPerson.set(recipient.personId, {
          personId: recipient.personId,
          direction: 'OUTBOUND',
          occurredOn,
          occurredAt: new Date(message.receivedAt as string).toISOString(),
          messageId: message.id,
          handle: normalizeHandle(recipient.handle),
        });
      }
    }

    return {
      kind: 'touches',
      direction: 'OUTBOUND',
      occurredOn,
      touches: [...byPerson.values()],
      subjectRestricted,
    };
  }

  if (!hasPerson(sender)) {
    return { kind: 'skip', reason: 'senderNotInCrm' };
  }

  if (isAutomatedSender(sender.handle)) {
    return { kind: 'skip', reason: 'automatedSender' };
  }

  if (isAutoReply) {
    return { kind: 'skip', reason: 'autoReply' };
  }

  return {
    kind: 'touches',
    direction: 'INBOUND',
    occurredOn,
    touches: [
      {
        personId: sender.personId,
        direction: 'INBOUND',
        occurredOn,
        occurredAt: new Date(message.receivedAt as string).toISOString(),
        messageId: message.id,
        handle: normalizeHandle(sender.handle),
      },
    ],
    subjectRestricted,
  };
};
