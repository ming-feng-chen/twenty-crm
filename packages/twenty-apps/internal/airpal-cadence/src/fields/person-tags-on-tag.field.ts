import { defineField, FieldType, RelationType } from 'twenty-sdk/define';

import {
  PERSON_TAG_OBJECT_UNIVERSAL_IDENTIFIER,
  PERSON_TAG_TAG_FIELD_UNIVERSAL_IDENTIFIER,
  TAG_OBJECT_UNIVERSAL_IDENTIFIER,
  TAG_PERSON_TAGS_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/tags-identifiers';

export default defineField({
  universalIdentifier: TAG_PERSON_TAGS_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: TAG_OBJECT_UNIVERSAL_IDENTIFIER,
  type: FieldType.RELATION,
  name: 'personTags',
  label: 'Contacts',
  icon: 'IconUser',
  relationTargetObjectMetadataUniversalIdentifier:
    PERSON_TAG_OBJECT_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier:
    PERSON_TAG_TAG_FIELD_UNIVERSAL_IDENTIFIER,
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
  },
});
