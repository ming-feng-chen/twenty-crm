import { getJunctionFilterRelationTargetFieldMetadataId } from '@/object-record/record-filter/utils/getJunctionFilterRelationTargetFieldMetadataId';
import {
  getTaskAssigneeJunctionObjectMetadataItems,
  TASK_ASSIGNEE_WORKSPACE_MEMBER_FIELD_ID,
} from '~/testing/mock-data/task-assignee-junction';

const objectMetadataItems = getTaskAssigneeJunctionObjectMetadataItems({
  isLegacyAssigneeActive: true,
});
const [taskObjectMetadataItem] = objectMetadataItems;

const getTaskField = (name: string) => {
  const field = taskObjectMetadataItem.fields.find(
    (taskField) => taskField.name === name,
  );

  if (field === undefined) {
    throw new Error(`Missing task field ${name}`);
  }

  return field;
};

describe('getJunctionFilterRelationTargetFieldMetadataId', () => {
  it('should traverse a junction field to the members behind it', () => {
    expect(
      getJunctionFilterRelationTargetFieldMetadataId({
        fieldMetadataItem: getTaskField('assignees'),
        objectMetadataItems,
      }),
    ).toBe(TASK_ASSIGNEE_WORKSPACE_MEMBER_FIELD_ID);
  });

  it('should leave a plain relation untouched', () => {
    expect(
      getJunctionFilterRelationTargetFieldMetadataId({
        fieldMetadataItem: getTaskField('assignee'),
        objectMetadataItems,
      }),
    ).toBeNull();
  });
});
