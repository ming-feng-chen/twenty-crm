import { defineObject, FieldType, NumberDataType } from 'twenty-sdk/define';

import { FIELD_OPTIONS } from 'src/constants/cadence-values';
import {
  CADENCE_STEP_CHANNEL_FIELD_UNIVERSAL_IDENTIFIER,
  CADENCE_STEP_GAP_BEFORE_AMOUNT_FIELD_UNIVERSAL_IDENTIFIER,
  CADENCE_STEP_GAP_BEFORE_UNIT_FIELD_UNIVERSAL_IDENTIFIER,
  CADENCE_STEP_GATE_FIELD_UNIVERSAL_IDENTIFIER,
  CADENCE_STEP_KEY_FIELD_UNIVERSAL_IDENTIFIER,
  CADENCE_STEP_LABEL_FIELD_UNIVERSAL_IDENTIFIER,
  CADENCE_STEP_OBJECT_UNIVERSAL_IDENTIFIER,
  CADENCE_STEP_OCCURRENCE_NOUN_FIELD_UNIVERSAL_IDENTIFIER,
  CADENCE_STEP_REPEAT_FIELD_UNIVERSAL_IDENTIFIER,
  CADENCE_STEP_REQUIRED_DATA_FIELD_UNIVERSAL_IDENTIFIER,
  CADENCE_STEP_WHEN_DATA_MISSING_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

const WHOLE_NUMBER = { dataType: NumberDataType.INT, decimals: 0 };

// One step of a cadence. Steps run in ascending `position`, the ordering field
// every Twenty record already has. The `cadence` relation is in src/fields/.
export default defineObject({
  universalIdentifier: CADENCE_STEP_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'cadenceStep',
  namePlural: 'cadenceSteps',
  labelSingular: 'Cadence step',
  labelPlural: 'Cadence steps',
  description:
    'One step of a cadence, in position order. Admins edit them on the Cadence rules settings page.',
  icon: 'IconStairs',
  labelIdentifierFieldMetadataUniversalIdentifier:
    CADENCE_STEP_LABEL_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: CADENCE_STEP_LABEL_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'label',
      label: 'Label',
      description: 'Shown in the Step column, e.g. "Email" renders "Email 3 of 7".',
      icon: 'IconAbc',
    },
    {
      universalIdentifier: CADENCE_STEP_KEY_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'key',
      label: 'Key',
      description: 'Stable identifier of the step; never reuse one for a different step.',
      icon: 'IconKey',
    },
    // Text, not a SELECT: it holds a value of the touch's Channel field, whose
    // options admins may extend. The app validates it against that field's
    // live options, so a channel added there needs no change here.
    {
      universalIdentifier: CADENCE_STEP_CHANNEL_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'channel',
      label: 'Channel',
      description:
        "A value of the touch's Channel field, e.g. EMAIL. Edit it on the Cadence rules page.",
      icon: 'IconMessages',
      isNullable: true,
    },
    {
      universalIdentifier: CADENCE_STEP_REPEAT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.NUMBER,
      name: 'repeat',
      label: 'Repeat',
      description: 'How many times the step happens. Empty means for ever (last step only).',
      icon: 'IconRepeat',
      isNullable: true,
      universalSettings: WHOLE_NUMBER,
    },
    {
      universalIdentifier:
        CADENCE_STEP_GAP_BEFORE_AMOUNT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.NUMBER,
      name: 'gapBeforeAmount',
      label: 'Gap before',
      description: 'The wait, from the last sequence touch, before this step is due.',
      icon: 'IconHourglass',
      isNullable: true,
      universalSettings: WHOLE_NUMBER,
    },
    {
      universalIdentifier:
        CADENCE_STEP_GAP_BEFORE_UNIT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'gapBeforeUnit',
      label: 'Gap before unit',
      icon: 'IconCalendarStats',
      isNullable: true,
      options: FIELD_OPTIONS.gapUnit,
    },
    {
      universalIdentifier:
        CADENCE_STEP_OCCURRENCE_NOUN_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'occurrenceNoun',
      label: 'Occurrence noun',
      description:
        'Forever steps only: what one occurrence is called, so "email" renders "Drip, email 3".',
      icon: 'IconTag',
      isNullable: true,
    },
    {
      universalIdentifier:
        CADENCE_STEP_REQUIRED_DATA_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'requiredData',
      label: 'Requires',
      icon: 'IconDatabase',
      isNullable: true,
      options: FIELD_OPTIONS.requiredData,
    },
    {
      universalIdentifier:
        CADENCE_STEP_WHEN_DATA_MISSING_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'whenDataMissing',
      label: 'When data is missing',
      icon: 'IconAlertCircle',
      isNullable: true,
      options: FIELD_OPTIONS.whenDataMissing,
    },
    {
      universalIdentifier: CADENCE_STEP_GATE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'gate',
      label: 'Waits for',
      icon: 'IconLockOpen',
      isNullable: true,
      options: FIELD_OPTIONS.stepGate,
    },
  ],
});
