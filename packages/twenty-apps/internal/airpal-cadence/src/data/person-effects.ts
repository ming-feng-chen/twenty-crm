import { type CoreApiClient } from 'twenty-client-sdk/core';

import { SUPPRESSING_OPT_OUT_REASON } from 'src/constants/cadence-values';
import { recomputePerson, type RecomputeOutcome } from 'src/data/recompute';
import { type SharedContext } from 'src/data/store';
import { ensureSuppressions } from 'src/data/suppressions';
import { toDateOnly } from 'src/utils/civil-date';
import {
  decidePersonEdit,
  decideTouchesCreated,
  isEngineWrite,
  type PersonEdit,
} from 'src/utils/edit-decisions';
import { type PersonRecord } from 'src/utils/person-cadence';

// touch.created: auto stage moves and the end of a typed date, decided from
// the touches as they are now (one deleted before this ran changes nothing).
export const applyCreatedTouches = (
  client: CoreApiClient,
  shared: SharedContext,
  personId: string,
  createdTouchIds: readonly string[],
): Promise<RecomputeOutcome> => {
  const created = new Set(createdTouchIds);

  return recomputePerson(client, personId, shared, ({ person, touches }) =>
    decideTouchesCreated({
      person,
      createdTouches: touches.filter((touch) => created.has(touch.id)),
      config: shared.active.config,
      today: shared.today,
    }),
  );
};

const SUPPRESSION_INPUT_FIELDS = ['optOutReason', 'emails', 'linkedinLink'];

export type PersonEditOutcome =
  | { personId: string; status: 'engineWrite' }
  | (RecomputeOutcome & { suppressionsCreated: string[] });

// person.updated made by a person (or an import, or the change-owner route).
export const applyPersonEdit = async ({
  client,
  shared,
  personId,
  edit,
  actorWorkspaceMemberId,
}: {
  client: CoreApiClient;
  shared: SharedContext;
  personId: string;
  edit: PersonEdit;
  actorWorkspaceMemberId: string | null;
}): Promise<PersonEditOutcome> => {
  if (isEngineWrite(edit.updatedFields)) {
    return { personId, status: 'engineWrite' };
  }

  const suppressionsCreated =
    edit.after.optOutReason === SUPPRESSING_OPT_OUT_REASON &&
    edit.updatedFields.some((field) => SUPPRESSION_INPUT_FIELDS.includes(field))
      ? await ensureSuppressions({
          client,
          person: { ...edit.after, id: personId },
          shared,
          actorWorkspaceMemberId,
        })
      : [];

  const outcome = await recomputePerson(
    client,
    personId,
    shared,
    ({ person, touches, suppressed }) =>
      decidePersonEdit({
        edit,
        currentPerson: person,
        touches,
        config: shared.active.config,
        today: shared.today,
        suppressed,
      }),
  );

  return { ...outcome, suppressionsCreated };
};

// person.created: a date typed on the new record is a typed date, and an
// "asked us to stop" reason suppresses straight away.
export const applyPersonCreated = async ({
  client,
  shared,
  person,
  actorWorkspaceMemberId,
}: {
  client: CoreApiClient;
  shared: SharedContext;
  person: PersonRecord;
  actorWorkspaceMemberId: string | null;
}): Promise<RecomputeOutcome & { suppressionsCreated: string[] }> => {
  const suppressionsCreated =
    person.optOutReason === SUPPRESSING_OPT_OUT_REASON
      ? await ensureSuppressions({
          client,
          person,
          shared,
          actorWorkspaceMemberId,
        })
      : [];
  const typed = toDateOnly(person.nextActionDate);

  const outcome = await recomputePerson(client, person.id, shared, () =>
    typed === null
      ? { patch: {}, notes: [] }
      : {
          patch: { nextActionDateOverride: typed },
          notes: [`created with a typed next action date ${typed}`],
        },
  );

  return { ...outcome, suppressionsCreated };
};
