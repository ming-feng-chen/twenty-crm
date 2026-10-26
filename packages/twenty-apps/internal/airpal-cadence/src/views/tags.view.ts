import { defineView, ViewType } from 'twenty-sdk/define';

import {
  TAG_COLOR_FIELD_UNIVERSAL_IDENTIFIER,
  TAG_NAME_FIELD_UNIVERSAL_IDENTIFIER,
  TAG_OBJECT_UNIVERSAL_IDENTIFIER,
  TAGS_VIEW_UNIVERSAL_IDENTIFIER,
} from 'src/constants/tags-identifiers';

// Where Admins rename or delete tags; members see the list read-only.
export default defineView({
  universalIdentifier: TAGS_VIEW_UNIVERSAL_IDENTIFIER,
  name: 'All Tags',
  objectUniversalIdentifier: TAG_OBJECT_UNIVERSAL_IDENTIFIER,
  type: ViewType.TABLE,
  icon: 'IconTag',
  position: 0,
  fields: [
    {
      universalIdentifier: 'cfe9c228-4e9a-47ca-ad24-c467f6280d16',
      fieldMetadataUniversalIdentifier: TAG_NAME_FIELD_UNIVERSAL_IDENTIFIER,
      position: 0,
      isVisible: true,
      size: 240,
    },
    {
      universalIdentifier: '6e8f4ef2-cdd3-4098-b70b-4dce3a0b9d30',
      fieldMetadataUniversalIdentifier: TAG_COLOR_FIELD_UNIVERSAL_IDENTIFIER,
      position: 1,
      isVisible: true,
      size: 140,
    },
  ],
});
