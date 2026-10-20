import { buildMyDayRowsFilter } from '@/navigation-menu-item/display/item-count/utils/buildMyDayRowsFilter';
import { getTaskAssigneeJunctionObjectMetadataItems } from '~/testing/mock-data/task-assignee-junction';

describe('buildMyDayRowsFilter', () => {
  it("should match the member's own due contacts", () => {
    expect(
      buildMyDayRowsFilter({
        objectMetadataItems: getTaskAssigneeJunctionObjectMetadataItems(),
        workspaceMemberId: 'member-1',
      }),
    ).toEqual({
      cadenceDue: { eq: true },
      cadenceOwnerId: { eq: 'member-1' },
    });
  });

  it('should give no filter when the cadence fields are missing', () => {
    expect(
      buildMyDayRowsFilter({
        objectMetadataItems: getTaskAssigneeJunctionObjectMetadataItems({
          personFieldNames: ['cadenceOwner'],
        }),
        workspaceMemberId: 'member-1',
      }),
    ).toBeUndefined();
  });
});
