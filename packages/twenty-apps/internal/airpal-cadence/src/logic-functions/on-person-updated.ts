import {
  defineLogicFunction,
  type ObjectRecordUpdateEvent,
} from 'twenty-sdk/define';
import { type DatabaseEventBatchPayload } from 'twenty-sdk/logic-function';

import { PERSON_INPUT_FIELDS } from 'src/constants/trigger-fields';
import { ON_PERSON_UPDATED_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { withErrorLogging } from 'src/data/log-errors';
import { createAppClient } from 'src/data/api';
import { applyPersonEdit, type PersonEditOutcome } from 'src/data/person-effects';
import { loadSharedContext } from 'src/data/store';
import { type PersonRecord } from 'src/utils/person-cadence';

// SPEC §3 person.updated: handover, typed next action date, stop-check edits
// and suppression, then the recompute. See PERSON_INPUT_FIELDS.
const handler = async (
  batch: DatabaseEventBatchPayload<ObjectRecordUpdateEvent<PersonRecord>>,
) => {
  const client = createAppClient();
  const shared = await loadSharedContext(client);
  const outcomes: PersonEditOutcome[] = [];

  for (const event of batch.events) {
    outcomes.push(
      await applyPersonEdit({
        client,
        shared,
        personId: event.recordId,
        edit: {
          before: event.properties.before as PersonRecord,
          after: event.properties.after as PersonRecord,
          updatedFields: event.properties.updatedFields ?? [],
        },
        actorWorkspaceMemberId: event.workspaceMemberId ?? null,
      }),
    );
  }

  console.log(
    JSON.stringify({
      trigger: batch.name,
      events: batch.events.map((event) => ({
        personId: event.recordId,
        updatedFields: event.properties.updatedFields ?? [],
        workspaceMemberId: event.workspaceMemberId ?? null,
      })),
      today: shared.today,
      outcomes,
    }),
  );

  return { outcomes };
};

export default defineLogicFunction({
  universalIdentifier: ON_PERSON_UPDATED_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'on-person-updated',
  description:
    'Handles edits to cadence inputs on a person: handover, typed next action date, stop checks and suppression, then recomputes.',
  timeoutSeconds: 300,
  databaseEventTriggerSettings: {
    eventName: 'person.updated',
    updatedFields: PERSON_INPUT_FIELDS,
    batchMode: true,
  },
  handler: withErrorLogging('on-person-updated', handler),
});
