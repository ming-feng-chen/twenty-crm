import {
  defineField,
  FieldType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import { PERSON_NEXT_ACTION_DATE_OVERRIDE_FIELD_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: PERSON_NEXT_ACTION_DATE_OVERRIDE_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.DATE,
  name: 'nextActionDateOverride',
  label: 'Typed next action date',
  description:
    'Written by the app: a next action date typed by hand. It stands until the next logged touch.',
  icon: 'IconCalendarExclamation',
  isNullable: true,
  isUIEditable: false,
});
