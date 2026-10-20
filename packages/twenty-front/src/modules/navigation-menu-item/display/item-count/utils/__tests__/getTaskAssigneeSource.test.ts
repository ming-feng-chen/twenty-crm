import { buildOpenTasksAssignedToWorkspaceMemberFilter } from '@/navigation-menu-item/display/item-count/utils/buildOpenTasksAssignedToWorkspaceMemberFilter';
import { getTaskAssigneeSource } from '@/navigation-menu-item/display/item-count/utils/getTaskAssigneeSource';
import { getTaskAssigneeJunctionObjectMetadataItems } from '~/testing/mock-data/task-assignee-junction';

const NOT_DONE = {
  or: [{ status: { neq: 'DONE' } }, { status: { is: 'NULL' } }],
};

describe('getTaskAssigneeSource', () => {
  it('should prefer the assignees junction over the single assignee', () => {
    const taskAssigneeSource = getTaskAssigneeSource(
      getTaskAssigneeJunctionObjectMetadataItems({
        isLegacyAssigneeActive: true,
      }),
    );

    expect(taskAssigneeSource).toMatchObject({
      type: 'junction',
      fieldName: 'assignees',
      workspaceMemberJoinColumnName: 'workspaceMemberId',
    });
  });

  it('should fall back to the single assignee without a junction', () => {
    const taskAssigneeSource = getTaskAssigneeSource(
      getTaskAssigneeJunctionObjectMetadataItems({
        hasAssigneesJunction: false,
        isLegacyAssigneeActive: true,
      }),
    );

    expect(taskAssigneeSource).toEqual({
      type: 'direct',
      workspaceMemberJoinColumnName: 'assigneeId',
    });
  });

  it('should find nothing when no assignee field is active', () => {
    expect(
      getTaskAssigneeSource(
        getTaskAssigneeJunctionObjectMetadataItems({
          hasAssigneesJunction: false,
        }),
      ),
    ).toBeUndefined();
  });
});

describe('buildOpenTasksAssignedToWorkspaceMemberFilter', () => {
  it('should count unfinished tasks where the member is one of the assignees', () => {
    expect(
      buildOpenTasksAssignedToWorkspaceMemberFilter({
        taskAssigneeSource: {
          type: 'junction',
          fieldName: 'assignees',
          junctionObjectMetadata:
            getTaskAssigneeJunctionObjectMetadataItems()[1],
          workspaceMemberJoinColumnName: 'workspaceMemberId',
        },
        workspaceMemberId: 'member-1',
      }),
    ).toEqual({
      and: [{ assignees: { workspaceMemberId: { eq: 'member-1' } } }, NOT_DONE],
    });
  });

  it('should count unfinished tasks of the single assignee', () => {
    expect(
      buildOpenTasksAssignedToWorkspaceMemberFilter({
        taskAssigneeSource: {
          type: 'direct',
          workspaceMemberJoinColumnName: 'assigneeId',
        },
        workspaceMemberId: 'member-1',
      }),
    ).toEqual({
      and: [{ assigneeId: { eq: 'member-1' } }, NOT_DONE],
    });
  });
});
