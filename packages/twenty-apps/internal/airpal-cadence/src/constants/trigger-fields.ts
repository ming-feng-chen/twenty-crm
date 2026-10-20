// The updatedFields each database trigger listens to. Engine-written fields
// are never listed, which is half of what keeps the triggers from looping; the
// other half is that the engine writes only values that changed.

// SPEC §3: only the inputs people write. An engine write that also changes a
// listed field (nextActionDate, cadenceStage) always carries cadenceActions
// and is recognised and skipped. cadenceResumedAt is an engine input that the
// Resume cadence action writes, so it is listed too.
export const PERSON_INPUT_FIELDS = [
  'cadenceOwnerId',
  'cadenceStage',
  'cadenceHealth',
  'snoozeUntil',
  'revisitDate',
  'optedOut',
  'optOutReason',
  'nextActionDate',
  'emails',
  'linkedinLink',
  'cadenceResumedAt',
];

// Updates to a touch's summary or note change nothing the engine reads.
export const TOUCH_INPUT_FIELDS = [
  'person',
  'personId',
  'channel',
  'direction',
  'outcome',
  'occurredOn',
  'occurredAt',
  'source',
];

// The rule fields only; lastValidRules, rulesErrors and rulesSaveLockedUntil
// are written by the app and must not re-trigger.
export const CADENCE_RULE_FIELDS = [
  'touchChannels',
  'name',
  'timeZone',
  'skipWeekends',
  'strikeSilenceGapAmount',
  'strikeSilenceGapUnit',
  'strikeLimit',
  'acceptanceTimeoutAmount',
  'acceptanceTimeoutUnit',
  'nonAdvancingChannels',
  'inMailChannel',
  'isDefault',
];

export const CADENCE_STEP_RULE_FIELDS = [
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
  'cadence',
  'cadenceId',
];
