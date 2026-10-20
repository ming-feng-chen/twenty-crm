import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';
import { getForwardJunctionTargetField } from '@/object-record/record-field/ui/utils/junction/getForwardJunctionTargetField';
import { type RecordFilter } from '@/object-record/record-filter/types/RecordFilter';
import { ViewFilterOperand } from 'twenty-shared/types';
import {
  arrayOfUuidOrVariableSchema,
  computeRelationGqlFieldJoinColumnName,
  isDefined,
  jsonRelationFilterValueSchema,
} from 'twenty-shared/utils';

export type JunctionRecordsFromFilters = {
  junctionObjectNameSingular: string;
  recordsToCreate: Record<string, string>[];
};

const getSelectedRecordIds = ({
  value,
  currentWorkspaceMemberId,
}: {
  value: string;
  currentWorkspaceMemberId?: string;
}) => {
  const parsedValue = jsonRelationFilterValueSchema.safeParse(value);

  if (!parsedValue.success) {
    return arrayOfUuidOrVariableSchema.parse(value);
  }

  return [
    ...parsedValue.data.selectedRecordIds,
    ...(parsedValue.data.isCurrentWorkspaceMemberSelected === true &&
    isDefined(currentWorkspaceMemberId)
      ? [currentWorkspaceMemberId]
      : []),
  ];
};

// A junction column cannot be prefilled on the record itself, so a record
// created inside a view filtered on a junction (e.g. "Assigned to Me") gets
// its junction rows right after it exists. Only the first such filter counts.
export const buildJunctionRecordsFromFilters = ({
  currentRecordFilters,
  objectMetadataItem,
  objectMetadataItems,
  currentWorkspaceMemberId,
  recordId,
}: {
  currentRecordFilters: RecordFilter[];
  objectMetadataItem: EnrichedObjectMetadataItem;
  objectMetadataItems: EnrichedObjectMetadataItem[];
  currentWorkspaceMemberId?: string;
  recordId: string;
}): JunctionRecordsFromFilters | undefined => {
  for (const filter of currentRecordFilters) {
    if (
      filter.operand !== ViewFilterOperand.IS ||
      isDefined(filter.recordFilterGroupId) ||
      !isDefined(filter.relationTargetFieldMetadataId)
    ) {
      continue;
    }

    const sourceField = objectMetadataItem.fields.find(
      (field) => field.id === filter.fieldMetadataId,
    );

    if (!isDefined(sourceField)) {
      continue;
    }

    const junctionTarget = getForwardJunctionTargetField({
      fieldMetadataItem: sourceField,
      objectMetadataItems,
    });

    if (
      junctionTarget?.targetField.id !== filter.relationTargetFieldMetadataId
    ) {
      continue;
    }

    const selectedRecordIds = [
      ...new Set(
        getSelectedRecordIds({
          value: filter.value,
          currentWorkspaceMemberId,
        }),
      ),
    ];

    if (selectedRecordIds.length === 0) {
      continue;
    }

    const sourceJoinColumnName = computeRelationGqlFieldJoinColumnName({
      name: junctionTarget.sourceField.name,
    });
    const targetJoinColumnName = computeRelationGqlFieldJoinColumnName({
      name: junctionTarget.targetField.name,
    });

    return {
      junctionObjectNameSingular:
        junctionTarget.junctionObjectMetadata.nameSingular,
      recordsToCreate: selectedRecordIds.map((selectedRecordId) => ({
        [sourceJoinColumnName]: recordId,
        [targetJoinColumnName]: selectedRecordId,
      })),
    };
  }

  return undefined;
};
