import {
  defineField,
  FieldType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  FIELD_OPTIONS,
  quotedSelectDefault,
} from 'src/constants/cadence-values';
import { PERSON_CADENCE_STAGE_FIELD_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: PERSON_CADENCE_STAGE_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.SELECT,
  name: 'cadenceStage',
  label: 'Stage',
  description:
    'Where the conversation is. People set it; logging the first touch or a reply moves it automatically.',
  icon: 'IconProgress',
  isNullable: false,
  defaultValue: quotedSelectDefault('NOT_CONTACTED'),
  options: FIELD_OPTIONS.cadenceStage,
});
