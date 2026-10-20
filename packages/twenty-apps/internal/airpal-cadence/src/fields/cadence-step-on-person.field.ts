import {
  defineField,
  FieldType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import { PERSON_CADENCE_STEP_FIELD_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: PERSON_CADENCE_STEP_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.TEXT,
  name: 'cadenceStep',
  label: 'Step',
  description:
    'Written by the engine: why this contact shows what it shows, e.g. Email 3 of 7 or Reply to them.',
  icon: 'IconStairs',
  isNullable: true,
  isUIEditable: false,
  isAuditLogged: false,
});
