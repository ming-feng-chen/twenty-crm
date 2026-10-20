import {
  defineField,
  FieldType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import { COMPANY_GROUP_OPTIONS } from 'src/constants/organisation-values';
import { COMPANY_GROUP_FIELD_UNIVERSAL_IDENTIFIER } from 'src/constants/partners-airports-identifiers';

export default defineField({
  universalIdentifier: COMPANY_GROUP_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.SELECT,
  name: 'group',
  label: 'Group',
  description:
    'Partner: a concession AirPal works with. Airport: a client AirPal sells to.',
  icon: 'IconCategory',
  isNullable: true,
  options: [...COMPANY_GROUP_OPTIONS],
});
