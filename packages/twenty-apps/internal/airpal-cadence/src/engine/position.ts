import { addDuration, toCadenceDate } from './business-days';
import { lastItem } from './last-item';
import {
  isAcceptance,
  isConnectionRequest,
  isInMail,
  sequenceTouchesFromRun,
  touchesUnderCurrentOwner,
  type DatedTouch,
} from './touches';
import type {
  CadenceBlockedReason,
  CadenceConfig,
  CadenceContact,
  CadenceDate,
  CadenceDateInput,
  CadencePosition,
  CadencePositionResult,
  CadenceRequiredData,
  CadenceStepDefinition,
  CadenceTouch,
} from './types';

// Position names the step in play: the next thing to do, not the last thing
// done. It is recomputed from the touches on every read and never stored.

type StepProgress = {
  step: CadenceStepDefinition;
  consumed: number;
  isComplete: boolean;
};

type CurrentStep = {
  index: number;
  kind: 'step' | 'awaitingAcceptance';
};

const MISSING_DATA_REASONS: Record<CadenceRequiredData, CadenceBlockedReason> =
  {
    linkedinUrl: 'noLinkedinUrl',
    email: 'noEmailAddress',
  };

const hasRequiredData = (
  contact: CadenceContact,
  requiredData: CadenceRequiredData,
): boolean =>
  requiredData === 'linkedinUrl' ? contact.hasLinkedinUrl : contact.hasEmail;

const isMissingData = (
  step: CadenceStepDefinition,
  contact: CadenceContact,
): boolean =>
  step.requiredData !== undefined &&
  !hasRequiredData(contact, step.requiredData);

export const isStepSkipped = (
  step: CadenceStepDefinition,
  contact: CadenceContact,
): boolean => isMissingData(step, contact) && step.whenDataMissing === 'skip';

export const effectiveSteps = (
  contact: CadenceContact,
  config: CadenceConfig,
): CadenceStepDefinition[] =>
  config.steps.filter((step) => !isStepSkipped(step, contact));

export const findStep = (
  config: CadenceConfig,
  stepKey: string,
): CadenceStepDefinition => {
  const step = config.steps.find((candidate) => candidate.key === stepKey);

  if (step === undefined) {
    throw new Error(`The cadence "${config.id}" has no step "${stepKey}".`);
  }

  return step;
};

export const findConnectionRequestStep = (
  config: CadenceConfig,
): CadenceStepDefinition | undefined =>
  config.steps.find(
    (step) => step.channel === config.connectionRequest.channel,
  );

// Counts are handed to steps in order, so seven emails fill the email run
// before the drip, which shares its channel, gets any.
const allocate = (
  steps: readonly CadenceStepDefinition[],
  sequence: readonly DatedTouch[],
  isRequested: boolean,
  config: CadenceConfig,
): StepProgress[] => {
  const remaining = new Map<string, number>();

  for (const touch of sequence) {
    remaining.set(touch.channel, (remaining.get(touch.channel) ?? 0) + 1);
  }

  return steps.map((step) => {
    const available = remaining.get(step.channel) ?? 0;
    const consumed =
      step.repeat === 'forever' ? available : Math.min(available, step.repeat);

    remaining.set(step.channel, available - consumed);

    // A request sent while the cadence was stopped still opens the gate.
    const isComplete =
      step.channel === config.connectionRequest.channel
        ? isRequested
        : step.repeat !== 'forever' && consumed >= step.repeat;

    return { step, consumed, isComplete };
  });
};

const hasLaterConsumption = (
  progress: readonly StepProgress[],
  index: number,
): boolean => progress.slice(index + 1).some((later) => later.consumed > 0);

const hasLaterCompletion = (
  progress: readonly StepProgress[],
  index: number,
): boolean => progress.slice(index + 1).some((later) => later.isComplete);

// An unfinished step is passed over once a later step has been worked: the
// system follows what the person actually did. An accepted gate is the
// exception, and only a finished later step passes over it.
const findCurrentStep = (
  progress: readonly StepProgress[],
  isAccepted: boolean,
  isRequested: boolean,
  isInMailSent: boolean,
): CurrentStep | null => {
  for (const [index, { step, consumed, isComplete }] of progress.entries()) {
    if (step.gate === 'linkedinAccepted') {
      if (isAccepted) {
        if (isComplete || hasLaterCompletion(progress, index)) {
          continue;
        }

        return { index, kind: 'step' };
      }

      // The InMail closes the gated steps like Skip does, so the sequence
      // moves on and never repeats it (E1). It is logged on the InMail
      // channel; a message on the gated step's own channel sent without
      // acceptance is read as the InMail too, as older histories logged it.
      if (
        !isRequested ||
        isInMailSent ||
        consumed > 0 ||
        hasLaterConsumption(progress, index)
      ) {
        continue;
      }

      return { index, kind: 'awaitingAcceptance' };
    }

    if (isComplete || hasLaterConsumption(progress, index)) {
      continue;
    }

    return { index, kind: 'step' };
  }

  return null;
};

