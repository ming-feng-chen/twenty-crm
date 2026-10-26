import { useLingui } from '@lingui/react/macro';
import { type FocusEvent, type KeyboardEvent, useRef, useState } from 'react';

import {
  StyledFastContactsEditorContainer,
  StyledFastContactsEditorInput,
} from '@/fast-contacts/components/cell-editors/FastContactsCellEditorStyles';
import { type FastContactsEditorMove } from '@/fast-contacts/types/FastContactsEditorMove';
import { type FieldFullNameValue } from '@/object-record/record-field/ui/types/FieldMetadata';
import { useFastContactsEditorClose } from '@/fast-contacts/hooks/useFastContactsEditorClose';

type FastContactsNameCellEditorProps = {
  initialName: FieldFullNameValue;
  onCommit: (name: FieldFullNameValue, move: FastContactsEditorMove) => void;
  onCancel: () => void;
};

// First and Last boxes; a full name typed or pasted into First is split at
// its first space when saved, so typing straight into the cell works too.
export const FastContactsNameCellEditor = ({
  initialName,
  onCommit,
  onCancel,
}: FastContactsNameCellEditorProps) => {
  const { t } = useLingui();
  const containerRef = useRef<HTMLDivElement>(null);
  const [firstName, setFirstName] = useState(initialName.firstName);
  const [lastName, setLastName] = useState(initialName.lastName);
  const close = useFastContactsEditorClose();

  const commit = (move: FastContactsEditorMove) => {
    const [typedFirstName, ...typedRest] = firstName.trim().split(/\s+/);
    const name =
      lastName.trim() === '' && typedRest.length > 0
        ? { firstName: typedFirstName, lastName: typedRest.join(' ') }
        : { firstName: firstName.trim(), lastName: lastName.trim() };

    close(() => onCommit(name, move));
  };

  const handleKeyDown =
    (box: 'first' | 'last') => (event: KeyboardEvent<HTMLInputElement>) => {
      event.stopPropagation();

      if (event.key === 'Escape') {
        event.preventDefault();
        close(onCancel);

        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        commit('down');

        return;
      }

      const isLeavingEditor =
        event.key === 'Tab' &&
        ((box === 'last' && !event.shiftKey) ||
          (box === 'first' && event.shiftKey));

      if (isLeavingEditor) {
        event.preventDefault();
        commit(event.shiftKey ? 'left' : 'right');
      }
    };

  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    if (!containerRef.current?.contains(event.relatedTarget as Node | null)) {
      commit('none');
    }
  };

  return (
    <StyledFastContactsEditorContainer ref={containerRef}>
      <StyledFastContactsEditorInput
        autoFocus
        aria-label={t`First name`}
        placeholder={t`First name`}
        value={firstName}
        onChange={(event) => setFirstName(event.target.value)}
        onKeyDown={handleKeyDown('first')}
        onBlur={handleBlur}
      />
      <StyledFastContactsEditorInput
        aria-label={t`Last name`}
        placeholder={t`Last name`}
        value={lastName}
        onChange={(event) => setLastName(event.target.value)}
        onKeyDown={handleKeyDown('last')}
        onBlur={handleBlur}
      />
    </StyledFastContactsEditorContainer>
  );
};
