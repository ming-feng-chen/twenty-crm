import {
  defineField,
  FieldType,
  OnDeleteAction,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  CADENCE_CHANGE_CHANGED_BY_FIELD_UNIVERSAL_IDENTIFIER,
  CADENCE_CHANGE_OBJECT_UNIVERSAL_IDENTIFIER,
  WORKSPACE_MEMBER_CADENCE_CHANGES_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// Null when nobody can be identified, e.g. a change reconciled by the cron.
export default defineField({
  universalIdentifier: CADENCE_CHANGE_CHANGED_BY_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: CADENCE_CHANGE_OBJECT_UNIVERSAL_IDENTIFIER,
  type: FieldType.RELATION,
  name: 'changedBy',
  label: 'Changed by',
  icon: 'IconUserCircle',
  isNullable: true,
  isUIEditable: false,
  relationTargetObjectMetadataUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.workspaceMember.universalIdentifier,
  relationTargetFieldMetadataUniversalIdentifier:
    WORKSPACE_MEMBER_CADENCE_CHANGES_FIELD_UNIVERSAL_IDENTIFIER,
  universalSettings: {
    relationType: RelationType.MANY_TO_ONE,
    onDelete: OnDeleteAction.SET_NULL,
    joinColumnName: 'changedById',
  },
});
