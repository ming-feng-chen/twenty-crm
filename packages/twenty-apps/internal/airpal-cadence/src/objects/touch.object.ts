import { defineObject, FieldType } from 'twenty-sdk/define';

import {
  FIELD_OPTIONS,
  quotedSelectDefault,
} from 'src/constants/cadence-values';
import {
  LEGACY_TOUCH_CHANNEL_FIELD_UNIVERSAL_IDENTIFIER,
  TOUCH_DIRECTION_FIELD_UNIVERSAL_IDENTIFIER,
  TOUCH_EXTERNAL_ID_FIELD_UNIVERSAL_IDENTIFIER,
  TOUCH_NAME_FIELD_UNIVERSAL_IDENTIFIER,
  TOUCH_NOTE_FIELD_UNIVERSAL_IDENTIFIER,
  TOUCH_OBJECT_UNIVERSAL_IDENTIFIER,
  TOUCH_OCCURRED_ON_FIELD_UNIVERSAL_IDENTIFIER,
  TOUCH_OUTCOME_FIELD_UNIVERSAL_IDENTIFIER,
  TOUCH_SOURCE_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// `person` and `loggedBy` are relation fields defined in src/fields/.
export default defineObject({
  universalIdentifier: TOUCH_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'touch',
  namePlural: 'touches',
  labelSingular: 'Touch',
  labelPlural: 'Touches',
  description:
    'One outreach interaction with a person, logged by a member or synced from Gmail or Calendar.',
  icon: 'IconHandClick',
  labelIdentifierFieldMetadataUniversalIdentifier:
    TOUCH_NAME_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: TOUCH_NAME_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'name',
      label: 'Summary',
      description: 'Display label, for example "Email 3 of 7 — Aditi Rajvanshi".',
      icon: 'IconAbc',
    },
    {
      // Nullable in the database so a half-filled native form can be saved;
      // the engine ignores a touch without a channel and logs a warning.
      universalIdentifier: LEGACY_TOUCH_CHANNEL_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'legacyChannel',
      label: 'Legacy channel',
      description: 'Preserved during migration to text channels. Use Channel for new touches.',
      icon: 'IconMessages',
      isNullable: true,
      isUIEditable: false,
      options: FIELD_OPTIONS.touchChannel,
    },
    {
      universalIdentifier: TOUCH_DIRECTION_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'direction',
      label: 'Direction',
      icon: 'IconArrowsExchange',
      isNullable: false,
      defaultValue: quotedSelectDefault('OUTBOUND'),
      options: FIELD_OPTIONS.touchDirection,
    },
    {
      universalIdentifier: TOUCH_OUTCOME_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'outcome',
      label: 'Outcome',
      icon: 'IconFlag',
      isNullable: true,
      options: FIELD_OPTIONS.touchOutcome,
    },
    {
      // The civil date in the cadence time zone. Nullable in the database for
      // the same reason as channel; a touch without a date is ignored.
      universalIdentifier: TOUCH_OCCURRED_ON_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.DATE,
      name: 'occurredOn',
      label: 'Occurred on',
      description:
        'The day it happened, in the cadence time zone. Never in the future.',
      icon: 'IconCalendar',
      isNullable: true,
    },
    {
      universalIdentifier: TOUCH_SOURCE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'source',
      label: 'Source',
      icon: 'IconPlug',
      isNullable: false,
      defaultValue: quotedSelectDefault('MANUAL'),
      options: FIELD_OPTIONS.touchSource,
    },
    {
      universalIdentifier: TOUCH_EXTERNAL_ID_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'externalId',
      label: 'External id',
      description:
        'Message or calendar event id for synced touches; the dedupe key.',
      icon: 'IconId',
      isNullable: true,
    },
    {
      universalIdentifier: TOUCH_NOTE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'note',
      label: 'Note',
      description: 'Anything worth remembering about this touch.',
      icon: 'IconNotes',
      isNullable: true,
    },
  ],
});