const isInMailOffered = (
  run: readonly DatedTouch[],
  today: CadenceDate,
  config: CadenceConfig,
): boolean => {
  const request = lastItem(
    run.filter((touch) => isConnectionRequest(touch, config)),
  );

  if (request === undefined) {
    return false;
  }

  return (
    today >=
    addDuration(request.date, config.connectionRequest.acceptanceTimeout, config)
  );
};

// Most blocking first. A missing-data block only annotates a real step, never
// "Not started", which is why a contact with neither URL nor address reads as
// "no LinkedIn URL".
const blockedReasonFor = (
  contact: CadenceContact,
  position: CadencePosition,
  explicit: CadenceBlockedReason | undefined,
  config: CadenceConfig,
): CadenceBlockedReason | undefined => {
  if (!contact.hasOwner) {
    return 'unowned';
  }

  if (explicit !== undefined) {
    return explicit;
  }

  if (position.kind === 'step' || position.kind === 'forever') {
    const step = findStep(config, position.stepKey);

    if (
      step.requiredData !== undefined &&
      isMissingData(step, contact) &&
      step.whenDataMissing === 'block'
    ) {
      return MISSING_DATA_REASONS[step.requiredData];
    }
  }

  const skipped = config.steps.find((step) => isStepSkipped(step, contact));

  return skipped?.requiredData === undefined
    ? undefined
    : MISSING_DATA_REASONS[skipped.requiredData];
};

const positionFor = (
  current: CurrentStep | null,
  progress: readonly StepProgress[],
  run: readonly DatedTouch[],
  sequence: readonly DatedTouch[],
  config: CadenceConfig,
): CadencePosition => {
  if (current === null) {
    return { kind: 'sequenceComplete' };
  }

  const { step, consumed } = progress[current.index];

  if (current.kind !== 'step') {
    return { kind: current.kind, stepKey: step.key };
  }

  if (consumed === 0 && sequence.length === 0) {
    if (run.length === 0 && current.index === 0) {
      return { kind: 'notStarted', stepKey: step.key };
    }

    // Follows and comments only warm up the opening step of the cadence itself.
    if (run.length > 0 && step.key === config.steps[0]?.key) {
      return { kind: 'warmedUp', stepKey: step.key };
    }
  }

  // A forever step counts the touches it has had, not the time gone by (E4);
  // its schedule still runs from the last touch (see proposeNextAction).
  return {
    kind: step.repeat === 'forever' ? 'forever' : 'step',
    stepKey: step.key,
    occurrence: consumed + 1,
  };
};

export const computePosition = (
  contact: CadenceContact,
  touches: readonly CadenceTouch[],
  today: CadenceDateInput,
  config: CadenceConfig,
): CadencePositionResult => {
  const todayDate = toCadenceDate(today, config.timeZone);
  const run = touchesUnderCurrentOwner(contact, touches, config);
  const sequence = sequenceTouchesFromRun(run, contact, config);
  const isAccepted = run.some((touch) => isAcceptance(touch, config));
  const firstRequest = run.find((touch) => isConnectionRequest(touch, config));
  const isRequested = firstRequest !== undefined;
  // Sent while the request was out and, since nothing accepted it, unaccepted.
  const isInMailSent =
    firstRequest !== undefined &&
    sequence.some(
      (touch) => isInMail(touch, config) && touch.date >= firstRequest.date,
    );

  const progress = allocate(
    effectiveSteps(contact, config),
    sequence,
    isRequested,
    config,
  );
  const current = findCurrentStep(
    progress,
    isAccepted,
    isRequested,
    isInMailSent,
  );
  const computedPosition = positionFor(current, progress, run, sequence, config);
  const requestStep = findConnectionRequestStep(config);
  const position =
    computedPosition.kind === 'notStarted' && !contact.hasOwner && !contact.hasLinkedinUrl && requestStep !== undefined
      ? { ...computedPosition, stepKey: requestStep.key }
      : computedPosition;

  const inMailOffered =
    position.kind === 'awaitingAcceptance' &&
    isInMailOffered(run, todayDate, config);
  const explicit =
    position.kind === 'awaitingAcceptance' && !inMailOffered
      ? 'connectionPending'
      : undefined;
  const blockedReason = blockedReasonFor(contact, position, explicit, config);

  const result: CadencePositionResult =
    blockedReason === undefined ? { position } : { position, blockedReason };

  return inMailOffered ? { ...result, inMailAvailable: true } : result;
};

// LinkedIn steps belong to one person's account, so a kept handover cannot
// carry them; the handover dialog warns on these.
export const isLinkedInPosition = (
  result: CadencePositionResult,
  config: CadenceConfig,
): boolean => {
  const { position } = result;

  if (position.kind === 'awaitingAcceptance') {
    return true;
  }

  return (
    position.kind === 'step' &&
    findStep(config, position.stepKey).requiredData === 'linkedinUrl'
  );
};
