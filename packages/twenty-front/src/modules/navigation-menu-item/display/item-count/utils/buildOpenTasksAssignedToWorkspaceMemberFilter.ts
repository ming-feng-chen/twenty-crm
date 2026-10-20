import { type TaskAssigneeSource } from '@/navigation-menu-item/display/item-count/utils/getTaskAssigneeSource';
import { type RecordGqlOperationFilter } from 'twenty-shared/types';

// Status is nullable, and a plain neq would drop tasks without one
const NOT_DONE_FILTER: RecordGqlOperationFilter = {
  or: [{ status: { neq: 'DONE' } }, { status: { is: 'NULL' } }],
};

export const buildOpenTasksAssignedToWorkspaceMemberFilter = ({
  taskAssigneeSource,
  workspaceMemberId,
}: {
  taskAssigneeSource: TaskAssigneeSource;
  workspaceMemberId: string;
}): RecordGqlOperationFilter => {
  const workspaceMemberFilter = {
    [taskAssigneeSource.workspaceMemberJoinColumnName]: {
      eq: workspaceMemberId,
    },
  };

  const assignedFilter =
    taskAssigneeSource.type === 'junction'
      ? ({
          [taskAssigneeSource.fieldName]: workspaceMemberFilter,
        } as RecordGqlOperationFilter)
      : workspaceMemberFilter;

  return { and: [assignedFilter, NOT_DONE_FILTER] };
};
