import {
  defineField,
  FieldType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import { PERSON_NEXT_ACTION_DATE_FIELD_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: PERSON_NEXT_ACTION_DATE_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.DATE,
  name: 'nextActionDate',
  label: 'Next action date',
  description:
    'When the next action is due. The engine sets it; a date typed by hand wins until the next logged touch.',
  icon: 'IconCalendarDue',
  isNullable: true,
});
