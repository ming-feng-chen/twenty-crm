import { type FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { getJunctionConfig } from '@/object-record/record-field/ui/utils/junction/getJunctionConfig';
import { hasJunctionTargetFieldId } from '@/object-record/record-field/ui/utils/junction/hasJunctionTargetFieldId';
import { isUsableJunctionConfig } from '@/object-record/record-field/ui/utils/junction/isUsableJunctionConfig';
import { type JunctionObjectMetadataItem } from '@/object-record/record-field/ui/utils/junction/types/JunctionObjectMetadataItem';
import { isDefined } from 'twenty-shared/utils';
import { FieldMetadataType, RelationType } from '~/generated-metadata/graphql';

export type ForwardJunctionTargetField = {
  junctionObjectMetadata: JunctionObjectMetadataItem;
  sourceField: FieldMetadataItem;
  targetField: FieldMetadataItem;
};

// Morph junctions are left out: a selected record must map to exactly one join
// column on the junction object.
export const getForwardJunctionTargetField = ({
  fieldMetadataItem,
  objectMetadataItems,
}: {
  fieldMetadataItem: Pick<FieldMetadataItem, 'type' | 'settings' | 'relation'>;
  objectMetadataItems: JunctionObjectMetadataItem[];
}): ForwardJunctionTargetField | undefined => {
  const relation = fieldMetadataItem.relation;

  if (
    fieldMetadataItem.type !== FieldMetadataType.RELATION ||
    relation?.type !== RelationType.ONE_TO_MANY ||
    !hasJunctionTargetFieldId(fieldMetadataItem.settings)
  ) {
    return undefined;
  }

  const junctionConfig = getJunctionConfig({
    settings: fieldMetadataItem.settings,
    relationObjectMetadataId: relation.targetObjectMetadata.id,
    relationTargetFieldMetadataId: relation.targetFieldMetadata.id,
    sourceObjectMetadataId: relation.sourceObjectMetadata.id,
    objectMetadataItems,
  });

  if (
    !isUsableJunctionConfig(junctionConfig) ||
    junctionConfig.isMorphRelation ||
    !isDefined(junctionConfig.sourceField)
  ) {
    return undefined;
  }

  const [targetField] = junctionConfig.targetFields;

  if (
    !isDefined(targetField) ||
    targetField.type !== FieldMetadataType.RELATION ||
    !isDefined(targetField.relation)
  ) {
    return undefined;
  }

  return {
    junctionObjectMetadata: junctionConfig.junctionObjectMetadata,
    sourceField: junctionConfig.sourceField,
    targetField,
  };
};
