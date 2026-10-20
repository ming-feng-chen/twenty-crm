import { lastItem } from './last-item';
import { effectiveSteps, findStep } from './position';
import { prescribedStep } from './prescribed';
import type {
  CadenceAction,
  CadenceConfig,
  CadenceContact,
  CadenceOverflowAction,
  CadencePositionResult,
  CadenceStepDefinition,
  CadenceTouchTemplate,
  OutreachStatus,
} from './types';

// Snooze, hold and dead sit behind an overflow on every row, so no state lists them.
export const CADENCE_OVERFLOW_ACTIONS: readonly CadenceOverflowAction[] = [
  'snooze',
  'hold',
  'markDead',
];

type ActionContext = {
  // The position, in every state: a stopped sequence still has a step in play.
  result: CadencePositionResult;
  contact: CadenceContact;
  config: CadenceConfig;
};

// The buttons that log a touch on one of the cadence's steps.
type StepAction =
  | 'didIt'
  | 'sentInMail'
  | 'skipToNextStep'
  | 'theyReplied'
  | 'iReplied'
  | 'iFollowedUp';

const isStepAction = (action: CadenceAction): action is StepAction =>
  action === 'didIt' ||
  action === 'sentInMail' ||
  action === 'skipToNextStep' ||
  action === 'theyReplied' ||
  action === 'iReplied' ||
  action === 'iFollowedUp';

const lacksEmailFor = (
  step: CadenceStepDefinition,
  contact: CadenceContact,
): boolean => step.requiredData === 'email' && !contact.hasEmail;

const gatedStep = ({
  result,
  config,
}: ActionContext): CadenceStepDefinition | null => {
  const { position } = result;

  if (position.kind === 'awaitingAcceptance') {
    return findStep(config, position.stepKey);
  }

  return config.steps.find((step) => step.gate !== undefined) ?? null;
};

// The first step after the gated ones that the contact can actually take.
const stepAfterGate = ({
  contact,
  config,
}: ActionContext): CadenceStepDefinition | null => {
  const steps = effectiveSteps(contact, config);
  const gatedIndexes = steps
    .map((step, index) => (step.gate === undefined ? -1 : index))
    .filter((index) => index >= 0);

  return (
    steps
      .slice((lastItem(gatedIndexes) ?? -1) + 1)
      .find((step) => step.channel !== config.connectionRequest.channel) ??
    null
  );
};

// A reply arrives on, and is answered on, the thread being run: the step in
// play; the gated LinkedIn thread while the request is pending (E3); or the
// last step once the sequence has ended.
const threadStep = (context: ActionContext): CadenceStepDefinition | null => {
  const { result, contact, config } = context;
  const inPlay = prescribedStep(result, config);

  if (inPlay !== null) {
    return inPlay;
  }

  if (result.position.kind === 'awaitingAcceptance') {
    return findStep(config, result.position.stepKey);
  }

  return lastItem(effectiveSteps(contact, config)) ?? null;
};

// With no address on file, LinkedIn is the only thread we can have written on.
const linkedInThreadStep = ({
  contact,
  config,
}: ActionContext): CadenceStepDefinition | null =>
  contact.hasLinkedinUrl
    ? (config.steps.find(
        (step) =>
          step.requiredData === 'linkedinUrl' &&
          step.channel !== config.connectionRequest.channel,
      ) ?? null)
    : null;

const intendedStep = (
  action: StepAction,
  context: ActionContext,
): CadenceStepDefinition | null => {
  switch (action) {
    case 'didIt':
      return prescribedStep(context.result, context.config);
    case 'sentInMail':
      return gatedStep(context);
    case 'skipToNextStep':
      return stepAfterGate(context);
    case 'theyReplied':
    case 'iReplied':
    case 'iFollowedUp':
      return threadStep(context);
  }
};

