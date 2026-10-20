import {
  defineField,
  FieldType,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  CADENCE_CHANGE_CHANGED_BY_FIELD_UNIVERSAL_IDENTIFIER,
  CADENCE_CHANGE_OBJECT_UNIVERSAL_IDENTIFIER,
  WORKSPACE_MEMBER_CADENCE_CHANGES_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: WORKSPACE_MEMBER_CADENCE_CHANGES_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.workspaceMember.universalIdentifier,
  type: FieldType.RELATION,
  name: 'cadenceChanges',
  label: 'Cadence changes',
  icon: 'IconHistory',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier:
    CADENCE_CHANGE_OBJECT_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier:
    CADENCE_CHANGE_CHANGED_BY_FIELD_UNIVERSAL_IDENTIFIER,
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
  },
});
