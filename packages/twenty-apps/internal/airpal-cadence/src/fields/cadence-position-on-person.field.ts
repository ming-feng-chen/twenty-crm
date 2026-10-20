import {
  defineField,
  FieldType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import { PERSON_CADENCE_POSITION_FIELD_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: PERSON_CADENCE_POSITION_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.TEXT,
  name: 'cadencePosition',
  label: 'Cadence position',
  description:
    'Written by the engine: the step in play, for example Email 3 of 7.',
  icon: 'IconListNumbers',
  isNullable: true,
  isUIEditable: false,
  isAuditLogged: false,
});
