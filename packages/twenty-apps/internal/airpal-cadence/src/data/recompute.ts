import { type CoreApiClient, type CoreSchema } from 'twenty-client-sdk/core';

import { errorMessage } from 'src/data/api';
import {
  fingerprintOf,
  loadAllPeople,
  loadAllTouchesByPerson,
  loadFingerprint,
  loadPersonState,
  type PersonState,
  type SharedContext,
} from 'src/data/store';
import { type CadenceConfig } from 'src/engine';
import { toDateOnly } from 'src/utils/civil-date';
import { type EditDecision } from 'src/utils/edit-decisions';
import { isSuppressed, personIdentity } from 'src/utils/normalize-identity';
import {
  applyInputPatch,
  computePersonCadence,
  diffPersonUpdate,
  type PersonCadenceComputation,
  type PersonRecord,
  type PersonUpdate,
  type TouchRecord,
} from 'src/utils/person-cadence';

const MAX_ATTEMPTS = 3;

export type DecideInput = {
  person: PersonRecord;
  touches: readonly TouchRecord[];
  shared: SharedContext;
  suppressed: boolean;
};

export type RecomputeOutcome =
  | { personId: string; status: 'missing' }
  | { personId: string; status: 'unchanged'; notes: string[] }
  | {
      personId: string;
      status: 'updated';
      fields: string[];
      notes: string[];
      nextActionDate: string | null;
    }
  | { personId: string; status: 'failed'; error: string };

const isPersonSuppressed = (person: PersonRecord, shared: SharedContext) =>
  isSuppressed(personIdentity(person), shared.suppressionIndex);

export const computeForState = (
  state: PersonState,
  shared: SharedContext,
  config: CadenceConfig = shared.active.config,
): PersonCadenceComputation =>
  computePersonCadence({
    person: state.person,
    touches: state.touches,
    config,
    today: shared.today,
    suppressed: isPersonSuppressed(state.person, shared),
  });

const writePerson = async (
  client: CoreApiClient,
  personId: string,
  update: PersonUpdate,
) => {
  await client.mutation({
    updatePerson: {
      __args: {
        id: personId,
        data: update as CoreSchema.PersonUpdateInput,
      },
      id: true,
    },
  });
};

// The one recompute routine (SPEC §3): person, live touches, active rules and
// today in the cadence's time zone go through the engine, and the engine-owned
// fields are written in a single update only if any of them changed. A
// trigger's own decisions (stage move, typed date, handover) come in through
// `decide` and are written in that same update. If the person or their
// touches change between the read and the write, the whole thing is redone.
export const recomputePerson = async (
  client: CoreApiClient,
  personId: string,
  shared: SharedContext,
  decide?: (input: DecideInput) => EditDecision,
): Promise<RecomputeOutcome> => {
  try {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const state = await loadPersonState(client, personId);

      if (state === null) {
        return { personId, status: 'missing' };
      }

      const suppressed = isPersonSuppressed(state.person, shared);
      const decision = decide?.({
        person: state.person,
        touches: state.touches,
        shared,
        suppressed,
      }) ?? { patch: {}, notes: [] };
      const computation = computePersonCadence({
        person: applyInputPatch(state.person, decision.patch),
        touches: state.touches,
        config: shared.active.config,
        today: shared.today,
        suppressed,
      });
      const update = diffPersonUpdate({
        current: state.person,
        patch: decision.patch,
        fields: computation.fields,
        today: shared.today,
      });

      if (update === null) {
        return { personId, status: 'unchanged', notes: decision.notes };
      }

      if ((await loadFingerprint(client, personId)) !== fingerprintOf(state)) {
        console.warn(
          `Person ${personId} changed while being recomputed (attempt ${attempt}); recomputing again`,
        );
        continue;
      }

      await writePerson(client, personId, update);

      return {
        personId,
        status: 'updated',
        fields: Object.keys(update),
        notes: decision.notes,
        nextActionDate: computation.fields.nextActionDate,
      };
    }

    return {
      personId,
      status: 'failed',
      error: `kept changing during ${MAX_ATTEMPTS} attempts`,
    };
  } catch (error) {
    return { personId, status: 'failed', error: errorMessage(error) };
  }
};

export const recomputePeople = async (
  client: CoreApiClient,
  personIds: readonly string[],
  shared: SharedContext,
): Promise<RecomputeOutcome[]> => {
  const outcomes: RecomputeOutcome[] = [];

  for (const personId of new Set(personIds)) {
    outcomes.push(await recomputePerson(client, personId, shared));
  }

  return outcomes;
};

export type RecomputeAllStats = {
  contactsRecomputed: number;
  contactsWhoseDateChanged: number;
  contactsWritten: number;
  failures: { personId: string; error: string }[];
  dateChanges: {
    personId: string;
    name: string;
    from: string | null;
    to: string | null;
  }[];
};

const MAX_LISTED_DATE_CHANGES = 200;

const displayName = (person: PersonRecord) =>
  [person.name?.firstName, person.name?.lastName]
    .filter((part) => typeof part === 'string' && part.length > 0)
    .join(' ') || person.id;

// Everyone, from two bulk reads. Each person whose fields would change is
// re-checked (one read) and written (one call); one that changed meanwhile
// goes through recomputePerson instead. With `dryRun`, nothing is written:
// the stats describe what would happen.
export const recomputeEveryone = async (
  client: CoreApiClient,
  shared: SharedContext,
  {
    dryRun = false,
    config = shared.active.config,
  }: { dryRun?: boolean; config?: CadenceConfig } = {},
): Promise<RecomputeAllStats> => {
  const people = await loadAllPeople(client);
  const touchesByPerson = await loadAllTouchesByPerson(client);
  const stats: RecomputeAllStats = {
    contactsRecomputed: 0,
    contactsWhoseDateChanged: 0,
    contactsWritten: 0,
    failures: [],
    dateChanges: [],
  };

  for (const person of people) {
    const state: PersonState = {
      person,
      touches: touchesByPerson.get(person.id) ?? [],
    };

    try {
      const computation = computeForState(state, shared, config);
      const update = diffPersonUpdate({
        current: person,
        patch: {},
        fields: computation.fields,
        today: shared.today,
      });

      stats.contactsRecomputed += 1;

      const from = toDateOnly(person.nextActionDate);
      const to = computation.fields.nextActionDate;

      if (from !== to) {
        stats.contactsWhoseDateChanged += 1;

        if (stats.dateChanges.length < MAX_LISTED_DATE_CHANGES) {
          stats.dateChanges.push({
            personId: person.id,
            name: displayName(person),
            from,
            to,
          });
        }
      }

      if (dryRun || update === null) {
        continue;
      }

      if ((await loadFingerprint(client, person.id)) === fingerprintOf(state)) {
        await writePerson(client, person.id, update);
        stats.contactsWritten += 1;
        continue;
      }

      const outcome = await recomputePerson(client, person.id, shared);

      if (outcome.status === 'failed') {
        stats.failures.push({ personId: person.id, error: outcome.error });
      } else if (outcome.status === 'updated') {
        stats.contactsWritten += 1;
      }
    } catch (error) {
      stats.failures.push({ personId: person.id, error: errorMessage(error) });
    }
  }

  return stats;
};
