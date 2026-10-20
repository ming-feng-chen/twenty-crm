import { defineObject } from 'twenty-sdk/define';

import { TASK_ASSIGNEE_OBJECT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

// `task` and `workspaceMember` are relation fields defined in src/fields/.
export default defineObject({
  universalIdentifier: TASK_ASSIGNEE_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'taskAssignee',
  namePlural: 'taskAssignees',
  labelSingular: 'Task assignee',
  labelPlural: 'Task assignees',
  description:
    'Who a task is assigned to: one record per assigned member, with taskId and workspaceMemberId. To assign a task, create one record per member; to unassign, delete that record.',
  icon: 'IconUserCircle',
  isSearchable: false,
  fields: [],
});