// E2: no button ever logs an email for a contact with no address. A
// conversation moves to LinkedIn when it can; anything else waits for the
// address, and the row offers "Add email address" in its place.
const targetFor = (
  action: StepAction,
  context: ActionContext,
): CadenceStepDefinition | 'noEmailAddress' | null => {
  const step = intendedStep(action, context);

  if (step === null || !lacksEmailFor(step, context.contact)) {
    return step;
  }

  const isConversation =
    action === 'theyReplied' ||
    action === 'iReplied' ||
    action === 'iFollowedUp';

  return (
    (isConversation ? linkedInThreadStep(context) : null) ?? 'noEmailAddress'
  );
};

const runningActions = (context: ActionContext): CadenceAction[] => {
  const { result, contact, config } = context;
  const inPlay = prescribedStep(result, config);

  // Offering "Did it" on an email nobody can have sent invites a false record.
  // Asked of the step itself, so an unowned or not-started contact gets it too.
  if (inPlay !== null && lacksEmailFor(inPlay, contact)) {
    return ['addEmailAddress'];
  }

  if (result.inMailAvailable === true) {
    return ['sentInMail', 'skipToNextStep', 'theyReplied'];
  }

  const actions: CadenceAction[] = [];

  if (inPlay !== null) {
    actions.push('didIt');
  }

  if (result.position.kind === 'awaitingAcceptance') {
    actions.push('theyAccepted');
  }

  actions.push('theyReplied', 'somethingElse');

  return actions;
};

const actionsForState = (
  status: OutreachStatus,
  context: ActionContext,
): CadenceAction[] => {
  switch (status.state) {
    // Permanent: making outreach easy here is the one thing the row must not do.
    case 'optedOut':
      return [];
    case 'dead':
    case 'bounced':
    case 'hold':
    case 'snoozed':
      return ['somethingElse'];
    case 'replyOwed':
      return ['iReplied', 'somethingElse'];
    case 'awaitingResume':
      return ['resumeCadence'];
    case 'inConversation':
      return ['iFollowedUp', 'theyReplied', 'somethingElse'];
    case 'running':
      return runningActions(context);
  }
};

// A button that would log a step nobody can take is dropped, and one that
// would log an email with no address on file becomes "Add email address".
const resolveAction = (
  offered: CadenceAction,
  context: ActionContext,
): CadenceAction | null => {
  if (!isStepAction(offered)) {
    return offered;
  }

  const target = targetFor(offered, context);

  if (target === 'noEmailAddress') {
    return 'addEmailAddress';
  }

  return target === null ? null : offered;
};

type CadenceActionsInput = ActionContext & { status: OutreachStatus; connectionPending?: boolean };

// The row's buttons, in order. Every button offered that logs a step has a
// touch to log (touchForAction never returns null for it).
export const cadenceActions = ({
  status,
  connectionPending,
  ...context
}: CadenceActionsInput): CadenceAction[] => {
  const actions: CadenceAction[] = [];

  for (const offered of actionsForState(status, context)) {
    const action = resolveAction(offered, context);

    if (action !== null && !actions.includes(action)) {
      actions.push(action);
    }
  }

  if (status.state !== 'optedOut' && connectionPending && !actions.includes('theyAccepted')) {
    actions.push('theyAccepted');
  }

  return actions;
};

type TouchForActionInput = ActionContext & { action: CadenceAction };

// What each button logs; null where the action logs no touch. "I replied" and
// "I followed up" answer on the thread a reply would arrive on.
export const touchForAction = ({
  action,
  ...context
}: TouchForActionInput): CadenceTouchTemplate | null => {
  if (action === 'theyAccepted') {
    return {
      channel: context.config.connectionRequest.channel,
      direction: 'inbound',
      outcome: context.config.connectionRequest.acceptedOutcome,
    };
  }

  if (!isStepAction(action)) {
    return null;
  }

  const target = targetFor(action, context);

  if (target === null || target === 'noEmailAddress') {
    return null;
  }

  // E1: "Sent InMail" logs an InMail, which then closes the gated steps.
  if (action === 'sentInMail') {
    return {
      channel: context.config.connectionRequest.inMailChannel,
      direction: 'outbound',
      outcome: null,
    };
  }

  return {
    channel: target.channel,
    direction: action === 'theyReplied' ? 'inbound' : 'outbound',
    outcome: null,
  };
};
