import {
  defineField,
  FieldType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import { PERSON_CADENCE_COMPUTED_ON_FIELD_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: PERSON_CADENCE_COMPUTED_ON_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.DATE,
  name: 'cadenceComputedOn',
  label: 'Cadence computed on',
  description:
    'Written by the engine: the today the cadence fields were computed for.',
  icon: 'IconCalendarCheck',
  isNullable: true,
  isUIEditable: false,
  isAuditLogged: false,
});
