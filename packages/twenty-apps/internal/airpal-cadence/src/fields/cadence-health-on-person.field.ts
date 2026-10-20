import {
  defineField,
  FieldType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  FIELD_OPTIONS,
  quotedSelectDefault,
} from 'src/constants/cadence-values';
import { PERSON_CADENCE_HEALTH_FIELD_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: PERSON_CADENCE_HEALTH_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.SELECT,
  name: 'cadenceHealth',
  label: 'Health',
  description:
    'Active runs the cadence; Hold pauses it until the revisit date; Dead stops it.',
  icon: 'IconHeartbeat',
  isNullable: false,
  defaultValue: quotedSelectDefault('ACTIVE'),
  options: FIELD_OPTIONS.cadenceHealth,
});
