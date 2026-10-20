import {
  defineField,
  FieldType,
  NumberDataType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import { PERSON_CADENCE_STRIKES_FIELD_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: PERSON_CADENCE_STRIKES_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.NUMBER,
  name: 'cadenceStrikes',
  label: 'Strikes',
  description:
    'Written by the engine: our unanswered follow-ups since their last reply.',
  icon: 'IconNumber',
  isNullable: false,
  defaultValue: 0,
  universalSettings: { dataType: NumberDataType.INT, decimals: 0 },
  isUIEditable: false,
  isAuditLogged: false,
});
