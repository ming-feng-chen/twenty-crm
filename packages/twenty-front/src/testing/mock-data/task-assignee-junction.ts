import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';
import { type FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { FieldMetadataType, RelationType } from '~/generated-metadata/graphql';

const TASK = {
  id: 'task-object-id',
  nameSingular: 'task',
  namePlural: 'tasks',
};
const TASK_ASSIGNEE = {
  id: 'task-assignee-object-id',
  nameSingular: 'taskAssignee',
  namePlural: 'taskAssignees',
};
const WORKSPACE_MEMBER = {
  id: 'workspace-member-object-id',
  nameSingular: 'workspaceMember',
  namePlural: 'workspaceMembers',
};
const PERSON = {
  id: 'person-object-id',
  nameSingular: 'person',
  namePlural: 'people',
};

export const TASK_ASSIGNEES_FIELD_ID = 'task-assignees-field-id';
export const TASK_ASSIGNEE_TASK_FIELD_ID = 'task-assignee-task-field-id';
export const TASK_ASSIGNEE_WORKSPACE_MEMBER_FIELD_ID =
  'task-assignee-workspace-member-field-id';

const buildField = (field: Partial<FieldMetadataItem>): FieldMetadataItem =>
  ({
    isActive: true,
    label: field.name,
    ...field,
  }) as FieldMetadataItem;

const buildRelation = ({
  type,
  source,
  sourceField,
  target,
  targetField,
}: {
  type: RelationType;
  source: typeof TASK;
  sourceField: { id: string; name: string };
  target: typeof TASK;
  targetField: { id: string; name: string };
}): FieldMetadataItem['relation'] => ({
  type,
  sourceObjectMetadata: source,
  sourceFieldMetadata: sourceField,
  targetObjectMetadata: target,
  targetFieldMetadata: targetField,
});

const assigneesField = buildField({
  id: TASK_ASSIGNEES_FIELD_ID,
  name: 'assignees',
  type: FieldMetadataType.RELATION,
  settings: {
    relationType: RelationType.ONE_TO_MANY,
    junctionTargetFieldId: TASK_ASSIGNEE_WORKSPACE_MEMBER_FIELD_ID,
  },
  relation: buildRelation({
    type: RelationType.ONE_TO_MANY,
    source: TASK,
    sourceField: { id: TASK_ASSIGNEES_FIELD_ID, name: 'assignees' },
    target: TASK_ASSIGNEE,
    targetField: { id: TASK_ASSIGNEE_TASK_FIELD_ID, name: 'task' },
  }),
});

const buildLegacyAssigneeField = (isActive: boolean) =>
  buildField({
    id: 'task-assignee-legacy-field-id',
    name: 'assignee',
    type: FieldMetadataType.RELATION,
    isActive,
    settings: { relationType: RelationType.MANY_TO_ONE },
    relation: buildRelation({
      type: RelationType.MANY_TO_ONE,
      source: TASK,
      sourceField: { id: 'task-assignee-legacy-field-id', name: 'assignee' },
      target: WORKSPACE_MEMBER,
      targetField: { id: 'workspace-member-assigned-tasks-id', name: 'tasks' },
    }),
  });

const taskAssigneeTaskField = buildField({
  id: TASK_ASSIGNEE_TASK_FIELD_ID,
  name: 'task',
  type: FieldMetadataType.RELATION,
  settings: { relationType: RelationType.MANY_TO_ONE },
  relation: buildRelation({
    type: RelationType.MANY_TO_ONE,
    source: TASK_ASSIGNEE,
    sourceField: { id: TASK_ASSIGNEE_TASK_FIELD_ID, name: 'task' },
    target: TASK,
    targetField: { id: TASK_ASSIGNEES_FIELD_ID, name: 'assignees' },
  }),
});

const taskAssigneeWorkspaceMemberField = buildField({
  id: TASK_ASSIGNEE_WORKSPACE_MEMBER_FIELD_ID,
  name: 'workspaceMember',
  type: FieldMetadataType.RELATION,
  settings: { relationType: RelationType.MANY_TO_ONE },
  relation: buildRelation({
    type: RelationType.MANY_TO_ONE,
    source: TASK_ASSIGNEE,
    sourceField: {
      id: TASK_ASSIGNEE_WORKSPACE_MEMBER_FIELD_ID,
      name: 'workspaceMember',
    },
    target: WORKSPACE_MEMBER,
    targetField: {
      id: 'workspace-member-task-assignments-id',
      name: 'taskAssignments',
    },
  }),
});

export const getTaskAssigneeJunctionObjectMetadataItems = ({
  hasAssigneesJunction = true,
  isLegacyAssigneeActive = false,
  personFieldNames = ['cadenceDue', 'cadenceOwner'],
}: {
  hasAssigneesJunction?: boolean;
  isLegacyAssigneeActive?: boolean;
  personFieldNames?: string[];
} = {}): EnrichedObjectMetadataItem[] =>
  [
    {
      ...TASK,
      fields: [
        ...(hasAssigneesJunction ? [assigneesField] : []),
        buildLegacyAssigneeField(isLegacyAssigneeActive),
        buildField({
          id: 'task-status-field-id',
          name: 'status',
          type: FieldMetadataType.SELECT,
        }),
      ],
    },
    {
      ...TASK_ASSIGNEE,
      fields: [taskAssigneeTaskField, taskAssigneeWorkspaceMemberField],
    },
    { ...WORKSPACE_MEMBER, fields: [] },
    {
      ...PERSON,
      fields: personFieldNames.map((name) =>
        buildField({ id: `person-${name}-field-id`, name }),
      ),
    },
  ] as EnrichedObjectMetadataItem[];
