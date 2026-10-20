import { type CoreApiClient, type CoreSchema } from 'twenty-client-sdk/core';

import { recomputeEveryone, type RecomputeAllStats } from 'src/data/recompute';
import {
  cadenceRulesRecord,
  CADENCE_SELECTION,
  type CadenceWithSteps,
  loadAllPeople,
  loadAllTouchesByPerson,
  loadDefaultCadence,
  loadSharedContext,
  loadSuppressionIndex,
  type SharedContext,
  type StepNode,
} from 'src/data/store';
import { type CadenceConfig } from 'src/engine';
import {
  buildRulesSnapshot,
  type CadenceRules,
  type CadenceRuleStep,
  configFromRules,
  DEFAULT_CADENCE_RULES,
  parseRulesSnapshot,
  rulesFromRecords,
} from 'src/utils/cadence-rules';
import { todayIn } from 'src/utils/civil-date';
import { describeRulesChange } from 'src/utils/describe-rules-change';
import { isSuppressed, personIdentity } from 'src/utils/normalize-identity';
import { computePersonCadence } from 'src/utils/person-cadence';
import { isDeepEqualJson } from 'src/utils/stable-json';

// A rules save writes several records; while it does, the rules triggers stand
// aside (the save applies the result itself). A crashed save's lock expires.
const RULES_LOCK_MS = 10 * 60 * 1000;
const MAX_APPLY_PASSES = 3;

export type StoredRules = {
  stored: CadenceWithSteps;
  rules: CadenceRules;
  errors: string[];
  config: CadenceConfig | null;
};

// Validates the records against their managed channel list.
export const readStoredRules = (
  stored: CadenceWithSteps,
  touchChannels?: readonly string[],
): StoredRules => {
  const { rules, errors: orderErrors } = rulesFromRecords(
    cadenceRulesRecord(stored.cadence),
    stored.steps,
  );
  const result = configFromRules(
    rules,
    stored.cadence.id,
    orderErrors,
    touchChannels,
  );

  return { stored, rules, errors: result.errors, config: result.config };
};

export const isRulesLockActive = (
  lockedUntil: string | null | undefined,
  now: Date = new Date(),
) =>
  typeof lockedUntil === 'string' &&
  !Number.isNaN(Date.parse(lockedUntil)) &&
  Date.parse(lockedUntil) > now.getTime();

const setLock = async (
  client: CoreApiClient,
  cadenceId: string,
  lockedUntil: string | null,
) =>
  client.mutation({
    updateCadence: {
      __args: { id: cadenceId, data: { rulesSaveLockedUntil: lockedUntil } },
      id: true,
      rulesSaveLockedUntil: true,
    },
  });

// Takes the lock, or returns false when someone else holds it. The lock value
// doubles as the owner's token: whoever reads back their own value owns it.
export const acquireRulesLock = async (
  lockClient: CoreApiClient,
  verifyClient: CoreApiClient,
  cadenceId: string,
): Promise<string | null> => {
  const { cadence } = await verifyClient.query({
    cadence: {
      __args: { filter: { id: { eq: cadenceId } } },
      rulesSaveLockedUntil: true,
    },
  });

  if (isRulesLockActive(cadence?.rulesSaveLockedUntil)) {
    return null;
  }

  const token = new Date(
    Date.now() + RULES_LOCK_MS + Math.floor(Math.random() * 1000),
  ).toISOString();

  await setLock(lockClient, cadenceId, token);

  const { cadence: after } = await verifyClient.query({
    cadence: {
      __args: { filter: { id: { eq: cadenceId } } },
      rulesSaveLockedUntil: true,
    },
  });

  return after?.rulesSaveLockedUntil !== undefined &&
    after?.rulesSaveLockedUntil !== null &&
    Date.parse(after.rulesSaveLockedUntil) === Date.parse(token)
    ? token
    : null;
};

export const releaseRulesLock = async (
  client: CoreApiClient,
  cadenceId: string,
) => {
  await setLock(client, cadenceId, null);
};

const writeRulesErrors = async (
  client: CoreApiClient,
  stored: CadenceWithSteps,
  errors: string[] | null,
) => {
  const current = Array.isArray(stored.cadence.rulesErrors)
    ? stored.cadence.rulesErrors
    : null;

  if (isDeepEqualJson(current, errors)) {
    return;
  }

  await client.mutation({
    updateCadence: {
      __args: {
        id: stored.cadence.id,
        data: { rulesErrors: errors as unknown as Record<string, unknown> },
      },
      id: true,
    },
  });
};

