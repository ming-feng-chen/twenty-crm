import {
  defineField,
  FieldType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import { PERSON_CADENCE_OWNER_CHANGE_REQUEST_FIELD_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: PERSON_CADENCE_OWNER_CHANGE_REQUEST_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.RAW_JSON,
  name: 'cadenceOwnerChangeRequest',
  label: 'Cadence owner change request',
  description:
    'Written by the app: how the last Change owner asked to hand over (start fresh or keep position).',
  icon: 'IconTransfer',
  isNullable: true,
  isUIEditable: false,
  isAuditLogged: false,
});
