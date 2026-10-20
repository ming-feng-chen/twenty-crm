// A civil date, YYYY-MM-DD, in the cadence's time zone.
export type CadenceDate = string;

// Instants are converted to a civil date in the cadence's time zone. Date-only
// values (snooze, revisit, a touch's day) should be passed as CadenceDate strings
// so a zone west of UTC cannot shift them back a day.
export type CadenceDateInput = Date | CadenceDate;

export type GapUnit = 'businessDays' | 'calendarDays';

export type CadenceDuration = {
  amount: number;
  unit: GapUnit;
};

export type CadenceRequiredData = 'linkedinUrl' | 'email';

export type CadenceWhenDataMissing = 'skip' | 'block';

export type CadenceStepGate = 'linkedinAccepted';

export type CadenceStepDefinition = {
  key: string;
  label: string;
  channel: string;
  repeat: number | 'forever';
  // The wait, counted from the last sequence touch, before this step is due.
  gapBefore: CadenceDuration;
  // Forever steps only: what one occurrence is called, so 'email' renders the
  // third drip touch as 'Drip, email 3'. Without it the label is 'Drip 3'.
  occurrenceNoun?: string;
  requiredData?: CadenceRequiredData;
  whenDataMissing?: CadenceWhenDataMissing;
  gate?: CadenceStepGate;
};

export type CadenceConnectionRequestRule = {
  channel: string;
  acceptedOutcome: string;
  acceptanceTimeout: CadenceDuration;
  // What "Sent InMail" logs. An outbound touch on it, sent after the request
  // while the request is unaccepted, closes the gated steps (E1). It is a
  // sequence touch, but no step's own channel, so it consumes no step.
  inMailChannel: string;
};

export type CadenceBounceRule = {
  channel: string;
  outcome: string;
};

export type CadenceConfig = {
  id: string;
  name: string;
  timeZone: string;
  skipWeekends: boolean;
  steps: readonly CadenceStepDefinition[];
  connectionRequest: CadenceConnectionRequestRule;
  bounce: CadenceBounceRule;
  strikeSilenceGap: CadenceDuration;
  strikeLimit: number;
  nonAdvancingChannels: readonly string[];
  conversationalChannels: readonly string[];
};

export type CadenceCalendar = Pick<CadenceConfig, 'timeZone' | 'skipWeekends'>;

export type CadenceStage =
  | 'notContacted'
  | 'contactedNoReply'
  | 'repliedInConversation'
  | 'deckSent'
  | 'meetingScheduled'
  | 'deckReviewedFollowUp'
  | 'pilotDiscussion'
  | 'pilotAgreed'
  | 'dead';

export type CadenceHealth = 'active' | 'hold' | 'dead';

export type CadenceContact = {
  stage: CadenceStage;
  health: CadenceHealth;
  hasOwner: boolean;
  // Set by a start-fresh handover; only touches on or after its date count.
  ownerSince: CadenceDateInput | null;
  replyResetAt?: string;
  hasEmail: boolean;
  hasLinkedinUrl: boolean;
  optedOut: boolean;
  cadenceResumedAt: CadenceDateInput | null;
  snoozeUntil: CadenceDateInput | null;
  revisitDate: CadenceDateInput | null;
  // A date a person typed. It stands until the next logged touch.
  nextActionDateOverride: CadenceDateInput | null;
};

export type CadenceTouchDirection = 'outbound' | 'inbound';

export type CadenceTouch = {
  channel: string;
  direction: CadenceTouchDirection;
  outcome: string | null;
  occurredAt: CadenceDateInput;
  occurredAtInstant?: string;
  recordedAtInstant?: string;
};

export type CadenceTouchTemplate = Omit<CadenceTouch, 'occurredAt' | 'occurredAtInstant' | 'recordedAtInstant'>;

export type CadencePosition =
  | { kind: 'notStarted'; stepKey: string }
  | { kind: 'warmedUp'; stepKey: string }
  | { kind: 'step'; stepKey: string; occurrence: number }
  // The occurrence is the next one to send: the step's sequence touches + 1.
  | { kind: 'forever'; stepKey: string; occurrence: number }
  | { kind: 'awaitingAcceptance'; stepKey: string }
  | { kind: 'sequenceComplete' };

export type CadenceBlockedReason =
  | 'unowned'
  | 'connectionPending'
  | 'noEmailAddress'
  | 'noLinkedinUrl';

export type CadencePositionResult = {
  position: CadencePosition;
  blockedReason?: CadenceBlockedReason;
  inMailAvailable?: boolean;
};

export type OutreachStatus =
  | { state: 'optedOut' }
  | { state: 'dead' }
  | { state: 'bounced' }
  | { state: 'replyOwed'; since: CadenceDate }
  | { state: 'hold'; revisitOn: CadenceDate | null }
  | { state: 'snoozed'; until: CadenceDate }
  | { state: 'awaitingResume'; repliedOn: CadenceDate }
  | { state: 'inConversation'; strikes: number; repliedOn: CadenceDate }
  | { state: 'running'; result: CadencePositionResult };

export type CadenceAction =
  | 'didIt'
  | 'theyAccepted'
  | 'theyReplied'
  | 'sentInMail'
  | 'skipToNextStep'
  | 'iReplied'
  | 'iFollowedUp'
  | 'resumeCadence'
  | 'addEmailAddress'
  | 'somethingElse';

export type CadenceOverflowAction = 'snooze' | 'hold' | 'markDead';

export type CadenceStageChange = {
  stage: CadenceStage;
  change: 'started' | 'advanced' | null;
};

export type CadenceResult = {
  status: OutreachStatus;
  position: CadencePositionResult;
  stepLabel: string;
  positionLabel: string;
  proposedNextActionDate: CadenceDate | null;
  nextActionDate: CadenceDate | null;
  isDue: boolean;
  strikes: number;
  prescribedTouch: string | null;
  actions: CadenceAction[];
};
