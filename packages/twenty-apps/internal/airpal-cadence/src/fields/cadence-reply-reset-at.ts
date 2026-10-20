import {
  defineField,
  FieldType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import { PERSON_CADENCE_REPLY_RESET_AT_FIELD_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: PERSON_CADENCE_REPLY_RESET_AT_FIELD_UNIVERSAL_IDENTIFIER,
  name: 'cadenceReplyResetAt',
  label: 'Reply reset at',
  type: FieldType.DATE_TIME,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  description: 'Start-fresh handover time; replies from before this instant are no longer owed.',
  icon: 'IconClock',
  isNullable: true,
  isUIEditable: false,
});
