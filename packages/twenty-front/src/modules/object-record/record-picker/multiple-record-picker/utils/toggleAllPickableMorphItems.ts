import { type RecordPickerPickableMorphItem } from '@/object-record/record-picker/types/RecordPickerPickableMorphItem';

export const isEveryRecordSelected = ({
  pickableMorphItems,
  recordIds,
}: {
  pickableMorphItems: RecordPickerPickableMorphItem[];
  recordIds: string[];
}) =>
  recordIds.length > 0 &&
  recordIds.every((recordId) =>
    pickableMorphItems.some(
      (morphItem) => morphItem.recordId === recordId && morphItem.isSelected,
    ),
  );

// Selects every record, or clears them all when every one is already selected.
// Only the records whose state flips are reported as changed.
export const toggleAllPickableMorphItems = ({
  pickableMorphItems,
  recordIds,
  objectMetadataId,
}: {
  pickableMorphItems: RecordPickerPickableMorphItem[];
  recordIds: string[];
  objectMetadataId: string;
}) => {
  const isSelected = !isEveryRecordSelected({ pickableMorphItems, recordIds });

  const changedMorphItems: RecordPickerPickableMorphItem[] = recordIds
    .filter(
      (recordId) =>
        (pickableMorphItems.find((morphItem) => morphItem.recordId === recordId)
          ?.isSelected ?? false) !== isSelected,
    )
    .map((recordId) => ({
      recordId,
      objectMetadataId,
      isSelected,
      isMatchingSearchFilter: true,
    }));

  const nextPickableMorphItems = [...pickableMorphItems];

  for (const changedMorphItem of changedMorphItems) {
    const existingIndex = nextPickableMorphItems.findIndex(
      (morphItem) => morphItem.recordId === changedMorphItem.recordId,
    );

    if (existingIndex === -1) {
      nextPickableMorphItems.push(changedMorphItem);
    } else {
      nextPickableMorphItems[existingIndex] = {
        ...nextPickableMorphItems[existingIndex],
        isSelected,
      };
    }
  }

  return { nextPickableMorphItems, changedMorphItems };
};
