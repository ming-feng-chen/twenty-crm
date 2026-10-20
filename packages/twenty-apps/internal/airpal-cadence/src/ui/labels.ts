import {
  CADENCE_HEALTH_OPTIONS,
  CADENCE_STAGE_OPTIONS,
  CADENCE_STATE_OPTIONS,
  GAP_UNIT_OPTIONS,
  OPT_OUT_REASON_OPTIONS,
  TOUCH_CHANNEL_OPTIONS,
  TOUCH_DIRECTION_OPTIONS,
  TOUCH_OUTCOME_OPTIONS,
} from 'src/constants/cadence-values';

import { type CadenceActionEntry } from 'src/ui/cadence-actions';

// What the UI calls things. Button wording is the old CRM's (how-the-crm-works
// §10), so the team sees the words they already know.

type Option = { value: string; label: string };

const humanise = (value: string): string => {
  const words = value.replace(/_/g, ' ').toLowerCase().trim();

  return words.length === 0 ? value : `${words[0].toUpperCase()}${words.slice(1)}`;
};

const labelFrom =
  (options: readonly Option[]) =>
  (value: string | null | undefined): string =>
    value === null || value === undefined || value === ''
      ? '—'
      : (options.find((option) => option.value === value)?.label ??
        humanise(value));

export const stageLabel = labelFrom(CADENCE_STAGE_OPTIONS);
export const healthLabel = labelFrom(CADENCE_HEALTH_OPTIONS);
export const stateLabel = labelFrom(CADENCE_STATE_OPTIONS);
// Saved channel labels, once the page has read them:
// an admin-added channel then shows its own label, not a humanised value.
const liveChannelLabels = new Map<string, string>();

export const rememberChannelLabels = (
  options: readonly { value: string; label: string }[],
) => {
  for (const option of options) {
    liveChannelLabels.set(option.value, option.label);
  }
};

const builtInChannelLabel = labelFrom(TOUCH_CHANNEL_OPTIONS);

export const channelLabel = (value: string | null | undefined): string =>
  (typeof value === 'string' ? liveChannelLabels.get(value) : undefined) ??
  builtInChannelLabel(value);
export const directionLabel = labelFrom(TOUCH_DIRECTION_OPTIONS);
export const outcomeLabel = labelFrom(TOUCH_OUTCOME_OPTIONS);
export const optOutReasonLabel = labelFrom(OPT_OUT_REASON_OPTIONS);
export const gapUnitLabel = labelFrom(GAP_UNIT_OPTIONS);

export const DIRECTION_CHOICES: Option[] = TOUCH_DIRECTION_OPTIONS.map(
  ({ value, label }) => ({ value, label }),
);
export const OUTCOME_CHOICES: Option[] = TOUCH_OUTCOME_OPTIONS.map(
  ({ value, label }) => ({ value, label }),
);
export const OPT_OUT_REASON_CHOICES: Option[] = OPT_OUT_REASON_OPTIONS.map(
  ({ value, label }) => ({ value, label }),
);

// The one opt-out reason that cannot be taken back (SPEC §2 suppression).
export const PERMANENT_OPT_OUT_REASON = 'ASKED_US_TO_STOP';

export const KNOWN_ACTIONS = [
  'didIt',
  'theyAccepted',
  'theyReplied',
  'sentInMail',
  'skipToNextStep',
  'iReplied',
  'iFollowedUp',
  'resumeCadence',
  'addEmailAddress',
  'somethingElse',
] as const;

export type KnownAction = (typeof KNOWN_ACTIONS)[number];

export const isKnownAction = (action: string): action is KnownAction =>
  (KNOWN_ACTIONS as readonly string[]).includes(action);

const FIXED_LABELS: Record<Exclude<KnownAction, 'skipToNextStep'>, string> = {
  didIt: 'Did it',
  theyAccepted: 'They accepted',
  theyReplied: 'They replied',
  sentInMail: 'Sent InMail',
  iReplied: 'I replied',
  iFollowedUp: 'I followed up',
  resumeCadence: 'Resume cadence',
  addEmailAddress: 'Add email address',
  somethingElse: 'Something else',
};

