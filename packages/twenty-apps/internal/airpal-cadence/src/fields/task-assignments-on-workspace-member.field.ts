import {
  defineField,
  FieldType,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  TASK_ASSIGNEE_OBJECT_UNIVERSAL_IDENTIFIER,
  TASK_ASSIGNEE_WORKSPACE_MEMBER_FIELD_UNIVERSAL_IDENTIFIER,
  WORKSPACE_MEMBER_TASK_ASSIGNMENTS_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier:
    WORKSPACE_MEMBER_TASK_ASSIGNMENTS_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.workspaceMember.universalIdentifier,
  type: FieldType.RELATION,
  name: 'taskAssignments',
  label: 'Task assignments',
  icon: 'IconCheckbox',
  relationTargetObjectMetadataUniversalIdentifier:
    TASK_ASSIGNEE_OBJECT_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier:
    TASK_ASSIGNEE_WORKSPACE_MEMBER_FIELD_UNIVERSAL_IDENTIFIER,
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
  },
});
