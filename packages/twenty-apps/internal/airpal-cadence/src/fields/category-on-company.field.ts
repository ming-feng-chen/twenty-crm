import {
  defineField,
  FieldType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import { COMPANY_CATEGORY_OPTIONS } from 'src/constants/organisation-values';
import { COMPANY_CATEGORY_FIELD_UNIVERSAL_IDENTIFIER } from 'src/constants/partners-airports-identifiers';

export default defineField({
  universalIdentifier: COMPANY_CATEGORY_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.SELECT,
  name: 'category',
  label: 'Category',
  description: 'What kind of organisation it is, for example Duty free.',
  icon: 'IconTag',
  isNullable: true,
  options: [...COMPANY_CATEGORY_OPTIONS],
});
