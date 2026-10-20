import { type CoreApiClient, type CoreSchema } from 'twenty-client-sdk/core';

import { TOUCH_CHANNEL_VALUES } from 'src/constants/touch-options';
import { errorMessage } from 'src/data/api';
import { matchBounce, type OutboundInThread } from 'src/sync/bounce';
import {
  classifyMessage,
  type MessageClassification,
  type SyncMessage,
  type SyncMessageParticipant,
} from 'src/sync/classify-message';
import {
  chunk,
  IDS_PER_FILTER,
  isRateLimitError,
  pageArgs,
  readAllPages,
  type SyncContext,
} from 'src/sync/data/sync-api';
import {
  BOUNCED,
  findEmailTouch,
  markBounced,
  writeSyncTouches,
  type WriteOutcome,
} from 'src/sync/data/touch-writer';
import { SYNC_SOURCES, type SyncTouchCandidate } from 'src/sync/touch-plan';

type MessageNode = {
  id: string;
  receivedAt?: string | null;
  subject?: string | null;
  isDraft?: boolean | null;
  deletedAt?: string | null;
  messageThreadId?: string | null;
};

type ParticipantNode = SyncMessageParticipant & {
  id: string;
  messageId?: string | null;
  message?: MessageNode | null;
};

// The message is read through its participants, not with a root `messages`
// query: Twenty's message visibility hook (root queries only) drops a message
// that has no sync association and, on a channel shared as "metadata" (the
// default when an account connects), replaces the subject with a placeholder,
// which would hide automatic replies. The subject is used for that test only;
// it is never written anywhere.
const PARTICIPANT_SELECTION = {
  id: true,
  role: true,
  handle: true,
  personId: true,
  workspaceMemberId: true,
  messageId: true,
  message: {
    id: true,
    receivedAt: true,
    subject: true,
    isDraft: true,
    deletedAt: true,
    messageThreadId: true,
  },
} as const;

const loadParticipants = (
  client: CoreApiClient,
  filter: CoreSchema.MessageParticipantFilterInput,
): Promise<ParticipantNode[]> =>
  readAllPages<ParticipantNode>(async (after) =>
    (
      await client.query({
        messageParticipants: {
          __args: { filter, ...pageArgs(after) },
          pageInfo: { hasNextPage: true, endCursor: true },
          edges: { node: PARTICIPANT_SELECTION },
        },
      })
    ).messageParticipants as never,
  );

// Message ids whose sync association says the connected account sent them.
const loadSentByConnectedAccount = async (
  client: CoreApiClient,
  messageIds: readonly string[],
): Promise<Set<string>> => {
  const sent = new Set<string>();

  for (const ids of chunk(messageIds, IDS_PER_FILTER)) {
    const associations = await readAllPages<{ messageId?: string | null }>(
      async (after) =>
        (
          await client.query({
            messageChannelMessageAssociations: {
              __args: {
                filter: {
                  and: [{ messageId: { in: ids } }, { direction: { eq: 'OUTGOING' } }],
                },
                ...pageArgs(after),
              },
              pageInfo: { hasNextPage: true, endCursor: true },
              edges: { node: { id: true, messageId: true } },
            },
          })
        ).messageChannelMessageAssociations as never,
    );

    for (const association of associations) {
      if (typeof association.messageId === 'string') {
        sent.add(association.messageId);
      }
    }
  }

  return sent;
};

const toSyncMessages = (
  participants: readonly ParticipantNode[],
  sentByConnectedAccount: ReadonlySet<string>,
): SyncMessage[] => {
  const byMessage = new Map<string, { message: MessageNode; participants: ParticipantNode[] }>();

  for (const participant of participants) {
    const message = participant.message;

    if (message === null || message === undefined || typeof message.id !== 'string') {
      continue;
    }

    const entry = byMessage.get(message.id) ?? { message, participants: [] };

    entry.participants.push(participant);
    byMessage.set(message.id, entry);
  }

  return [...byMessage.values()].map(({ message, participants: rows }) => ({
    id: message.id,
    receivedAt: message.receivedAt ?? null,
    subject: message.subject ?? null,
    isDraft: message.isDraft ?? null,
    deletedAt: message.deletedAt ?? null,
    messageThreadId: message.messageThreadId ?? null,
    sentByConnectedAccount: sentByConnectedAccount.has(message.id),
    participants: rows.map(({ role, handle, personId, workspaceMemberId }) => ({
      role,
      handle,
      personId,
      workspaceMemberId,
    })),
  }));
};

export const loadSyncMessages = async (
  client: CoreApiClient,
  messageIds: readonly string[],
): Promise<SyncMessage[]> => {
  const ids = [...new Set(messageIds)];
  const participants: ParticipantNode[] = [];

  for (const part of chunk(ids, IDS_PER_FILTER)) {
    participants.push(...(await loadParticipants(client, { messageId: { in: part } })));
  }

  return toSyncMessages(participants, await loadSentByConnectedAccount(client, ids));
};

const toCandidates = (
  classification: MessageClassification,
): SyncTouchCandidate[] =>
  classification.kind === 'touches'
    ? classification.touches.map((touch) => ({
        source: SYNC_SOURCES.gmail,
        personId: touch.personId,
        channel: TOUCH_CHANNEL_VALUES.email,
        direction: touch.direction,
        occurredOn: touch.occurredOn,
        occurredAt: touch.occurredAt,
        externalId: touch.messageId,
      }))
    : [];

