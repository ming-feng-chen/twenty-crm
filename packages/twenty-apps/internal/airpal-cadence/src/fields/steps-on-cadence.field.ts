import { defineField, FieldType, RelationType } from 'twenty-sdk/define';

import {
  CADENCE_OBJECT_UNIVERSAL_IDENTIFIER,
  CADENCE_STEP_CADENCE_FIELD_UNIVERSAL_IDENTIFIER,
  CADENCE_STEP_OBJECT_UNIVERSAL_IDENTIFIER,
  CADENCE_STEPS_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: CADENCE_STEPS_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: CADENCE_OBJECT_UNIVERSAL_IDENTIFIER,
  type: FieldType.RELATION,
  name: 'steps',
  label: 'Steps',
  icon: 'IconStairs',
  relationTargetObjectMetadataUniversalIdentifier:
    CADENCE_STEP_OBJECT_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier:
    CADENCE_STEP_CADENCE_FIELD_UNIVERSAL_IDENTIFIER,
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
  },
});
