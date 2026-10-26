import { defineObject, FieldType } from 'twenty-sdk/define';

import { TAG_COLOR_OPTIONS } from 'src/constants/tag-values';
import {
  TAG_COLOR_FIELD_UNIVERSAL_IDENTIFIER,
  TAG_NAME_FIELD_UNIVERSAL_IDENTIFIER,
  TAG_OBJECT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/tags-identifiers';

// Members create tags through the create-tag route; only Admins rename or
// delete them (see the Cadence Member role).
export default defineObject({
  universalIdentifier: TAG_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'tag',
  namePlural: 'tags',
  labelSingular: 'Tag',
  labelPlural: 'Tags',
  description:
    'Labels for contacts, such as their role (Marketing & customer, Leadership). A contact can have several.',
  icon: 'IconTag',
  labelIdentifierFieldMetadataUniversalIdentifier:
    TAG_NAME_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: TAG_NAME_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'name',
      label: 'Name',
      icon: 'IconTag',
      isNullable: true,
    },
    {
      universalIdentifier: TAG_COLOR_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'color',
      label: 'Colour',
      icon: 'IconPalette',
      isNullable: true,
      options: [...TAG_COLOR_OPTIONS],
    },
  ],
});
