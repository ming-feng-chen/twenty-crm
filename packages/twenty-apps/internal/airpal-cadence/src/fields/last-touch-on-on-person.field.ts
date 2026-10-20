import {
  defineField,
  FieldType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import { PERSON_LAST_TOUCH_ON_FIELD_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: PERSON_LAST_TOUCH_ON_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.DATE,
  name: 'lastTouchOn',
  label: 'Last touch',
  description:
    'Written by the engine: the day of the most recent touch of any kind, synced ones included. Deleted and future-dated touches do not count.',
  icon: 'IconHistory',
  isNullable: true,
  isUIEditable: false,
  isAuditLogged: false,
});