export type ApplyRulesOutcome =
  | { status: 'noCadence' }
  | { status: 'locked' }
  | { status: 'invalid'; errors: string[] }
  | { status: 'unchanged' }
  | {
      status: 'applied';
      cadenceChangeId: string;
      summary: string;
      stats: RecomputeAllStats;
    };

const applyValidRules = async ({
  client,
  current,
  config,
  changedByWorkspaceMemberId,
  reason,
}: {
  client: CoreApiClient;
  current: StoredRules;
  config: CadenceConfig;
  changedByWorkspaceMemberId: string | null;
  reason: string;
}) => {
  const { stored, rules } = current;
  const before = parseRulesSnapshot(stored.cadence.lastValidRules);
  const after = buildRulesSnapshot(stored.cadence.id, rules);

  // The snapshot goes first: from here on every trigger runs on the new rules,
  // so none can write an old-rules result after the recompute below.
  await client.mutation({
    updateCadence: {
      __args: {
        id: stored.cadence.id,
        data: {
          lastValidRules: after as unknown as Record<string, unknown>,
          rulesErrors: null,
        },
      },
      id: true,
    },
  });

  const shared: SharedContext = {
    stored,
    active: {
      config,
      source: 'lastValidRules',
      cadenceId: stored.cadence.id,
      problems: [],
    },
    suppressionIndex: await loadSuppressionIndex(client),
    today: todayIn(config.timeZone),
  };
  const stats = await recomputeEveryone(client, shared);
  const changes = describeRulesChange(before?.rules ?? null, rules);
  const summary = [
    `${reason}.`,
    changes.length === 0 ? 'No rule differences.' : changes.join('; '),
    `${stats.contactsRecomputed} contacts recomputed, ${stats.contactsWhoseDateChanged} next action dates changed.`,
    stats.failures.length === 0
      ? ''
      : `${stats.failures.length} contacts failed to update: ${stats.failures
          .map((failure) => `${failure.personId} (${failure.error})`)
          .join(', ')}.`,
  ]
    .filter((part) => part.length > 0)
    .join(' ');

  const { createCadenceChange } = await client.mutation({
    createCadenceChange: {
      __args: {
        data: {
          name: reason,
          summary,
          changedAt: new Date().toISOString(),
          before: (before ?? null) as unknown as Record<string, unknown>,
          after: after as unknown as Record<string, unknown>,
          contactsRecomputed: stats.contactsRecomputed,
          contactsWhoseDateChanged: stats.contactsWhoseDateChanged,
          ...(changedByWorkspaceMemberId === null
            ? {}
            : { changedById: changedByWorkspaceMemberId }),
        },
      },
      id: true,
    },
  });

  return {
    status: 'applied' as const,
    cadenceChangeId: createCadenceChange?.id ?? '',
    summary,
    stats,
  };
};

// Brings the engine in line with the stored rules (SPEC §3): invalid rules are
// flagged and never used; valid ones that differ from the last applied
// snapshot become the snapshot, everyone is recomputed and a cadenceChange is
// written. It re-reads afterwards and repeats if the rules moved meanwhile.
// The caller must hold the rules lock.
export const applyStoredRules = async ({
  client,
  changedByWorkspaceMemberId,
  reason,
}: {
  client: CoreApiClient;
  changedByWorkspaceMemberId: string | null;
  reason: string;
}): Promise<ApplyRulesOutcome> => {
  let outcome: ApplyRulesOutcome = { status: 'unchanged' };

  for (let pass = 1; pass <= MAX_APPLY_PASSES; pass += 1) {
    const stored = await loadDefaultCadence(client);

    if (stored === null) {
      return { status: 'noCadence' };
    }

    const current = readStoredRules(stored);

    if (current.config === null) {
      await writeRulesErrors(client, stored, current.errors);
      console.warn(
        JSON.stringify({ rulesRejected: current.errors, reason }),
      );

      return { status: 'invalid', errors: current.errors };
    }

    const snapshot = parseRulesSnapshot(stored.cadence.lastValidRules);

    if (
      snapshot !== null &&
      snapshot.cadenceId === stored.cadence.id &&
      isDeepEqualJson(snapshot.rules, current.rules)
    ) {
      await writeRulesErrors(client, stored, null);

      return outcome;
    }

    outcome = await applyValidRules({
      client,
      current,
      config: current.config,
      changedByWorkspaceMemberId,
      reason:
        pass === 1 ? reason : `${reason} (rules changed again while applying)`,
    });
  }

  return outcome;
};

