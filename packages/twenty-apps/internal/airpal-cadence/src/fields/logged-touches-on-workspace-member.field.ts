import {
  defineField,
  FieldType,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  TOUCH_LOGGED_BY_FIELD_UNIVERSAL_IDENTIFIER,
  TOUCH_OBJECT_UNIVERSAL_IDENTIFIER,
  WORKSPACE_MEMBER_LOGGED_TOUCHES_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier:
    WORKSPACE_MEMBER_LOGGED_TOUCHES_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.workspaceMember.universalIdentifier,
  type: FieldType.RELATION,
  name: 'loggedTouches',
  label: 'Logged touches',
  icon: 'IconHandClick',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier:
    TOUCH_OBJECT_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier:
    TOUCH_LOGGED_BY_FIELD_UNIVERSAL_IDENTIFIER,
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
  },
});
