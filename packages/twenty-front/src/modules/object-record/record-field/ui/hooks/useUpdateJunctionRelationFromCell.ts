import { useCallback } from 'react';
import { useStore } from 'jotai';
import { isDefined } from 'twenty-shared/utils';

import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { type FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { useCreateManyRecords } from '@/object-record/hooks/useCreateManyRecords';
import { useDeleteOneRecord } from '@/object-record/hooks/useDeleteOneRecord';
import { type FieldDefinition } from '@/object-record/record-field/ui/types/FieldDefinition';
import {
  type FieldRelationFromManyValue,
  type FieldRelationMetadata,
  type FieldRelationValue,
} from '@/object-record/record-field/ui/types/FieldMetadata';
import { findJunctionRecordByTargetId } from '@/object-record/record-field/ui/utils/junction/findJunctionRecordByTargetId';
import { findTargetFieldInfo } from '@/object-record/record-field/ui/utils/junction/findTargetFieldInfo';
import { getSourceJoinColumnName } from '@/object-record/record-field/ui/utils/junction/getSourceJoinColumnName';
import { isUsableJunctionConfig } from '@/object-record/record-field/ui/utils/junction/isUsableJunctionConfig';
import { resolveJunctionConfig } from '@/object-record/record-field/ui/utils/junction/resolveJunctionConfig';
import { type RecordPickerPickableMorphItem } from '@/object-record/record-picker/types/RecordPickerPickableMorphItem';
import { recordStoreFamilyState } from '@/object-record/record-store/states/recordStoreFamilyState';

type UseUpdateJunctionRelationFromCellArgs = {
  fieldMetadataItem: FieldMetadataItem;
  fieldDefinition: FieldDefinition<FieldRelationMetadata>;
  recordId: string;
};

export const useUpdateJunctionRelationFromCell = ({
  fieldMetadataItem,
  fieldDefinition,
  recordId,
}: UseUpdateJunctionRelationFromCellArgs) => {
  const { objectMetadataItems } = useObjectMetadataItems();

  const sourceObjectMetadata = objectMetadataItems.find(
    (item) =>
      item.nameSingular === fieldDefinition.metadata.objectMetadataNameSingular,
  );

  const junctionConfig = resolveJunctionConfig({
    settings: fieldMetadataItem.settings,
    relationObjectMetadataId: fieldDefinition.metadata.relationObjectMetadataId,
    relationTargetFieldMetadataId:
      fieldMetadataItem.relation?.targetFieldMetadata.id,
    sourceObjectMetadataId: sourceObjectMetadata?.id,
    objectMetadataItems,
  });

  const junctionObjectMetadata = junctionConfig?.junctionObjectMetadata;
  const sourceFieldOnJunction = junctionConfig?.sourceField;

  const junctionObjectNameSingular =
    junctionObjectMetadata?.nameSingular ??
    fieldDefinition.metadata.relationObjectMetadataNameSingular;

  const { createManyRecords: createJunctionRecords } = useCreateManyRecords({
    objectNameSingular: junctionObjectNameSingular,
  });

  const { deleteOneRecord: deleteJunctionRecord } = useDeleteOneRecord({
    objectNameSingular: junctionObjectNameSingular,
  });

  const store = useStore();
  const updateJunctionRelationsFromCell = useCallback(
    async ({ morphItems }: { morphItems: RecordPickerPickableMorphItem[] }) => {
      const targetFields = junctionConfig?.targetFields;

      if (
        !isUsableJunctionConfig(junctionConfig) ||
        !isDefined(junctionObjectMetadata) ||
        !isDefined(sourceFieldOnJunction) ||
        !isDefined(targetFields) ||
        targetFields.length === 0
      ) {
        return;
      }

      if (!isDefined(sourceObjectMetadata)) {
        return;
      }

      const sourceJoinColumnName = getSourceJoinColumnName({
        sourceField: sourceFieldOnJunction,
        sourceObjectMetadata,
      });

      if (!isDefined(sourceJoinColumnName)) {
        return;
      }

      const fieldName = fieldDefinition.metadata.fieldName;

      const recordFromStore = store.get(
        recordStoreFamilyState.atomFamily(recordId),
      );
      const currentJunctionRecords =
        (recordFromStore?.[fieldName] as
          | FieldRelationValue<FieldRelationFromManyValue>
          | undefined) ?? [];

      const junctionRecordIdsToDelete: string[] = [];
      const recordsToCreate: Record<string, string>[] = [];

      for (const morphItem of morphItems) {
        const targetFieldInfo = findTargetFieldInfo(
          targetFields,
          morphItem.objectMetadataId,
          objectMetadataItems,
        );

        if (!isDefined(targetFieldInfo?.joinColumnName)) {
          continue;
        }

        // morphItem.isSelected represents the NEW state (what the user wants)
        if (!morphItem.isSelected) {
          const junctionRecordToDelete = findJunctionRecordByTargetId({
            junctionRecords: currentJunctionRecords,
            targetRecordId: morphItem.recordId,
            targetFieldName: targetFieldInfo.fieldName,
          });

          if (isDefined(junctionRecordToDelete)) {
            junctionRecordIdsToDelete.push(junctionRecordToDelete.id);
          }
        } else {
          recordsToCreate.push({
            [sourceJoinColumnName]: recordId,
            [targetFieldInfo.joinColumnName]: morphItem.recordId,
          });
        }
      }

      for (const junctionRecordIdToDelete of junctionRecordIdsToDelete) {
        await deleteJunctionRecord(junctionRecordIdToDelete);
      }

      if (recordsToCreate.length > 0) {
        await createJunctionRecords({ recordsToCreate, upsert: true });
      }
    },
    [
      store,
      createJunctionRecords,
      deleteJunctionRecord,
      fieldDefinition.metadata.fieldName,
      junctionConfig,
      junctionObjectMetadata,
      objectMetadataItems,
      recordId,
      sourceFieldOnJunction,
      sourceObjectMetadata,
    ],
  );

  const updateJunctionRelationFromCell = useCallback(
    ({ morphItem }: { morphItem: RecordPickerPickableMorphItem }) =>
      updateJunctionRelationsFromCell({ morphItems: [morphItem] }),
    [updateJunctionRelationsFromCell],
  );

  return {
    updateJunctionRelationFromCell,
    updateJunctionRelationsFromCell,
    junctionConfig,
  };
};
