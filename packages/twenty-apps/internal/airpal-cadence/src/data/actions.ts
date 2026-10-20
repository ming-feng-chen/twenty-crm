import { type CoreApiClient, type CoreSchema } from 'twenty-client-sdk/core';

import { ActionError } from 'src/data/http';
import { applyCreatedTouches } from 'src/data/person-effects';
import { computeForState, recomputePerson } from 'src/data/recompute';
import { loadPersonState, loadSharedContext } from 'src/data/store';
import { loadTouchChannelsOrBuiltIn } from 'src/data/touch-channels';
import {
  TOUCH_DIRECTION_OPTIONS,
  TOUCH_OUTCOME_OPTIONS,
} from 'src/constants/cadence-values';
import { type CadenceAction, toCadenceDate } from 'src/engine';
import { todayIn } from 'src/utils/civil-date';
import {
  type OwnerChangeMode,
  type OwnerChangeRequest,
} from 'src/utils/edit-decisions';
import {
  personDisplayName,
  type TwentyTouchTemplate,
} from 'src/utils/person-cadence';
import {
  type TouchChannelOption,
  touchChannelLabel,
} from 'src/utils/touch-channels';

const ACTION_LABELS: Partial<Record<CadenceAction, string>> = {
  didIt: 'Did it',
  theyAccepted: 'They accepted',
  theyReplied: 'They replied',
  sentInMail: 'Sent InMail',
  skipToNextStep: 'Skipped to the next step',
  iReplied: 'I replied',
  iFollowedUp: 'I followed up',
};

const isRealDate = (value: string): boolean => {
  try {
    return toCadenceDate(value, 'UTC') === value;
  } catch {
    return false;
  }
};

const channelLabel = (
  options: readonly TouchChannelOption[],
  channel: string | null,
) => touchChannelLabel(options, channel) ?? channel ?? 'Touch';

const isKnown = (
  options: readonly { value: string }[],
  value: string | null,
): boolean => value === null || options.some((option) => option.value === value);

export type LogTouchInput = {
  personId: string;
  // A button from cadenceActions; the server resolves what it logs.
  action?: CadenceAction;
  // Or an explicit touch ("Something else").
  touch?: TwentyTouchTemplate;
  occurredOn?: string;
  note?: string;
  name?: string;
};

// "Did it" and the other logging buttons (SPEC §6): exactly the touch the
// engine prescribes for that action, dated today unless an earlier day is
// given, never a future one, logged as the caller.
export const logTouch = async ({
  appClient,
  actorClient,
  input,
  loggedByWorkspaceMemberId,
}: {
  appClient: CoreApiClient;
  actorClient: CoreApiClient;
  input: LogTouchInput;
  loggedByWorkspaceMemberId: string | null;
}) => {
  const shared = await loadSharedContext(appClient);
  const state = await loadPersonState(appClient, input.personId);

  if (state === null) {
    throw new ActionError(404, `No person ${input.personId}`);
  }

  const occurredOn = input.occurredOn ?? shared.today;

  if (!isRealDate(occurredOn)) {
    throw new ActionError(400, 'occurredOn must be a real YYYY-MM-DD date.');
  }

  if (occurredOn > shared.today) {
    throw new ActionError(
      400,
      `A touch cannot be dated in the future (${occurredOn} is after ${shared.today}).`,
    );
  }

  // Any saved outreach channel, admin-added ones
  // included (SPEC §2).
  const channels = await loadTouchChannelsOrBuiltIn();
  let template: TwentyTouchTemplate | null;
  let label: string;

  if (input.action !== undefined) {
    const computation = computeForState(state, shared);
    const offered = computation.fields.cadenceActions.actions.find(
      (entry) => entry.action === input.action,
    );

    if (offered === undefined || offered.touch === null) {
      throw new ActionError(
        409,
        `"${input.action}" does not log a touch for this person now. Offered: ${computation.fields.cadenceActions.actions
          .map((entry) => entry.action)
          .join(', ')}.`,
      );
    }

    template = offered.touch;
    label =
      input.action === 'didIt'
        ? computation.fields.cadencePosition
        : `${ACTION_LABELS[input.action] ?? input.action} (${channelLabel(channels.options, template.channel)})`;
  } else if (input.touch !== undefined) {
    template = input.touch;
    label = `${channelLabel(channels.options, template.channel)}, ${template.direction === 'INBOUND' ? 'inbound' : 'outbound'}`;
  } else {
    throw new ActionError(400, 'Give either an action or a touch.');
  }

  if (
    template.channel !== null &&
    !isKnown(channels.options, template.channel)
  ) {
    throw new ActionError(
      400,
      `"${template.channel}" is not in the saved outreach channel list${
        channels.error === null
          ? ''
          : ` (the saved list could not be read, so only the built-in channels are accepted for now: ${channels.error})`
      }.`,
      { channels: channels.options.map((option) => option.value) },
    );
  }

  if (
    template.channel === null ||
    template.direction === null ||
    !isKnown(TOUCH_DIRECTION_OPTIONS, template.direction) ||
    !isKnown(TOUCH_OUTCOME_OPTIONS, template.outcome)
  ) {
    throw new ActionError(
      400,
      `Not a valid touch: ${JSON.stringify(template)}`,
    );
  }

  const { createTouch } = await actorClient.mutation({
    createTouch: {
      __args: {
        data: {
          name:
            input.name ?? `${label} — ${personDisplayName(state.person)}`,
          personId: input.personId,
          channel: template.channel,
          direction: template.direction,
          outcome: template.outcome,
          occurredOn,
          source: 'MANUAL',
          note: input.note ?? null,
          ...(loggedByWorkspaceMemberId === null
            ? {}
            : { loggedById: loggedByWorkspaceMemberId }),
        } as CoreSchema.TouchCreateInput,
      },
      id: true,
    },
  });

  if (createTouch === undefined || createTouch === null) {
    throw new Error('createTouch returned no record');
  }

  const outcome = await applyCreatedTouches(appClient, shared, input.personId, [
    createTouch.id,
  ]);

  return { touchId: createTouch.id, outcome };
};

