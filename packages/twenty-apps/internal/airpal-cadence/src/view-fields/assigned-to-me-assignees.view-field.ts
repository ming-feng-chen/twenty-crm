import {
  defineViewField,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  ASSIGNED_TO_ME_ASSIGNEES_VIEW_FIELD_UNIVERSAL_IDENTIFIER,
  TASK_ASSIGNEES_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// Beside where the standard single assignee column sits (position 6).
export default defineViewField({
  universalIdentifier: ASSIGNED_TO_ME_ASSIGNEES_VIEW_FIELD_UNIVERSAL_IDENTIFIER,
  viewUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.task.views.assignedToMe
      .universalIdentifier,
  fieldMetadataUniversalIdentifier: TASK_ASSIGNEES_FIELD_UNIVERSAL_IDENTIFIER,
  position: 6.5,
  size: 150,
  isVisible: true,
});