// True when the stored rules are valid but not the ones in use, or invalid
// but not flagged: something a lock holder may have missed.
const needsReconcile = async (client: CoreApiClient): Promise<boolean> => {
  const stored = await loadDefaultCadence(client);

  if (
    stored === null ||
    isRulesLockActive(stored.cadence.rulesSaveLockedUntil)
  ) {
    return false;
  }

  const current = readStoredRules(stored);

  if (current.config === null) {
    return !isDeepEqualJson(stored.cadence.rulesErrors ?? null, current.errors);
  }

  const snapshot = parseRulesSnapshot(stored.cadence.lastValidRules);

  return (
    snapshot === null ||
    snapshot.cadenceId !== stored.cadence.id ||
    !isDeepEqualJson(snapshot.rules, current.rules)
  );
};

// The rules triggers and the cron: take the lock unless a save holds it. A
// trigger that finds the lock taken does nothing, so whoever held it checks
// once more after letting go, in case a change landed during the hand-off.
export const reconcileRules = async ({
  client,
  changedByWorkspaceMemberId,
  reason,
  isFollowUp = false,
}: {
  client: CoreApiClient;
  changedByWorkspaceMemberId: string | null;
  reason: string;
  isFollowUp?: boolean;
}): Promise<ApplyRulesOutcome> => {
  const outcome = await reconcileOnce({
    client,
    changedByWorkspaceMemberId,
    reason,
  });

  if (
    outcome.status !== 'locked' &&
    !isFollowUp &&
    (await needsReconcile(client))
  ) {
    await reconcileRules({
      client,
      changedByWorkspaceMemberId,
      reason: `${reason} (follow-up check)`,
      isFollowUp: true,
    });
  }

  return outcome;
};

const reconcileOnce = async ({
  client,
  changedByWorkspaceMemberId,
  reason,
}: {
  client: CoreApiClient;
  changedByWorkspaceMemberId: string | null;
  reason: string;
}): Promise<ApplyRulesOutcome> => {
  const stored = await loadDefaultCadence(client);

  if (stored === null) {
    return { status: 'noCadence' };
  }

  const token = await acquireRulesLock(client, client, stored.cadence.id);

  if (token === null) {
    return { status: 'locked' };
  }

  try {
    return await applyStoredRules({
      client,
      changedByWorkspaceMemberId,
      reason,
    });
  } finally {
    await releaseRulesLock(client, stored.cadence.id);
  }
};

const stepData = (
  step: CadenceRuleStep,
  position: number,
  cadenceId: string,
) => ({
  name: step.label,
  position,
  key: step.key,
  label: step.label,
  channel: step.channel,
  repeat: step.repeat,
  gapBeforeAmount: step.gapBeforeAmount,
  gapBeforeUnit: step.gapBeforeUnit,
  occurrenceNoun: step.occurrenceNoun,
  requiredData: step.requiredData,
  whenDataMissing: step.whenDataMissing,
  gate: step.gate,
  cadenceId,
});

const STEP_COMPARED_FIELDS = [
  'position',
  'key',
  'label',
  'channel',
  'repeat',
  'gapBeforeAmount',
  'gapBeforeUnit',
  'occurrenceNoun',
  'requiredData',
  'whenDataMissing',
  'gate',
] as const;

const cadenceData = (rules: CadenceRules) => ({
  touchChannels: rules.touchChannels as unknown as Record<string, unknown>,
  name: rules.name,
  timeZone: rules.timeZone,
  skipWeekends: rules.skipWeekends,
  strikeSilenceGapAmount: rules.strikeSilenceGapAmount,
  strikeSilenceGapUnit: rules.strikeSilenceGapUnit,
  strikeLimit: rules.strikeLimit,
  acceptanceTimeoutAmount: rules.acceptanceTimeoutAmount,
  acceptanceTimeoutUnit: rules.acceptanceTimeoutUnit,
  nonAdvancingChannels: rules.nonAdvancingChannels,
  inMailChannel: rules.inMailChannel,
});

