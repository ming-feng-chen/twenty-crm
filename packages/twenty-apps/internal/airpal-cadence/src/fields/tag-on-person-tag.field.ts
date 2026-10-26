import {
  defineField,
  FieldType,
  OnDeleteAction,
  RelationType,
} from 'twenty-sdk/define';

import {
  PERSON_TAG_OBJECT_UNIVERSAL_IDENTIFIER,
  PERSON_TAG_TAG_FIELD_UNIVERSAL_IDENTIFIER,
  TAG_OBJECT_UNIVERSAL_IDENTIFIER,
  TAG_PERSON_TAGS_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/tags-identifiers';

// Deleting a tag removes it from every contact.
export default defineField({
  universalIdentifier: PERSON_TAG_TAG_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: PERSON_TAG_OBJECT_UNIVERSAL_IDENTIFIER,
  type: FieldType.RELATION,
  name: 'tag',
  label: 'Tag',
  icon: 'IconTag',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier:
    TAG_OBJECT_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier:
    TAG_PERSON_TAGS_FIELD_UNIVERSAL_IDENTIFIER,
  universalSettings: {
    relationType: RelationType.MANY_TO_ONE,
    onDelete: OnDeleteAction.CASCADE,
    joinColumnName: 'tagId',
  },
});
