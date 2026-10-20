// The outreach cadence engine: a pure function of (contact, touches, config,
// today). No I/O and no clock; port of the predecessor CRM's cadence module.

export {
  CADENCE_OVERFLOW_ACTIONS,
  cadenceActions,
  touchForAction,
} from './actions';
export {
  addBusinessDays,
  addCalendarDays,
  addDuration,
  businessDaysBetween,
  isBusinessDay,
  isWeekend,
  nextBusinessDay,
  toCadenceDate,
  toCivilDate,
} from './business-days';
export { computeCadence } from './compute-cadence';
export { DEFAULT_CADENCE_CONFIG } from './default-cadence-config';
export { formatCadenceDay, positionLabel, stepLabel } from './labels';
export {
  computePosition,
  effectiveSteps,
  isLinkedInPosition,
} from './position';
export { prescribedStep, prescribedTouch } from './prescribed';
export {
  doesEditMoveSchedule,
  isDue,
  proposeNextAction,
  resolveNextActionDate,
} from './schedule';
export { spreadOverWindow } from './spread';
export type { SpreadPlacement } from './spread';
export { stageAfterTouch } from './stage';
export {
  computeOutreachStatus,
  isStoppedState,
  strikesSince,
} from './stops';
export {
  advancesSequence,
  hasBounced,
  isAcceptance,
  isConnectionPending,
  isInMail,
  isOurContact,
  isReply,
  isTouchInFuture,
  sequenceTouches,
  touchesUnderCurrentOwner,
} from './touches';
export type {
  CadenceAction,
  CadenceBlockedReason,
  CadenceBounceRule,
  CadenceCalendar,
  CadenceConfig,
  CadenceConnectionRequestRule,
  CadenceContact,
  CadenceDate,
  CadenceDateInput,
  CadenceDuration,
  CadenceHealth,
  CadenceOverflowAction,
  CadencePosition,
  CadencePositionResult,
  CadenceRequiredData,
  CadenceResult,
  CadenceStage,
  CadenceStageChange,
  CadenceStepDefinition,
  CadenceStepGate,
  CadenceTouch,
  CadenceTouchDirection,
  CadenceTouchTemplate,
  CadenceWhenDataMissing,
  GapUnit,
  OutreachStatus,
} from './types';
export {
  assertValidCadenceConfig,
  validateCadenceConfig,
} from './validate-cadence-config';
