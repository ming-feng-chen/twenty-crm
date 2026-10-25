import { type ObjectRecordOperation } from '@/object-record/types/ObjectRecordOperation';

// Returns null when the operation does not say which records changed.
export const getRecordIdsFromRecordOperation = (
  operation: ObjectRecordOperation,
): string[] | null => {
  switch (operation.type) {
    case 'update-one':
      return [operation.result.updateInput.recordId];
    case 'update-many':
      return operation.result.updateInputs.map(
        (updateInput) => updateInput.recordId,
      );
    case 'create-one':
      return [operation.createdRecord.id];
    case 'restore-one':
      return [operation.restoredRecord.id];
    case 'restore-many':
      return operation.restoredRecords.map((record) => record.id);
    case 'delete-one':
      return [operation.deletedRecordId];
    case 'delete-many':
      return operation.deletedRecordIds;
    default:
      return null;
  }
};
