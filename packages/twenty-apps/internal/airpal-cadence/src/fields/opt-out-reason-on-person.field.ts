import {
  defineField,
  FieldType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  FIELD_OPTIONS,
} from 'src/constants/cadence-values';
import { PERSON_OPT_OUT_REASON_FIELD_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: PERSON_OPT_OUT_REASON_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.SELECT,
  name: 'optOutReason',
  label: 'Opt-out reason',
  description:
    'Asked us to stop also adds the email and LinkedIn URL to the permanent suppression list.',
  icon: 'IconMessageOff',
  isNullable: true,
  options: FIELD_OPTIONS.optOutReason,
});
