import { defineObject, FieldType, NumberDataType } from 'twenty-sdk/define';

import {
  CADENCE_CHANGE_AFTER_FIELD_UNIVERSAL_IDENTIFIER,
  CADENCE_CHANGE_BEFORE_FIELD_UNIVERSAL_IDENTIFIER,
  CADENCE_CHANGE_CHANGED_AT_FIELD_UNIVERSAL_IDENTIFIER,
  CADENCE_CHANGE_CONTACTS_RECOMPUTED_FIELD_UNIVERSAL_IDENTIFIER,
  CADENCE_CHANGE_CONTACTS_WHOSE_DATE_CHANGED_FIELD_UNIVERSAL_IDENTIFIER,
  CADENCE_CHANGE_OBJECT_UNIVERSAL_IDENTIFIER,
  CADENCE_CHANGE_SUMMARY_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

const WHOLE_NUMBER = { dataType: NumberDataType.INT, decimals: 0 };

// Audit trail of rules changes, written by the app. `changedBy` is a relation
// in src/fields/.
export default defineObject({
  universalIdentifier: CADENCE_CHANGE_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'cadenceChange',
  namePlural: 'cadenceChanges',
  labelSingular: 'Cadence change',
  labelPlural: 'Cadence changes',
  description:
    'Audit record of a cadence rules change: before, after and how many contacts it moved.',
  icon: 'IconHistory',
  isUICreatable: false,
  labelIdentifierFieldMetadataUniversalIdentifier:
    CADENCE_CHANGE_SUMMARY_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: CADENCE_CHANGE_SUMMARY_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'summary',
      label: 'Summary',
      icon: 'IconAbc',
      isUIEditable: false,
    },
    {
      universalIdentifier: CADENCE_CHANGE_CHANGED_AT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.DATE_TIME,
      name: 'changedAt',
      label: 'Changed at',
      icon: 'IconClock',
      isNullable: true,
      isUIEditable: false,
    },
    {
      universalIdentifier: CADENCE_CHANGE_BEFORE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RAW_JSON,
      name: 'before',
      label: 'Before',
      icon: 'IconArrowBackUp',
      isNullable: true,
      isUIEditable: false,
    },
    {
      universalIdentifier: CADENCE_CHANGE_AFTER_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RAW_JSON,
      name: 'after',
      label: 'After',
      icon: 'IconArrowForwardUp',
      isNullable: true,
      isUIEditable: false,
    },
    {
      universalIdentifier:
        CADENCE_CHANGE_CONTACTS_RECOMPUTED_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.NUMBER,
      name: 'contactsRecomputed',
      label: 'Contacts recomputed',
      icon: 'IconUsers',
      isNullable: true,
      isUIEditable: false,
      universalSettings: WHOLE_NUMBER,
    },
    {
      universalIdentifier:
        CADENCE_CHANGE_CONTACTS_WHOSE_DATE_CHANGED_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.NUMBER,
      name: 'contactsWhoseDateChanged',
      label: 'Contacts whose date changed',
      icon: 'IconCalendarDue',
      isNullable: true,
      isUIEditable: false,
      universalSettings: WHOLE_NUMBER,
    },
  ],
});
