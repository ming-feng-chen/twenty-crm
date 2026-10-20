import { type ObjectRecordEvent } from 'twenty-sdk/define';
import { type DatabaseEventBatchPayload } from 'twenty-sdk/logic-function';

import { createAppClient } from 'src/data/api';
import { reconcileRules } from 'src/data/rules';

// Shared by the cadence.* and cadenceStep.* triggers. While a rules save or the
// seeding holds the lock this does nothing: the save applies its own result,
// and this event's change is part of it.
export const handleRulesEvents = async (
  batch: DatabaseEventBatchPayload<ObjectRecordEvent<object>>,
) => {
  const changedByWorkspaceMemberId =
    batch.events.find((event) => typeof event.workspaceMemberId === 'string')
      ?.workspaceMemberId ?? null;
  const outcome = await reconcileRules({
    client: createAppClient(),
    changedByWorkspaceMemberId,
    reason: `Rules edited directly (${batch.name})`,
  });

  console.log(
    JSON.stringify({
      trigger: batch.name,
      records: batch.events.map((event) => event.recordId),
      changedByWorkspaceMemberId,
      outcome:
        outcome.status === 'applied'
          ? {
              status: outcome.status,
              cadenceChangeId: outcome.cadenceChangeId,
              summary: outcome.summary,
              failures: outcome.stats.failures,
            }
          : outcome,
    }),
  );

  return { status: outcome.status };
};