// Writes the records so they hold exactly `rules`: the cadence's settings, and
// steps matched by key (updated in place, created, or soft-deleted).
const writeRulesRecords = async (
  client: CoreApiClient,
  stored: CadenceWithSteps,
  rules: CadenceRules,
) => {
  const cadenceId = stored.cadence.id;

  await client.mutation({
    updateCadence: {
      __args: {
        id: cadenceId,
        data: cadenceData(rules) as CoreSchema.CadenceUpdateInput,
      },
      id: true,
    },
  });

  const existingByKey = new Map<string, StepNode>(
    stored.steps
      .filter((step): step is StepNode & { key: string } => typeof step.key === 'string')
      .map((step) => [step.key, step]),
  );
  const keptIds = new Set<string>();

  for (const [position, step] of rules.steps.entries()) {
    const existing = step.key === null ? undefined : existingByKey.get(step.key);
    const data = stepData(step, position, cadenceId);

    if (existing === undefined) {
      await client.mutation({
        createCadenceStep: {
          __args: { data: data as CoreSchema.CadenceStepCreateInput },
          id: true,
        },
      });
      continue;
    }

    keptIds.add(existing.id);

    const isSame = STEP_COMPARED_FIELDS.every((field) =>
      isDeepEqualJson(existing[field] ?? null, data[field] ?? null),
    );

    if (!isSame) {
      await client.mutation({
        updateCadenceStep: {
          __args: {
            id: existing.id,
            data: data as CoreSchema.CadenceStepUpdateInput,
          },
          id: true,
        },
      });
    }
  }

  for (const step of stored.steps) {
    if (!keptIds.has(step.id)) {
      await client.mutation({
        deleteCadenceStep: { __args: { id: step.id }, id: true },
      });
    }
  }
};

export type SaveRulesOutcome =
  | { status: 'invalid'; errors: string[] }
  | { status: 'noCadence' }
  | { status: 'locked' }
  | { status: 'forbidden'; error: string }
  | { status: 'conflict'; error: string }
  | Exclude<ApplyRulesOutcome, { status: 'noCadence' | 'locked' }>;

// The settings page's Save (SPEC §6): validate the candidate, write it with
// the member's own permissions (members cannot write rules), then apply it
// once — one recompute and one audit record for the whole save.
export const saveRules = async ({
  actorClient,
  appClient,
  rules,
  baseRules,
  changedByWorkspaceMemberId,
}: {
  actorClient: CoreApiClient;
  appClient: CoreApiClient;
  rules: CadenceRules;
  // The rules the editor started from; a save over someone else's newer save
  // is refused rather than silently overwriting it.
  baseRules: CadenceRules | null;
  changedByWorkspaceMemberId: string | null;
}): Promise<SaveRulesOutcome> => {
  const stored = await loadDefaultCadence(appClient);

  if (stored === null) {
    return { status: 'noCadence' };
  }

  const candidate = configFromRules(
    rules,
    stored.cadence.id,
    [],
  );

  if (candidate.config === null) {
    return { status: 'invalid', errors: candidate.errors };
  }

  if (baseRules !== null) {
    const snapshot = parseRulesSnapshot(stored.cadence.lastValidRules);

    if (snapshot !== null && !isDeepEqualJson(snapshot.rules, baseRules)) {
      return {
        status: 'conflict',
        error:
          'The rules were changed by someone else since you opened them. Reload and try again.',
      };
    }
  }

  let token: string | null;

  try {
    // Written with the member's token: this is where a member is refused.
    token = await acquireRulesLock(actorClient, appClient, stored.cadence.id);
  } catch (error) {
    return {
      status: 'forbidden',
      error: error instanceof Error ? error.message : String(error),
    };
  }

  if (token === null) {
    return { status: 'locked' };
  }

  try {
    await writeRulesRecords(actorClient, stored, rules);

    const outcome = await applyStoredRules({
      client: appClient,
      changedByWorkspaceMemberId,
      reason: 'Rules saved on the Cadence rules page',
    });

    return outcome.status === 'noCadence' || outcome.status === 'locked'
      ? { status: 'conflict', error: `unexpected ${outcome.status}` }
      : outcome;
  } finally {
    await releaseRulesLock(appClient, stored.cadence.id);

    if (await needsReconcile(appClient)) {
      await reconcileRules({
        client: appClient,
        changedByWorkspaceMemberId,
        reason: 'Rules edited while a save was in progress',
        isFollowUp: true,
      });
    }
  }
};

