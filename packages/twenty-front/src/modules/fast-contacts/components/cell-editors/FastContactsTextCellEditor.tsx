import { type KeyboardEvent, useState } from 'react';

import {
  StyledFastContactsEditorContainer,
  StyledFastContactsEditorInput,
} from '@/fast-contacts/components/cell-editors/FastContactsCellEditorStyles';
import { type FastContactsEditorMove } from '@/fast-contacts/types/FastContactsEditorMove';
import { getFastContactsEditorMoveFromKey } from '@/fast-contacts/utils/getFastContactsEditorMoveFromKey';
import { useFastContactsEditorClose } from '@/fast-contacts/hooks/useFastContactsEditorClose';

type FastContactsTextCellEditorProps = {
  initialText: string;
  ariaLabel: string;
  onCommit: (text: string, move: FastContactsEditorMove) => void;
  onCancel: () => void;
};

export const FastContactsTextCellEditor = ({
  initialText,
  ariaLabel,
  onCommit,
  onCancel,
}: FastContactsTextCellEditorProps) => {
  const [text, setText] = useState(initialText);
  const close = useFastContactsEditorClose();

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation();

    if (event.key === 'Escape') {
      event.preventDefault();
      close(onCancel);

      return;
    }

    const move = getFastContactsEditorMoveFromKey(event);

    if (move !== null) {
      event.preventDefault();
      close(() => onCommit(text, move));
    }
  };

  // Clicking elsewhere saves, as in a spreadsheet.
  const handleBlur = () => close(() => onCommit(text, 'none'));

  return (
    <StyledFastContactsEditorContainer>
      <StyledFastContactsEditorInput
        autoFocus
        aria-label={ariaLabel}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onFocus={(event) =>
          event.target.setSelectionRange(text.length, text.length)
        }
      />
    </StyledFastContactsEditorContainer>
  );
};
