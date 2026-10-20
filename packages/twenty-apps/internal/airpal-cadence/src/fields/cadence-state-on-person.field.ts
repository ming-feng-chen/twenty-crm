import {
  defineField,
  FieldType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  FIELD_OPTIONS,
} from 'src/constants/cadence-values';
import { PERSON_CADENCE_STATE_FIELD_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: PERSON_CADENCE_STATE_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.SELECT,
  name: 'cadenceState',
  label: 'Cadence state',
  description:
    'Written by the engine: the stop check that applies, in the order the engine runs them.',
  icon: 'IconTrafficLights',
  isNullable: true,
  options: FIELD_OPTIONS.cadenceState,
  isUIEditable: false,
  isAuditLogged: false,
});
