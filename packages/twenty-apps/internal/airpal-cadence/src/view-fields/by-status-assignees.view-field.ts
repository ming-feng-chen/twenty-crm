import {
  defineViewField,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  BY_STATUS_ASSIGNEES_VIEW_FIELD_UNIVERSAL_IDENTIFIER,
  TASK_ASSIGNEES_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// Beside where the standard single assignee card field sits (position 4).
export default defineViewField({
  universalIdentifier: BY_STATUS_ASSIGNEES_VIEW_FIELD_UNIVERSAL_IDENTIFIER,
  viewUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.task.views.byStatus
      .universalIdentifier,
  fieldMetadataUniversalIdentifier: TASK_ASSIGNEES_FIELD_UNIVERSAL_IDENTIFIER,
  position: 4.5,
  size: 150,
  isVisible: true,
});
