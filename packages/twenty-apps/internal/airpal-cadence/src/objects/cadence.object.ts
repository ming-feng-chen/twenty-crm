import { defineObject, FieldType, NumberDataType } from 'twenty-sdk/define';

import {
  DEFAULT_IN_MAIL_CHANNEL_VALUE,
  FIELD_OPTIONS,
} from 'src/constants/cadence-values';
import {
  CADENCE_ACCEPTANCE_TIMEOUT_AMOUNT_FIELD_UNIVERSAL_IDENTIFIER,
  CADENCE_IN_MAIL_CHANNEL_FIELD_UNIVERSAL_IDENTIFIER,
  CADENCE_ACCEPTANCE_TIMEOUT_UNIT_FIELD_UNIVERSAL_IDENTIFIER,
  CADENCE_IS_DEFAULT_FIELD_UNIVERSAL_IDENTIFIER,
  CADENCE_LAST_VALID_RULES_FIELD_UNIVERSAL_IDENTIFIER,
  CADENCE_NAME_FIELD_UNIVERSAL_IDENTIFIER,
  CADENCE_NON_ADVANCING_CHANNELS_FIELD_UNIVERSAL_IDENTIFIER,
  CADENCE_OBJECT_UNIVERSAL_IDENTIFIER,
  CADENCE_RULES_ERRORS_FIELD_UNIVERSAL_IDENTIFIER,
  CADENCE_RULES_SAVE_LOCKED_UNTIL_FIELD_UNIVERSAL_IDENTIFIER,
  CADENCE_SKIP_WEEKENDS_FIELD_UNIVERSAL_IDENTIFIER,
  CADENCE_STRIKE_LIMIT_FIELD_UNIVERSAL_IDENTIFIER,
  CADENCE_STRIKE_SILENCE_GAP_AMOUNT_FIELD_UNIVERSAL_IDENTIFIER,
  CADENCE_STRIKE_SILENCE_GAP_UNIT_FIELD_UNIVERSAL_IDENTIFIER,
  CADENCE_TIME_ZONE_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

const WHOLE_NUMBER = { dataType: NumberDataType.INT, decimals: 0 };

// One record now; the model allows more later (SPEC §1 Q4). The `steps`
// relation is defined in src/fields/. The last three fields are written by the
// app only: the snapshot the engine runs on, and the state of a rules save.
export default defineObject({
  universalIdentifier: CADENCE_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'cadence',
  namePlural: 'cadences',
  labelSingular: 'Cadence',
  labelPlural: 'Cadences',
  description:
    'Outreach cadence settings. Admins edit them on the Cadence rules settings page.',
  icon: 'IconRoute',
  labelIdentifierFieldMetadataUniversalIdentifier:
    CADENCE_NAME_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: CADENCE_NAME_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'name',
      label: 'Name',
      icon: 'IconAbc',
    },
    {
      universalIdentifier: CADENCE_TIME_ZONE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'timeZone',
      label: 'Time zone',
      description: 'IANA time zone that defines "today", e.g. Europe/London.',
      icon: 'IconWorld',
      isNullable: false,
      defaultValue: "'Europe/London'",
    },
    {
      universalIdentifier: CADENCE_SKIP_WEEKENDS_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.BOOLEAN,
      name: 'skipWeekends',
      label: 'Skip weekends',
      icon: 'IconCalendarOff',
      isNullable: false,
      defaultValue: true,
    },
    {
      universalIdentifier:
        CADENCE_STRIKE_SILENCE_GAP_AMOUNT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.NUMBER,
      name: 'strikeSilenceGapAmount',
      label: 'Strike silence gap',
      description: 'How long one of our messages goes unanswered before it is a strike.',
      icon: 'IconHourglass',
      isNullable: true,
      universalSettings: WHOLE_NUMBER,
    },
    {
      universalIdentifier:
        CADENCE_STRIKE_SILENCE_GAP_UNIT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'strikeSilenceGapUnit',
      label: 'Strike silence gap unit',
      icon: 'IconCalendarStats',
      isNullable: true,
      options: FIELD_OPTIONS.gapUnit,
    },
    {
      universalIdentifier: CADENCE_STRIKE_LIMIT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.NUMBER,
      name: 'strikeLimit',
      label: 'Strike limit',
      description: 'Unanswered follow-ups after a reply before the cadence waits for a resume.',
      icon: 'IconNumber',
      isNullable: true,
      universalSettings: WHOLE_NUMBER,
    },
    {
      universalIdentifier:
        CADENCE_ACCEPTANCE_TIMEOUT_AMOUNT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.NUMBER,
      name: 'acceptanceTimeoutAmount',
      label: 'Acceptance timeout',
      description: 'How long to wait for a connection to be accepted before offering InMail.',
      icon: 'IconHourglass',
      isNullable: true,
      universalSettings: WHOLE_NUMBER,
    },
    {
      universalIdentifier:
        CADENCE_ACCEPTANCE_TIMEOUT_UNIT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'acceptanceTimeoutUnit',
      label: 'Acceptance timeout unit',
      icon: 'IconCalendarStats',
      isNullable: true,
      options: FIELD_OPTIONS.gapUnit,
    },
    // Text values of the touch's Channel field, like cadenceStep.channel, so
    // a channel an admin adds there can be listed here too.
    {
      universalIdentifier:
        CADENCE_NON_ADVANCING_CHANNELS_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.ARRAY,
      name: 'nonAdvancingChannels',
      label: 'Non-advancing channels',
      description:
        "Values of the touch's Channel field. Touches on them are logged but never advance the sequence; inbound ones are not replies.",
      icon: 'IconEyeOff',
      isNullable: true,
    },
    {
      universalIdentifier: CADENCE_IN_MAIL_CHANNEL_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'inMailChannel',
      label: 'InMail channel',
      description:
        'The value of the touch\'s Channel field that "Sent InMail" logs. No step may use it.',
      icon: 'IconMail',
      isNullable: true,
      // Quoted, as Twenty stores a text default (see timeZone).
      defaultValue: `'${DEFAULT_IN_MAIL_CHANNEL_VALUE}'`,
    },
    {
      universalIdentifier: CADENCE_IS_DEFAULT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.BOOLEAN,
      name: 'isDefault',
      label: 'Default cadence',
      icon: 'IconStar',
      isNullable: false,
      defaultValue: false,
    },
    {
      universalIdentifier: CADENCE_LAST_VALID_RULES_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RAW_JSON,
      name: 'lastValidRules',
      label: 'Last valid rules',
      description:
        'Written by the app: the rules the engine runs on. An invalid edit never replaces them.',
      icon: 'IconShieldCheck',
      isNullable: true,
      isUIEditable: false,
    },
    {
      universalIdentifier: CADENCE_RULES_ERRORS_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RAW_JSON,
      name: 'rulesErrors',
      label: 'Rules errors',
      description:
        'Written by the app: why the stored rules are not in use. Empty when they are.',
      icon: 'IconAlertTriangle',
      isNullable: true,
      isUIEditable: false,
    },
    {
      universalIdentifier:
        CADENCE_RULES_SAVE_LOCKED_UNTIL_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.DATE_TIME,
      name: 'rulesSaveLockedUntil',
      label: 'Rules save in progress until',
      description:
        'Written by the app while it saves several rule records at once.',
      icon: 'IconLock',
      isNullable: true,
      isUIEditable: false,
    },
  ],
});
