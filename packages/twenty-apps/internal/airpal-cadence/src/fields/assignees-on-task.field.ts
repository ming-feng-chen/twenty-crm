import {
  defineField,
  FieldType,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  TASK_ASSIGNEE_OBJECT_UNIVERSAL_IDENTIFIER,
  TASK_ASSIGNEE_TASK_FIELD_UNIVERSAL_IDENTIFIER,
  TASK_ASSIGNEE_WORKSPACE_MEMBER_FIELD_UNIVERSAL_IDENTIFIER,
  TASK_ASSIGNEES_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// Replaces the standard single `assignee`, which the switch-over script
// deactivates. The junction target makes Twenty show and pick members directly.
export default defineField({
  universalIdentifier: TASK_ASSIGNEES_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.task.universalIdentifier,
  type: FieldType.RELATION,
  name: 'assignees',
  label: 'Assignee',
  description:
    'The members this task is assigned to. Assign or unassign someone by creating or deleting a Task assignee record.',
  icon: 'IconUserCircle',
  relationTargetObjectMetadataUniversalIdentifier:
    TASK_ASSIGNEE_OBJECT_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier:
    TASK_ASSIGNEE_TASK_FIELD_UNIVERSAL_IDENTIFIER,
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
    junctionTargetFieldUniversalIdentifier:
      TASK_ASSIGNEE_WORKSPACE_MEMBER_FIELD_UNIVERSAL_IDENTIFIER,
  },
});
