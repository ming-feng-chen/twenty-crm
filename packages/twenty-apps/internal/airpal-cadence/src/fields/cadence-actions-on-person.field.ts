import {
  defineField,
  FieldType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import { PERSON_CADENCE_ACTIONS_FIELD_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: PERSON_CADENCE_ACTIONS_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.RAW_JSON,
  name: 'cadenceActions',
  label: 'Cadence actions',
  description:
    'Written by the engine: the buttons My Day offers and the touch each one logs.',
  icon: 'IconClick',
  isNullable: true,
  isUIEditable: false,
  isAuditLogged: false,
});
