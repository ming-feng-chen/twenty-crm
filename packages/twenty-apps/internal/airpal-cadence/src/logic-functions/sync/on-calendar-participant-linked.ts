import {
  defineLogicFunction,
  type ObjectRecordUpdateEvent,
} from 'twenty-sdk/define';
import { type DatabaseEventBatchPayload } from 'twenty-sdk/logic-function';

import { createAppClient } from 'src/data/api';
import { withErrorLogging } from 'src/data/log-errors';
import { syncCalendarEvents } from 'src/sync/data/calendar-sync';
import { loadSyncContext, retryWhenRateLimited } from 'src/sync/data/sync-api';
import { ON_CALENDAR_PARTICIPANT_LINKED_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/sync/sync-identifiers';

type ParticipantRecord = {
  calendarEventId?: string | null;
};

// SPEC §5 Calendar sync, when a synced event's participant is linked to a
// person or member, or answers the invitation (a decline withdraws the
// touch). A meeting that has not begun is left to the hourly check.
const handler = async (
  batch: DatabaseEventBatchPayload<ObjectRecordUpdateEvent<ParticipantRecord>>,
) => {
  const eventIds = [
    ...new Set(
      batch.events.flatMap((event) => {
        const id =
          event.properties.after?.calendarEventId ?? event.properties.before?.calendarEventId;

        return typeof id === 'string' ? [id] : [];
      }),
    ),
  ];

  if (eventIds.length === 0) {
    return { events: 0 };
  }

  const client = createAppClient();
  const context = await loadSyncContext(client);
  const report = await syncCalendarEvents(client, eventIds, context);

  console.log(
    JSON.stringify({ trigger: batch.name, events: batch.events.length, today: context.today, report }),
  );

  const failures = [...report.writes.failures, ...report.retireFailures];

  if (failures.length > 0) {
    throw new Error(
      `Calendar sync could not apply ${failures.length} change(s): ${JSON.stringify(failures)}`,
    );
  }

  return report;
};

export default defineLogicFunction({
  universalIdentifier: ON_CALENDAR_PARTICIPANT_LINKED_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'sync-on-calendar-participant-linked',
  description:
    'Calendar sync: when a synced meeting is linked to a CRM person, logs a meeting touch once the meeting has begun.',
  timeoutSeconds: 300,
  databaseEventTriggerSettings: {
    eventName: 'calendarEventParticipant.updated',
    updatedFields: ['personId', 'workspaceMemberId', 'responseStatus'],
    batchMode: true,
  },
  handler: withErrorLogging(
    'sync-on-calendar-participant-linked',
    retryWhenRateLimited(handler),
  ),
});
