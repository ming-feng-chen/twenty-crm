import { defineObject, FieldType } from 'twenty-sdk/define';

import {
  SUPPRESSION_EMAIL_FIELD_UNIVERSAL_IDENTIFIER,
  SUPPRESSION_LINKEDIN_URL_FIELD_UNIVERSAL_IDENTIFIER,
  SUPPRESSION_OBJECT_UNIVERSAL_IDENTIFIER,
  SUPPRESSION_REASON_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// Permanent: a person matching an entry (normalised email or LinkedIn URL) is
// opted out whatever later edits say. Written by the app when a person is
// opted out because they asked us to stop. `createdBy` is the standard field.
export default defineObject({
  universalIdentifier: SUPPRESSION_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'suppression',
  namePlural: 'suppressions',
  labelSingular: 'Suppression',
  labelPlural: 'Suppressions',
  description:
    'Permanent do-not-contact list. Entries are created when someone asks us to stop and cannot be edited or removed by members.',
  icon: 'IconBan',
  isUICreatable: false,
  labelIdentifierFieldMetadataUniversalIdentifier:
    SUPPRESSION_EMAIL_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: SUPPRESSION_EMAIL_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'email',
      label: 'Email',
      description: 'Lower-case, trimmed.',
      icon: 'IconMail',
      isNullable: true,
      isUIEditable: false,
    },
    {
      universalIdentifier: SUPPRESSION_LINKEDIN_URL_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'linkedinUrl',
      label: 'LinkedIn URL',
      description:
        'Normalised: lower-case, without protocol, "www." or a trailing slash.',
      icon: 'IconBrandLinkedin',
      isNullable: true,
      isUIEditable: false,
    },
    {
      universalIdentifier: SUPPRESSION_REASON_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'reason',
      label: 'Reason',
      icon: 'IconFileText',
      isNullable: true,
      isUIEditable: false,
    },
  ],
});
