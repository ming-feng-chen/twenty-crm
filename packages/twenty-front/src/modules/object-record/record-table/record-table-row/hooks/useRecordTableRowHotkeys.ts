import { useRecordTableContextOrThrow } from '@/object-record/record-table/contexts/RecordTableContext';
import { useResetRecordSelection } from '@/object-record/record-selection/hooks/useResetRecordSelection';
import { useFocusedRecordTableRow } from '@/object-record/record-table/hooks/useFocusedRecordTableRow';
import { useHotkeysOnFocusedElement } from '@/ui/utilities/hotkey/hooks/useHotkeysOnFocusedElement';
import { Key } from 'ts-key-enum';

// AirPal: the owner removed the row shortcuts (X, Shift+X, Enter, Ctrl+Enter, Ctrl+A); only Esc stays.
export const useRecordTableRowHotkeys = (focusId: string) => {
  const { recordTableId } = useRecordTableContextOrThrow();

  const { resetRecordSelection } = useResetRecordSelection(recordTableId);

  const { unfocusRecordTableRow } = useFocusedRecordTableRow(recordTableId);

  const handleEscape = () => {
    unfocusRecordTableRow();
    resetRecordSelection();
  };

  useHotkeysOnFocusedElement({
    keys: [Key.Escape],
    callback: handleEscape,
    focusId,
    dependencies: [handleEscape],
  });
};
