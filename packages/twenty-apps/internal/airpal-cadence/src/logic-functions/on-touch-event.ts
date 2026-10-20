import {
  defineLogicFunction,
  type ObjectRecordEvent,
} from 'twenty-sdk/define';
import { type DatabaseEventBatchPayload } from 'twenty-sdk/logic-function';

import { TOUCH_INPUT_FIELDS } from 'src/constants/trigger-fields';
import { ON_TOUCH_EVENT_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { withErrorLogging } from 'src/data/log-errors';
import { createAppClient } from 'src/data/api';
import { applyCreatedTouches } from 'src/data/person-effects';
import { recomputePeople, type RecomputeOutcome } from 'src/data/recompute';
import { loadSharedContext } from 'src/data/store';
import { type TouchRecord } from 'src/utils/person-cadence';

type TouchEventRecord = Pick<TouchRecord, 'id' | 'personId'>;

const recordsOf = (event: ObjectRecordEvent<TouchEventRecord>) => {
  const { before, after } = event.properties as {
    before?: TouchEventRecord;
    after?: TouchEventRecord;
  };

  return [before, after].filter(
    (record): record is TouchEventRecord => record !== undefined,
  );
};

// Every change to a touch recomputes its person, and the person it moved away
// from (SPEC §3). A new touch also makes the automatic stage move and ends a
// typed next action date. Deleting a touch is the Undo: the recompute runs as
// if it never happened (SPEC §1 Q9).
const handler = async (
  batch: DatabaseEventBatchPayload<ObjectRecordEvent<TouchEventRecord>>,
) => {
  const client = createAppClient();
  const shared = await loadSharedContext(client);
  const action = batch.name.split('.')[1];
  let outcomes: RecomputeOutcome[];

  if (action === 'created') {
    const createdByPerson = new Map<string, string[]>();

    for (const event of batch.events) {
      const after = (event.properties as { after?: TouchEventRecord }).after;

      if (typeof after?.personId === 'string') {
        createdByPerson.set(after.personId, [
          ...(createdByPerson.get(after.personId) ?? []),
          event.recordId,
        ]);
      }
    }

    outcomes = [];

    for (const [personId, touchIds] of createdByPerson) {
      outcomes.push(
        await applyCreatedTouches(client, shared, personId, touchIds),
      );
    }
  } else {
    const personIds = batch.events.flatMap((event) =>
      recordsOf(event)
        .map((record) => record.personId)
        .filter((personId): personId is string => typeof personId === 'string'),
    );

    outcomes = await recomputePeople(client, personIds, shared);
  }

  console.log(
    JSON.stringify({
      trigger: batch.name,
      events: batch.events.length,
      today: shared.today,
      rules: shared.active.source,
      outcomes,
    }),
  );

  return { outcomes };
};

export default defineLogicFunction({
  universalIdentifier: ON_TOUCH_EVENT_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'on-touch-event',
  description:
    "Recomputes the person's cadence whenever one of their touches is logged, edited, deleted, destroyed or restored.",
  timeoutSeconds: 300,
  databaseEventTriggerSettings: {
    eventName: 'touch.*',
    updatedFields: TOUCH_INPUT_FIELDS,
    batchMode: true,
  },
  handler: withErrorLogging('on-touch-event', handler),
});
