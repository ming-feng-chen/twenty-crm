import {
  defineField,
  FieldType,
  OnDeleteAction,
  RelationType,
} from 'twenty-sdk/define';

import {
  CADENCE_OBJECT_UNIVERSAL_IDENTIFIER,
  CADENCE_STEP_CADENCE_FIELD_UNIVERSAL_IDENTIFIER,
  CADENCE_STEP_OBJECT_UNIVERSAL_IDENTIFIER,
  CADENCE_STEPS_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: CADENCE_STEP_CADENCE_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: CADENCE_STEP_OBJECT_UNIVERSAL_IDENTIFIER,
  type: FieldType.RELATION,
  name: 'cadence',
  label: 'Cadence',
  icon: 'IconRoute',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier:
    CADENCE_OBJECT_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier:
    CADENCE_STEPS_FIELD_UNIVERSAL_IDENTIFIER,
  universalSettings: {
    relationType: RelationType.MANY_TO_ONE,
    onDelete: OnDeleteAction.CASCADE,
    joinColumnName: 'cadenceId',
  },
});
