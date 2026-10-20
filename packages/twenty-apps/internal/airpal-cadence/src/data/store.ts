import { type CoreApiClient } from 'twenty-client-sdk/core';

import { selectActiveConfig, type ActiveConfig } from 'src/utils/active-config';
import { todayIn } from 'src/utils/civil-date';
import {
  buildSuppressionIndex,
  type SuppressionIndex,
} from 'src/utils/normalize-identity';
import {
  type PersonRecord,
  type TouchRecord,
} from 'src/utils/person-cadence';

const PAGE_SIZE = 200;

export const PERSON_SELECTION = {
  id: true,
  updatedAt: true,
  name: { firstName: true, lastName: true },
  emails: { primaryEmail: true, additionalEmails: true },
  linkedinLink: { primaryLinkUrl: true, secondaryLinks: { url: true } },
  cadenceOwnerId: true,
  cadenceOwnerSince: true,
  cadenceReplyResetAt: true,
  cadenceStage: true,
  cadenceHealth: true,
  nextActionDate: true,
  nextActionDateOverride: true,
  snoozeUntil: true,
  revisitDate: true,
  optedOut: true,
  optOutReason: true,
  cadenceResumedAt: true,
  cadenceStep: true,
  cadencePosition: true,
  cadenceState: true,
  cadenceStrikes: true,
  cadenceDue: true,
  cadenceActions: true,
  cadenceComputedOn: true,
  cadenceOwnerChangeRequest: true,
  lastTouchOn: true,
} as const;

export const TOUCH_SELECTION = {
  id: true,
  personId: true,
  channel: true,
  direction: true,
  outcome: true,
  occurredOn: true,
  occurredAt: true,
  source: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} as const;

export const CADENCE_SELECTION = {
  id: true,
  createdAt: true,
  name: true,
  timeZone: true,
  skipWeekends: true,
  strikeSilenceGapAmount: true,
  strikeSilenceGapUnit: true,
  strikeLimit: true,
  acceptanceTimeoutAmount: true,
  acceptanceTimeoutUnit: true,
  nonAdvancingChannels: true,
  inMailChannel: true,
  touchChannels: true,
  isDefault: true,
  lastValidRules: true,
  rulesErrors: true,
  rulesSaveLockedUntil: true,
} as const;

export const STEP_SELECTION = {
  id: true,
  position: true,
  key: true,
  label: true,
  channel: true,
  repeat: true,
  gapBeforeAmount: true,
  gapBeforeUnit: true,
  occurrenceNoun: true,
  requiredData: true,
  whenDataMissing: true,
  gate: true,
  deletedAt: true,
} as const;

export type CadenceNode = {
  id: string;
  createdAt?: string | null;
  name?: string | null;
  timeZone?: string | null;
  skipWeekends?: boolean | null;
  strikeSilenceGapAmount?: number | null;
  strikeSilenceGapUnit?: string | null;
  strikeLimit?: number | null;
  acceptanceTimeoutAmount?: number | null;
  acceptanceTimeoutUnit?: string | null;
  nonAdvancingChannels?: readonly (string | null | undefined)[] | null;
  inMailChannel?: string | null;
  touchChannels?: unknown;
  isDefault?: boolean | null;
  lastValidRules?: unknown;
  rulesErrors?: unknown;
  rulesSaveLockedUntil?: string | null;
};

export type StepNode = {
  id: string;
  position?: unknown;
  key?: string | null;
  label?: string | null;
  channel?: string | null;
  repeat?: number | null;
  gapBeforeAmount?: number | null;
  gapBeforeUnit?: string | null;
  occurrenceNoun?: string | null;
  requiredData?: string | null;
  whenDataMissing?: string | null;
  gate?: string | null;
  deletedAt?: string | null;
};

export type CadenceWithSteps = { cadence: CadenceNode; steps: StepNode[] };

const isLive = (record: { deletedAt?: string | null }) =>
  typeof record.deletedAt !== 'string' || record.deletedAt.length === 0;

// One cadence now (SPEC §1 Q4): the one marked default, else the oldest.
export const pickDefaultCadence = <TCadence extends CadenceNode>(
  cadences: readonly TCadence[],
): TCadence | null =>
  cadences.find((cadence) => cadence.isDefault === true) ??
  [...cadences].sort((first, second) =>
    String(first.createdAt ?? '').localeCompare(String(second.createdAt ?? '')),
  )[0] ??
  null;

export const loadDefaultCadence = async (
  client: CoreApiClient,
): Promise<CadenceWithSteps | null> => {
  const { cadences } = await client.query({
    cadences: {
      __args: { first: 50 },
      edges: {
        node: {
          ...CADENCE_SELECTION,
          steps: {
            __args: { first: PAGE_SIZE },
            edges: { node: STEP_SELECTION },
          },
        },
      },
    },
  });

  const nodes = (cadences?.edges ?? []).map(({ node }) => node);
  const cadence = pickDefaultCadence(nodes as unknown as (CadenceNode & {
    steps?: { edges?: { node: StepNode }[] };
  })[]);

  if (cadence === null) {
    return null;
  }

  const { steps, ...rest } = cadence;

  return {
    cadence: rest,
    steps: (steps?.edges ?? []).map(({ node }) => node).filter(isLive),
  };
};

const toRulesRecord = (cadence: CadenceNode) => ({
  ...cadence,
  nonAdvancingChannels: Array.isArray(cadence.nonAdvancingChannels)
    ? cadence.nonAdvancingChannels.filter(
        (channel): channel is string => typeof channel === 'string',
      )
    : null,
});

export const activeConfigFor = (stored: CadenceWithSteps | null): ActiveConfig =>
  selectActiveConfig(
    stored === null ? null : toRulesRecord(stored.cadence),
    stored?.steps ?? [],
  );

