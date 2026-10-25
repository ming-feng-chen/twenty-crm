import { RecordBoardContext } from '@/object-record/record-board/contexts/RecordBoardContext';
import { useFocusedRecordBoardCard } from '@/object-record/record-board/hooks/useFocusedRecordBoardCard';
import { useResetRecordSelection } from '@/object-record/record-selection/hooks/useResetRecordSelection';
import { useHotkeysOnFocusedElement } from '@/ui/utilities/hotkey/hooks/useHotkeysOnFocusedElement';
import { useContext } from 'react';
import { Key } from 'ts-key-enum';

// AirPal: the owner removed the card shortcuts (X, Shift+X, Enter, Ctrl+Enter, Ctrl+A); only Esc stays.
export const useRecordBoardCardHotkeys = (focusId: string) => {
  const { recordBoardId } = useContext(RecordBoardContext);

  const { resetRecordSelection } = useResetRecordSelection();
  const { unfocusBoardCard } = useFocusedRecordBoardCard(recordBoardId);

  const handleEscape = () => {
    unfocusBoardCard();

    resetRecordSelection();
  };

  useHotkeysOnFocusedElement({
    keys: [Key.Escape],
    callback: handleEscape,
    focusId,
    dependencies: [handleEscape],
  });
};
