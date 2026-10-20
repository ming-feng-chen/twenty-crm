import {
  defineField,
  FieldType,
  OnDeleteAction,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  TASK_ASSIGNEE_OBJECT_UNIVERSAL_IDENTIFIER,
  TASK_ASSIGNEE_WORKSPACE_MEMBER_FIELD_UNIVERSAL_IDENTIFIER,
  WORKSPACE_MEMBER_TASK_ASSIGNMENTS_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// Removing someone from the workspace hard-deletes their member row, so their
// assignments go with it rather than lingering as blank assignees.
export default defineField({
  universalIdentifier: TASK_ASSIGNEE_WORKSPACE_MEMBER_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: TASK_ASSIGNEE_OBJECT_UNIVERSAL_IDENTIFIER,
  type: FieldType.RELATION,
  name: 'workspaceMember',
  label: 'Member',
  icon: 'IconUserCircle',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.workspaceMember.universalIdentifier,
  relationTargetFieldMetadataUniversalIdentifier:
    WORKSPACE_MEMBER_TASK_ASSIGNMENTS_FIELD_UNIVERSAL_IDENTIFIER,
  universalSettings: {
    relationType: RelationType.MANY_TO_ONE,
    onDelete: OnDeleteAction.CASCADE,
    joinColumnName: 'workspaceMemberId',
  },
});
