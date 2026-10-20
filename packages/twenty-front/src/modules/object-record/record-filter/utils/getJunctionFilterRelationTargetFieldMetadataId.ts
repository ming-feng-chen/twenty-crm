import { type FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { getForwardJunctionTargetField } from '@/object-record/record-field/ui/utils/junction/getForwardJunctionTargetField';
import { type JunctionObjectMetadataItem } from '@/object-record/record-field/ui/utils/junction/types/JunctionObjectMetadataItem';

// Filtering on a junction field (e.g. task assignees) picks the records behind
// the junction, so the filter traverses to the junction's target field.
export const getJunctionFilterRelationTargetFieldMetadataId = ({
  fieldMetadataItem,
  objectMetadataItems,
}: {
  fieldMetadataItem: Pick<FieldMetadataItem, 'type' | 'settings' | 'relation'>;
  objectMetadataItems: JunctionObjectMetadataItem[];
}): string | null =>
  getForwardJunctionTargetField({ fieldMetadataItem, objectMetadataItems })
    ?.targetField.id ?? null;
