import {
  defineLogicFunction,
  type ObjectRecordUpdateEvent,
} from 'twenty-sdk/define';
import { type DatabaseEventBatchPayload } from 'twenty-sdk/logic-function';

import { createAppClient } from 'src/data/api';
import { withErrorLogging } from 'src/data/log-errors';
import { syncMessages } from 'src/sync/data/email-sync';
import { loadSyncContext, retryWhenRateLimited } from 'src/sync/data/sync-api';
import { ON_MESSAGE_PARTICIPANT_LINKED_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/sync/sync-identifiers';

type ParticipantRecord = {
  messageId?: string | null;
  personId?: string | null;
  workspaceMemberId?: string | null;
};

const linkedMessageIds = (
  batch: DatabaseEventBatchPayload<ObjectRecordUpdateEvent<ParticipantRecord>>,
): string[] => [
  ...new Set(
    batch.events.flatMap((event) => {
      const after = event.properties.after ?? {};
      const linked =
        (typeof after.personId === 'string' && after.personId.length > 0) ||
        (typeof after.workspaceMemberId === 'string' && after.workspaceMemberId.length > 0);

      return linked && typeof after.messageId === 'string' ? [after.messageId] : [];
    }),
  ),
];

// SPEC §5 Gmail sync. Twenty saves a synced message's participants first and
// links them to people and members afterwards, so a participant's personId
// (or workspaceMemberId, which decides the direction) being set is the
// moment the message can be judged. The whole message is judged each time,
// so whichever link arrives last decides, and repeats change nothing.
const handler = async (
  batch: DatabaseEventBatchPayload<ObjectRecordUpdateEvent<ParticipantRecord>>,
) => {
  const messageIds = linkedMessageIds(batch);

  if (messageIds.length === 0) {
    return { messages: 0 };
  }

  const client = createAppClient();
  const context = await loadSyncContext(client);
  const report = await syncMessages(client, messageIds, context);

  console.log(
    JSON.stringify({
      trigger: batch.name,
      events: batch.events.length,
      today: context.today,
      report,
    }),
  );

  if (report.writes.failures.length > 0) {
    throw new Error(
      `Gmail sync could not apply ${report.writes.failures.length} change(s): ${JSON.stringify(report.writes.failures)}`,
    );
  }

  return report;
};

export default defineLogicFunction({
  universalIdentifier: ON_MESSAGE_PARTICIPANT_LINKED_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'sync-on-message-participant-linked',
  description:
    'Gmail sync: when a synced email is linked to a CRM person or member, logs the email touch (inbound or outbound), skipping automatic replies and internal mail, and marks bounced emails.',
  timeoutSeconds: 300,
  databaseEventTriggerSettings: {
    eventName: 'messageParticipant.updated',
    updatedFields: ['personId', 'workspaceMemberId'],
    batchMode: true,
  },
  handler: withErrorLogging(
    'sync-on-message-participant-linked',
    retryWhenRateLimited(handler),
  ),
});
