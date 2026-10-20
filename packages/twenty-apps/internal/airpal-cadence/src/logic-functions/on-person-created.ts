import {
  defineLogicFunction,
  type ObjectRecordCreateEvent,
} from 'twenty-sdk/define';
import { type DatabaseEventBatchPayload } from 'twenty-sdk/logic-function';

import { ON_PERSON_CREATED_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { withErrorLogging } from 'src/data/log-errors';
import { createAppClient } from 'src/data/api';
import { applyPersonCreated } from 'src/data/person-effects';
import { loadSharedContext } from 'src/data/store';
import { type PersonRecord } from 'src/utils/person-cadence';

// A new person gets their cadence fields straight away: Cold with no date,
// opted out if they match the suppression list, or the date typed on create.
const handler = async (
  batch: DatabaseEventBatchPayload<ObjectRecordCreateEvent<PersonRecord>>,
) => {
  const client = createAppClient();
  const shared = await loadSharedContext(client);
  const outcomes = [];

  for (const event of batch.events) {
    outcomes.push(
      await applyPersonCreated({
        client,
        shared,
        person: { ...(event.properties.after as PersonRecord), id: event.recordId },
        actorWorkspaceMemberId: event.workspaceMemberId ?? null,
      }),
    );
  }

  console.log(
    JSON.stringify({ trigger: batch.name, today: shared.today, outcomes }),
  );

  return { outcomes };
};

export default defineLogicFunction({
  universalIdentifier: ON_PERSON_CREATED_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'on-person-created',
  description:
    'Computes the cadence fields of a new person, honouring a typed next action date and the suppression list.',
  timeoutSeconds: 300,
  databaseEventTriggerSettings: {
    eventName: 'person.created',
    batchMode: true,
  },
  handler: withErrorLogging('on-person-created', handler),
});