// The Undo (SPEC §1 Q9): delete the touch and recompute as if it never
// happened. A typed date it cleared is not restored (E6).
export const undoTouch = async ({
  appClient,
  actorClient,
  touchId,
}: {
  appClient: CoreApiClient;
  actorClient: CoreApiClient;
  touchId: string;
}) => {
  const { touch } = await appClient.query({
    touch: { __args: { filter: { id: { eq: touchId } } }, id: true, personId: true },
  });

  if (touch === undefined || touch === null) {
    throw new ActionError(404, `No touch ${touchId}`);
  }

  await actorClient.mutation({
    deleteTouch: { __args: { id: touchId }, id: true },
  });

  const shared = await loadSharedContext(appClient);
  const personId = touch.personId ?? null;

  return {
    personId,
    outcome:
      personId === null
        ? null
        : await recomputePerson(appClient, personId, shared),
  };
};

// "Change owner…" (SPEC §4). From someone to someone else is a handover:
// START_FRESH sets cadenceOwnerSince to today, KEEP_POSITION leaves it. A first
// assignment or an unassignment is not a handover and changes nothing else.
// The request is recorded on the person in the same update so the
// person.updated trigger does not apply its native-edit default on top.
export const changeOwner = async ({
  appClient,
  actorClient,
  personId,
  ownerId,
  mode,
  requestedByWorkspaceMemberId,
}: {
  appClient: CoreApiClient;
  actorClient: CoreApiClient;
  personId: string;
  ownerId: string | null;
  mode: OwnerChangeMode;
  requestedByWorkspaceMemberId: string | null;
}) => {
  const shared = await loadSharedContext(appClient);
  const state = await loadPersonState(appClient, personId);

  if (state === null) {
    throw new ActionError(404, `No person ${personId}`);
  }

  const previousOwnerId = state.person.cadenceOwnerId ?? null;

  if (previousOwnerId === ownerId) {
    return { changed: false, isHandover: false, warnings: [] as string[] };
  }

  const isHandover = previousOwnerId !== null && ownerId !== null;
  const before = computeForState(state, shared).fields.cadenceActions;
  const warnings: string[] = [];

  if (isHandover && before.replyOwedSince !== null) {
    warnings.push(
      mode === 'START_FRESH'
        ? `Starting fresh clears the owed reply (since ${before.replyOwedSince}).`
        : `They are owed a reply (since ${before.replyOwedSince}).`,
    );
  }

  if (isHandover && mode === 'KEEP_POSITION' && before.isLinkedInPosition) {
    warnings.push(
      'The next step is on LinkedIn, which belongs to the previous owner’s account: the new owner is not connected with this person.',
    );
  }

  const request: OwnerChangeRequest = {
    toOwnerId: ownerId,
    mode,
    requestedAt: new Date().toISOString(),
    requestedByWorkspaceMemberId,
  };

  await actorClient.mutation({
    updatePerson: {
      __args: {
        id: personId,
        data: {
          cadenceOwnerId: ownerId,
          cadenceOwnerChangeRequest: request as unknown as Record<string, unknown>,
          ...(isHandover && mode === 'START_FRESH'
            ? {
                cadenceOwnerSince: todayIn(shared.active.config.timeZone, new Date(request.requestedAt)),
                cadenceReplyResetAt: request.requestedAt,
              }
            : {}),
        } as CoreSchema.PersonUpdateInput,
      },
      id: true,
    },
  });

  const outcome = await recomputePerson(appClient, personId, shared);

  return { changed: true, isHandover, mode, warnings, outcome };
};

// "Resume cadence" after the strike limit: only when the engine offers it.
export const resumeCadence = async ({
  appClient,
  actorClient,
  personId,
}: {
  appClient: CoreApiClient;
  actorClient: CoreApiClient;
  personId: string;
}) => {
  const shared = await loadSharedContext(appClient);
  const state = await loadPersonState(appClient, personId);

  if (state === null) {
    throw new ActionError(404, `No person ${personId}`);
  }

  const offered = computeForState(state, shared).fields.cadenceActions.actions;

  if (!offered.some((entry) => entry.action === 'resumeCadence')) {
    throw new ActionError(
      409,
      `Resume cadence is not offered for this person now. Offered: ${offered.map((entry) => entry.action).join(', ')}.`,
    );
  }

  await actorClient.mutation({
    updatePerson: {
      __args: { id: personId, data: { cadenceResumedAt: shared.today } },
      id: true,
    },
  });

  return { outcome: await recomputePerson(appClient, personId, shared) };
};