export type BounceOutcome = {
  messageId: string;
  status: 'marked' | 'noThread' | 'noMatch' | 'noTouch' | 'alreadyBounced' | 'failed';
  touchIds?: string[];
  detail?: string;
};

// A delivery failure found among the synced messages: the outbound emails in
// its thread whose address the notice names (matchBounce) get BOUNCED.
const applyBounce = async (
  client: CoreApiClient,
  bounce: SyncMessage,
  context: SyncContext,
): Promise<BounceOutcome> => {
  if (typeof bounce.messageThreadId !== 'string' || typeof bounce.receivedAt !== 'string') {
    return { messageId: bounce.id, status: 'noThread' };
  }

  // Through a participant, for the reason given at PARTICIPANT_SELECTION.
  const viaParticipant = await client.query({
    messageParticipants: {
      __args: { filter: { messageId: { eq: bounce.id } }, first: 1 },
      edges: { node: { id: true, message: { id: true, text: true } } },
    },
  });
  const text = viaParticipant.messageParticipants?.edges?.[0]?.node?.message?.text ?? null;

  const threadParticipants = await loadParticipants(client, {
    message: { messageThreadId: { eq: bounce.messageThreadId } },
  });
  const threadMessageIds = [
    ...new Set(
      threadParticipants
        .map((participant) => participant.message?.id)
        .filter((id): id is string => typeof id === 'string'),
    ),
  ];
  const threadMessages = toSyncMessages(
    threadParticipants,
    await loadSentByConnectedAccount(client, threadMessageIds),
  );
  const outbound: OutboundInThread[] = threadMessages.flatMap((message) => {
    const classification = classifyMessage(message, context);

    return classification.kind === 'touches' &&
      classification.direction === 'OUTBOUND' &&
      typeof message.receivedAt === 'string'
      ? classification.touches.map((touch) => ({
          ...touch,
          receivedAt: message.receivedAt as string,
        }))
      : [];
  });
  const targets = matchBounce({
    bounceReceivedAt: bounce.receivedAt,
    bounceText: text,
    outbound,
  });

  if (targets.length === 0) {
    return { messageId: bounce.id, status: 'noMatch' };
  }

  const touchIds: string[] = [];
  let alreadyBounced = 0;

  for (const target of targets) {
    const touch = await findEmailTouch(client, target);

    if (touch === null) {
      continue;
    }

    if (touch.outcome === BOUNCED) {
      alreadyBounced += 1;
      continue;
    }

    await markBounced(client, touch.id);
    touchIds.push(touch.id);
  }

  if (touchIds.length > 0) {
    return { messageId: bounce.id, status: 'marked', touchIds };
  }

  return {
    messageId: bounce.id,
    status: alreadyBounced > 0 ? 'alreadyBounced' : 'noTouch',
    detail:
      alreadyBounced > 0
        ? undefined
        : 'no email touch for the bounced message yet; not marked',
  };
};

export type EmailSyncReport = {
  messages: number;
  classified: Record<string, number>;
  subjectRestricted: number;
  writes: WriteOutcome;
  bounces: BounceOutcome[];
};

const countKind = (classification: MessageClassification) =>
  classification.kind === 'skip'
    ? `skip:${classification.reason}`
    : classification.kind === 'touches'
      ? `touches:${classification.direction}`
      : 'bounce';

// SPEC §5 Gmail sync for a set of messages. Idempotent: the same messages can
// be synced again (a retry, a second participant's event) and nothing changes.
export const syncMessages = async (
  client: CoreApiClient,
  messageIds: readonly string[],
  context: SyncContext,
): Promise<EmailSyncReport> => {
  const messages = await loadSyncMessages(client, messageIds);
  const classified: Record<string, number> = {};
  const candidates: SyncTouchCandidate[] = [];
  const bounces: SyncMessage[] = [];
  let subjectRestricted = 0;

  for (const message of messages) {
    const classification = classifyMessage(message, context);
    const kind = countKind(classification);

    classified[kind] = (classified[kind] ?? 0) + 1;

    if (classification.kind === 'touches' && classification.subjectRestricted) {
      subjectRestricted += 1;
    }

    if (classification.kind === 'bounce') {
      bounces.push(message);
    }

    candidates.push(...toCandidates(classification));
  }

  if (subjectRestricted > 0) {
    console.warn(
      JSON.stringify({
        sync: 'gmail',
        warning: `${subjectRestricted} message(s) had a restricted subject; automatic replies among them cannot be recognised`,
      }),
    );
  }

  // Touches first, so a bounce in the same batch finds the email it bounced.
  const writes = await writeSyncTouches(client, candidates, context.now);
  const bounceOutcomes: BounceOutcome[] = [];

  for (const bounce of bounces) {
    try {
      bounceOutcomes.push(await applyBounce(client, bounce, context));
    } catch (error) {
      if (isRateLimitError(error)) {
        throw error;
      }

      bounceOutcomes.push({ messageId: bounce.id, status: 'failed', detail: errorMessage(error) });
    }
  }

  return {
    messages: messages.length,
    classified,
    subjectRestricted,
    writes,
    bounces: bounceOutcomes,
  };
};
