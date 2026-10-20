import {
  defineField,
  FieldType,
  OnDeleteAction,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  TASK_ASSIGNEE_OBJECT_UNIVERSAL_IDENTIFIER,
  TASK_ASSIGNEE_TASK_FIELD_UNIVERSAL_IDENTIFIER,
  TASK_ASSIGNEES_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: TASK_ASSIGNEE_TASK_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: TASK_ASSIGNEE_OBJECT_UNIVERSAL_IDENTIFIER,
  type: FieldType.RELATION,
  name: 'task',
  label: 'Task',
  icon: 'IconCheckbox',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.task.universalIdentifier,
  relationTargetFieldMetadataUniversalIdentifier:
    TASK_ASSIGNEES_FIELD_UNIVERSAL_IDENTIFIER,
  universalSettings: {
    relationType: RelationType.MANY_TO_ONE,
    onDelete: OnDeleteAction.CASCADE,
    joinColumnName: 'taskId',
  },
});