export type SeedOutcome =
  | { status: 'exists'; cadenceId: string }
  | { status: 'seeded'; cadenceId: string; apply: ApplyRulesOutcome };

// Install / first run (SPEC §2): a default cadence equal to the engine's
// DEFAULT_CADENCE_CONFIG, only if no cadence exists. Created locked, so the
// rules triggers stand aside until it is complete and applied.
export const seedDefaultCadence = async (
  client: CoreApiClient,
): Promise<SeedOutcome> => {
  const existing = await loadDefaultCadence(client);

  if (existing !== null) {
    return { status: 'exists', cadenceId: existing.cadence.id };
  }

  const rules = DEFAULT_CADENCE_RULES;
  const { createCadence } = await client.mutation({
    createCadence: {
      __args: {
        data: {
          ...cadenceData(rules),
          isDefault: true,
          rulesSaveLockedUntil: new Date(Date.now() + RULES_LOCK_MS).toISOString(),
        } as CoreSchema.CadenceCreateInput,
      },
      ...CADENCE_SELECTION,
    },
  });

  if (createCadence === undefined || createCadence === null) {
    throw new Error('createCadence returned no record');
  }

  const cadenceId = createCadence.id;

  try {
    for (const [position, step] of rules.steps.entries()) {
      await client.mutation({
        createCadenceStep: {
          __args: {
            data: stepData(step, position, cadenceId) as CoreSchema.CadenceStepCreateInput,
          },
          id: true,
        },
      });
    }

    const apply = await applyStoredRules({
      client,
      changedByWorkspaceMemberId: null,
      reason: 'Default cadence created',
    });

    return { status: 'seeded', cadenceId, apply };
  } finally {
    await releaseRulesLock(client, cadenceId);
  }
};

export type PreviewOutcome =
  | { valid: false; errors: string[] }
  | {
      valid: true;
      contactsRecomputed: number;
      contactsWhoseDateChanged: number;
      changes: {
        personId: string;
        name: string;
        ownerId: string | null;
        from: string | null;
        to: string | null;
      }[];
    };

const MAX_PREVIEW_CHANGES = 200;

// How many contacts' next action dates a candidate would move, against the
// rules in use today. Nothing is written.
export const previewRules = async (
  client: CoreApiClient,
  rules: CadenceRules,
): Promise<PreviewOutcome> => {
  const shared = await loadSharedContext(client);
  const candidate = configFromRules(
    rules,
    shared.stored?.cadence.id ?? shared.active.config.id,
    [],
  );

  if (candidate.config === null) {
    return { valid: false, errors: candidate.errors };
  }

  const people = await loadAllPeople(client);
  const touchesByPerson = await loadAllTouchesByPerson(client);
  const changes: Extract<PreviewOutcome, { valid: true }>['changes'] = [];
  let contactsWhoseDateChanged = 0;

  for (const person of people) {
    const suppressed = isSuppressed(
      personIdentity(person),
      shared.suppressionIndex,
    );
    const touches = touchesByPerson.get(person.id) ?? [];
    const now = computePersonCadence({
      person,
      touches,
      config: shared.active.config,
      today: shared.today,
      suppressed,
    }).fields.nextActionDate;
    const then = computePersonCadence({
      person,
      touches,
      config: candidate.config,
      today: todayIn(candidate.config.timeZone),
      suppressed,
    }).fields.nextActionDate;

    if (now !== then) {
      contactsWhoseDateChanged += 1;

      if (changes.length < MAX_PREVIEW_CHANGES) {
        changes.push({
          personId: person.id,
          name:
            [person.name?.firstName, person.name?.lastName]
              .filter(Boolean)
              .join(' ') || person.id,
          ownerId: person.cadenceOwnerId ?? null,
          from: now,
          to: then,
        });
      }
    }
  }

  return {
    valid: true,
    contactsRecomputed: people.length,
    contactsWhoseDateChanged,
    changes,
  };
};
