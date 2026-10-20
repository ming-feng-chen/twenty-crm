import {
  defineField,
  FieldType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import { PERSON_CADENCE_OWNER_SINCE_FIELD_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: PERSON_CADENCE_OWNER_SINCE_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.DATE,
  name: 'cadenceOwnerSince',
  label: 'Cadence owner since',
  description:
    'Set by a start-fresh handover: only touches on or after this day count for the current owner.',
  icon: 'IconCalendarUser',
  isNullable: true,
  isUIEditable: false,
});
