import {
  defineLogicFunction,
  type ObjectRecordUpdateEvent,
} from 'twenty-sdk/define';
import { type DatabaseEventBatchPayload } from 'twenty-sdk/logic-function';

import { createAppClient } from 'src/data/api';
import { withErrorLogging } from 'src/data/log-errors';
import { syncCalendarEvents } from 'src/sync/data/calendar-sync';
import { loadSyncContext, retryWhenRateLimited } from 'src/sync/data/sync-api';
import { ON_CALENDAR_EVENT_CHANGED_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/sync/sync-identifiers';

// A meeting moved or was cancelled: its touches follow (moved to the new day
// if it is still past, withdrawn if it is now in the future or cancelled), so
// no touch stands for a meeting that did not take place then.
const handler = async (
  batch: DatabaseEventBatchPayload<ObjectRecordUpdateEvent<{ id?: string }>>,
) => {
  const eventIds = [...new Set(batch.events.map((event) => event.recordId))].filter(
    (id): id is string => typeof id === 'string',
  );

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
  universalIdentifier: ON_CALENDAR_EVENT_CHANGED_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'sync-on-calendar-event-changed',
  description:
    'Calendar sync: when a meeting moves or is cancelled, moves or withdraws its meeting touches.',
  timeoutSeconds: 300,
  databaseEventTriggerSettings: {
    eventName: 'calendarEvent.updated',
    updatedFields: ['startsAt', 'isCanceled', 'isFullDay'],
    batchMode: true,
  },
  handler: withErrorLogging('sync-on-calendar-event-changed', retryWhenRateLimited(handler)),
});