const DESCRIPTIONS: Record<KnownAction, string> = {
  didIt: 'Log the step this row is showing, dated today, as you',
  theyAccepted:
    'Log that they accepted the connection request. Not a reply: nobody owes an answer',
  theyReplied:
    'Log their reply. This stops the sequence and moves the stage to in conversation',
  sentInMail: 'Log the InMail you sent; the sequence then moves on to email',
  skipToNextStep:
    'Leave the connection request unaccepted and move on to the next step',
  iReplied: 'Log your answer to them, so this stops being the top task',
  iFollowedUp: 'Log your follow-up in this conversation',
  resumeCadence: 'Restart the sequence after the follow-ups went unanswered',
  addEmailAddress: 'The next step is an email and there is no address on file',
  somethingElse: 'Log a different touch: pick the channel, direction and date',
};

// "Skip to email" names where the skip lands, which with the default cadence
// is always email; a custom cadence could skip to another channel.
export const actionLabel = (entry: CadenceActionEntry): string => {
  if (entry.action === 'skipToNextStep') {
    const channel = entry.touch?.channel ?? 'EMAIL';

    return channel === 'EMAIL'
      ? 'Skip to email'
      : `Skip to ${channelLabel(channel).toLowerCase()}`;
  }

  return isKnownAction(entry.action)
    ? FIXED_LABELS[entry.action as Exclude<KnownAction, 'skipToNextStep'>]
    : humanise(entry.action.replace(/([a-z])([A-Z])/g, '$1 $2'));
};

export const actionDescription = (entry: CadenceActionEntry): string =>
  isKnownAction(entry.action)
    ? DESCRIPTIONS[entry.action]
    : 'Log the touch the cadence prescribes for this action';

// How a button is carried out.
export type ActionKind =
  | 'logTouch' // POST log-touch with { action }
  | 'resume' // POST resume
  | 'addEmail' // inline email input
  | 'somethingElse' // inline touch form
  | 'unsupported';

export const actionKind = (entry: CadenceActionEntry): ActionKind => {
  switch (entry.action) {
    case 'resumeCadence':
      return 'resume';
    case 'addEmailAddress':
      return 'addEmail';
    case 'somethingElse':
      return 'somethingElse';
    default:
      // Any other action the engine offers logs its prescribed touch; one
      // without a touch has no write behind it, so it is shown, not clickable.
      return entry.touch === null ? 'unsupported' : 'logTouch';
  }
};

// The buttons that log "the step this row shows" can be backdated and carry
// a note (the old CRM's secondary control).
const BACKDATABLE: readonly string[] = ['didIt', 'iReplied', 'iFollowedUp'];

export const isBackdatable = (entry: CadenceActionEntry): boolean =>
  BACKDATABLE.includes(entry.action) && entry.touch !== null;

export const isPrimaryAction = (entry: CadenceActionEntry): boolean =>
  entry.action === 'didIt' || entry.action === 'iReplied';

// The overflow "…" menu, in order (SPEC §6).
export const OVERFLOW_ITEMS = [
  { key: 'snooze', label: 'Snooze…' },
  { key: 'hold', label: 'Hold…' },
  { key: 'dead', label: 'Dead' },
  { key: 'optOut', label: 'Opt out…' },
  { key: 'changeOwner', label: 'Change owner…' },
  { key: 'view', label: 'View' },
] as const;

export type OverflowKey = (typeof OVERFLOW_ITEMS)[number]['key'];

export const describeTouch = (touch: {
  channel: string | null;
  direction: string | null;
  outcome?: string | null;
}): string => {
  const parts = [
    channelLabel(touch.channel),
    touch.direction === 'INBOUND' ? 'inbound' : 'outbound',
  ];

  if (touch.outcome !== null && touch.outcome !== undefined) {
    parts.push(outcomeLabel(touch.outcome).toLowerCase());
  }

  return parts.join(', ');
};

export const plural = (count: number, singular: string, pluralForm?: string) =>
  `${count} ${count === 1 ? singular : (pluralForm ?? `${singular}s`)}`;
