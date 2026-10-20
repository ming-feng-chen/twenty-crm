import {
  defineField,
  FieldType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import { PERSON_LINKEDIN_CONNECTION_NOTE_FIELD_UNIVERSAL_IDENTIFIER } from 'src/constants/partners-airports-identifiers';

export default defineField({
  universalIdentifier:
    PERSON_LINKEDIN_CONNECTION_NOTE_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.TEXT,
  name: 'linkedinConnectionNote',
  label: 'LinkedIn connection note',
  description: 'The note sent, or to send, with the LinkedIn connection request.',
  icon: 'IconBrandLinkedin',
  isNullable: true,
});