export const cadenceRulesRecord = toRulesRecord;

export const loadSuppressionIndex = async (
  client: CoreApiClient,
): Promise<SuppressionIndex> => {
  const entries: { email?: string | null; linkedinUrl?: string | null }[] = [];
  let after: string | undefined;

  for (;;) {
    const { suppressions } = await client.query({
      suppressions: {
        __args: { first: PAGE_SIZE, ...(after === undefined ? {} : { after }) },
        pageInfo: { hasNextPage: true, endCursor: true },
        edges: { node: { id: true, email: true, linkedinUrl: true } },
      },
    });

    entries.push(...(suppressions?.edges ?? []).map(({ node }) => node));

    if (suppressions?.pageInfo?.hasNextPage !== true) {
      break;
    }

    after = suppressions.pageInfo.endCursor ?? undefined;

    if (after === undefined) {
      break;
    }
  }

  return buildSuppressionIndex(entries);
};

// What every recompute needs besides the person: the active rules, the
// suppression list and today in the cadence's time zone.
export type SharedContext = {
  stored: CadenceWithSteps | null;
  active: ActiveConfig;
  suppressionIndex: SuppressionIndex;
  today: string;
};

export const loadSharedContext = async (
  client: CoreApiClient,
  now: Date = new Date(),
): Promise<SharedContext> => {
  const stored = await loadDefaultCadence(client);
  const active = activeConfigFor(stored);

  if (active.problems.length > 0 && active.source !== 'lastValidRules') {
    console.warn(
      JSON.stringify({ activeConfig: active.source, problems: active.problems }),
    );
  }

  return {
    stored,
    active,
    suppressionIndex: await loadSuppressionIndex(client),
    today: todayIn(active.config.timeZone, now),
  };
};

export type TouchNode = TouchRecord & { updatedAt?: string | null };

export type PersonState = {
  person: PersonRecord;
  touches: TouchNode[];
};

export const loadPersonState = async (
  client: CoreApiClient,
  personId: string,
): Promise<PersonState | null> => {
  const { person, touches } = await client.query({
    person: { __args: { filter: { id: { eq: personId } } }, ...PERSON_SELECTION },
    touches: {
      __args: { filter: { personId: { eq: personId } }, first: PAGE_SIZE },
      pageInfo: { hasNextPage: true, endCursor: true },
      edges: { node: TOUCH_SELECTION },
    },
  });

  if (person === null || person === undefined) {
    return null;
  }

  const nodes = (touches?.edges ?? []).map(({ node }) => node as TouchNode);
  let after = touches?.pageInfo?.hasNextPage === true
    ? (touches.pageInfo.endCursor ?? undefined)
    : undefined;

  while (after !== undefined) {
    const page = await client.query({
      touches: {
        __args: { filter: { personId: { eq: personId } }, first: PAGE_SIZE, after },
        pageInfo: { hasNextPage: true, endCursor: true },
        edges: { node: TOUCH_SELECTION },
      },
    });

    nodes.push(...(page.touches?.edges ?? []).map(({ node }) => node as TouchNode));
    after = page.touches?.pageInfo?.hasNextPage === true
      ? (page.touches.pageInfo.endCursor ?? undefined)
      : undefined;
  }

  return { person: person as PersonRecord, touches: nodes.filter(isLive) };
};

export const loadAllPeople = async (
  client: CoreApiClient,
): Promise<PersonRecord[]> => {
  const people: PersonRecord[] = [];
  let after: string | undefined;

  for (;;) {
    const page = await client.query({
      people: {
        __args: { first: PAGE_SIZE, ...(after === undefined ? {} : { after }) },
        pageInfo: { hasNextPage: true, endCursor: true },
        edges: { node: PERSON_SELECTION },
      },
    });

    people.push(
      ...(page.people?.edges ?? []).map(({ node }) => node as PersonRecord),
    );

    if (page.people?.pageInfo?.hasNextPage !== true) {
      return people;
    }

    after = page.people.pageInfo.endCursor ?? undefined;

    if (after === undefined) {
      return people;
    }
  }
};

export const loadAllTouchesByPerson = async (
  client: CoreApiClient,
): Promise<Map<string, TouchNode[]>> => {
  const byPerson = new Map<string, TouchNode[]>();
  let after: string | undefined;

  for (;;) {
    const page = await client.query({
      touches: {
        __args: { first: PAGE_SIZE, ...(after === undefined ? {} : { after }) },
        pageInfo: { hasNextPage: true, endCursor: true },
        edges: { node: TOUCH_SELECTION },
      },
    });

    for (const { node } of page.touches?.edges ?? []) {
      const touch = node as TouchNode;

      if (typeof touch.personId === 'string' && isLive(touch)) {
        byPerson.set(touch.personId, [
          ...(byPerson.get(touch.personId) ?? []),
          touch,
        ]);
      }
    }

    if (page.touches?.pageInfo?.hasNextPage !== true) {
      return byPerson;
    }

    after = page.touches.pageInfo.endCursor ?? undefined;

    if (after === undefined) {
      return byPerson;
    }
  }
};

// Compared just before a write: if the person or any of their touches changed
// since they were read, the computation is stale and is redone.
export const fingerprintOf = (state: PersonState): string =>
  [
    state.person.updatedAt ?? '',
    ...state.touches
      .map((touch) => `${touch.id}:${touch.updatedAt ?? ''}`)
      .sort(),
  ].join('|');

export const loadFingerprint = async (
  client: CoreApiClient,
  personId: string,
): Promise<string | null> => {
  const state = await loadPersonState(client, personId);

  return state === null ? null : fingerprintOf(state);
};
