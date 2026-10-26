import {
  defineField,
  FieldType,
  OnDeleteAction,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  PERSON_TAG_OBJECT_UNIVERSAL_IDENTIFIER,
  PERSON_TAG_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
  PERSON_TAGS_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/tags-identifiers';

export default defineField({
  universalIdentifier: PERSON_TAG_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: PERSON_TAG_OBJECT_UNIVERSAL_IDENTIFIER,
  type: FieldType.RELATION,
  name: 'person',
  label: 'Contact',
  icon: 'IconUser',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  relationTargetFieldMetadataUniversalIdentifier:
    PERSON_TAGS_FIELD_UNIVERSAL_IDENTIFIER,
  universalSettings: {
    relationType: RelationType.MANY_TO_ONE,
    onDelete: OnDeleteAction.CASCADE,
    joinColumnName: 'personId',
  },
});
