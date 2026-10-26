import {
  defineField,
  FieldType,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  PERSON_TAG_OBJECT_UNIVERSAL_IDENTIFIER,
  PERSON_TAG_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
  PERSON_TAG_TAG_FIELD_UNIVERSAL_IDENTIFIER,
  PERSON_TAGS_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/tags-identifiers';

// The junction target makes Twenty show and pick tags directly.
export default defineField({
  universalIdentifier: PERSON_TAGS_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.RELATION,
  name: 'tags',
  label: 'Tags',
  description:
    'The tags this contact has. Tag or untag them by creating or deleting a Contact tag record.',
  icon: 'IconTag',
  relationTargetObjectMetadataUniversalIdentifier:
    PERSON_TAG_OBJECT_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier:
    PERSON_TAG_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
    junctionTargetFieldUniversalIdentifier:
      PERSON_TAG_TAG_FIELD_UNIVERSAL_IDENTIFIER,
  },
});
