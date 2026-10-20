import { type RecordFilter } from '@/object-record/record-filter/types/RecordFilter';
import { buildJunctionRecordsFromFilters } from '@/object-record/record-table/utils/buildJunctionRecordsFromFilters';
import { ViewFilterOperand } from 'twenty-shared/types';
import {
  getTaskAssigneeJunctionObjectMetadataItems,
  TASK_ASSIGNEE_WORKSPACE_MEMBER_FIELD_ID,
  TASK_ASSIGNEES_FIELD_ID,
} from '~/testing/mock-data/task-assignee-junction';

const objectMetadataItems = getTaskAssigneeJunctionObjectMetadataItems();
const [taskObjectMetadataItem] = objectMetadataItems;

const assigneeFilter = (
  overrides: Partial<RecordFilter> = {},
): RecordFilter => ({
  id: 'filter-id',
  fieldMetadataId: TASK_ASSIGNEES_FIELD_ID,
  relationTargetFieldMetadataId: TASK_ASSIGNEE_WORKSPACE_MEMBER_FIELD_ID,
  operand: ViewFilterOperand.IS,
  value: JSON.stringify({
    isCurrentWorkspaceMemberSelected: true,
    selectedRecordIds: [],
  }),
  displayValue: 'Me',
  type: 'RELATION',
  label: 'Assignee',
  ...overrides,
});

describe('buildJunctionRecordsFromFilters', () => {
  it('should assign a task created in "Assigned to Me" to the viewer', () => {
    expect(
      buildJunctionRecordsFromFilters({
        currentRecordFilters: [assigneeFilter()],
        objectMetadataItem: taskObjectMetadataItem,
        objectMetadataItems,
        currentWorkspaceMemberId: 'member-me',
        recordId: 'task-1',
      }),
    ).toEqual({
      junctionObjectNameSingular: 'taskAssignee',
      recordsToCreate: [{ taskId: 'task-1', workspaceMemberId: 'member-me' }],
    });
  });

  it('should assign every member picked in the filter once', () => {
    const result = buildJunctionRecordsFromFilters({
      currentRecordFilters: [
        assigneeFilter({
          value: JSON.stringify({
            isCurrentWorkspaceMemberSelected: true,
            selectedRecordIds: ['member-romy', 'member-me'],
          }),
        }),
      ],
      objectMetadataItem: taskObjectMetadataItem,
      objectMetadataItems,
      currentWorkspaceMemberId: 'member-me',
      recordId: 'task-1',
    });

    expect(result?.recordsToCreate).toEqual([
      { taskId: 'task-1', workspaceMemberId: 'member-romy' },
      { taskId: 'task-1', workspaceMemberId: 'member-me' },
    ]);
  });

  it('should not assign anyone for "is not" or grouped filters', () => {
    expect(
      buildJunctionRecordsFromFilters({
        currentRecordFilters: [
          assigneeFilter({ operand: ViewFilterOperand.IS_NOT }),
          assigneeFilter({ recordFilterGroupId: 'group-id' }),
        ],
        objectMetadataItem: taskObjectMetadataItem,
        objectMetadataItems,
        currentWorkspaceMemberId: 'member-me',
        recordId: 'task-1',
      }),
    ).toBeUndefined();
  });
});
