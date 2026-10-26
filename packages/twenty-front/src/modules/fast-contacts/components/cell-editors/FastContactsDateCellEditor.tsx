import { useLingui } from '@lingui/react/macro';
import { type KeyboardEvent, type RefObject, useRef, useState } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { Dropdown } from 'twenty-ui/components/navigation';

import {
  StyledFastContactsEditorContainer,
  StyledFastContactsEditorInput,
} from '@/fast-contacts/components/cell-editors/FastContactsCellEditorStyles';
import { useFastContactsEditorClose } from '@/fast-contacts/hooks/useFastContactsEditorClose';
import { type FastContactsEditorMove } from '@/fast-contacts/types/FastContactsEditorMove';
import { formatFastContactsDateForInput } from '@/fast-contacts/utils/formatFastContactsDateForInput';
import { getFastContactsEditorMoveFromKey } from '@/fast-contacts/utils/getFastContactsEditorMoveFromKey';
import { parseFastContactsDateInput } from '@/fast-contacts/utils/parseFastContactsDateInput';
import { type DateFormat } from '@/localization/constants/DateFormat';
import { DatePicker } from '@/ui/input/components/internal/date/components/DatePicker';
import { getDateFormatStringForDatePickerInputMask } from '~/utils/date-utils';

type FastContactsDateCellEditorProps = {
  instanceId: string;
  anchorRef: RefObject<HTMLElement | null>;
  value: string | null;
  initialText: string | null;
  dateFormat: DateFormat;
  onCommitText: (text: string, move: FastContactsEditorMove) => void;
  onCancel: () => void;
};

// Typing stays in the cell; the calendar floats beside it without taking
// focus, so it can flip to stay on screen like the other pickers.
export const FastContactsDateCellEditor = ({
  instanceId,
  anchorRef,
  value,
  initialText,
  dateFormat,
  onCommitText,
  onCancel,
}: FastContactsDateCellEditorProps) => {
  const { t } = useLingui();
  const inputMask = getDateFormatStringForDatePickerInputMask(dateFormat);
  const calendarRef = useRef<HTMLDivElement>(null);
  const close = useFastContactsEditorClose();
  const [text, setText] = useState(
    initialText ?? formatFastContactsDateForInput({ date: value, dateFormat }),
  );
  const [calendarDate, setCalendarDate] = useState<string | null>(value);

  const handleTextChange = (nextText: string) => {
    setText(nextText);

    const typedDate = parseFastContactsDateInput({
      text: nextText,
      dateFormat,
    });

    if (isDefined(typedDate)) {
      setCalendarDate(typedDate);
    }
  };

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
      close(() => onCommitText(text, move));
    }
  };

  // Focus moving into the calendar (month and year pickers) keeps the editor open.
  const handleBlur = () =>
    setTimeout(() => {
      if (!calendarRef.current?.contains(document.activeElement)) {
        close(() => onCommitText(text, 'none'));
      }
    });

  return (
    <StyledFastContactsEditorContainer>
      <StyledFastContactsEditorInput
        autoFocus
        aria-label={t`Date`}
        placeholder={inputMask.toLowerCase()}
        value={text}
        onChange={(event) => handleTextChange(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      />
      <Dropdown.Root
        type="panel"
        open
        onInteractOutside={(event) => {
          if (anchorRef.current?.contains(event.target)) {
            event.preventDefault();
          }
        }}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            close(() => onCommitText(text, 'none'));
          }
        }}
      >
        <Dropdown.Content
          ref={calendarRef}
          anchor={anchorRef}
          side="bottom"
          align="start"
          initialFocus={false}
          finalFocus={false}
          aria-label={t`Calendar`}
        >
          <DatePicker
            instanceId={instanceId}
            plainDateString={calendarDate}
            hideHeaderInput
            keyboardEventsDisabled
            onChange={setCalendarDate}
            onClose={(pickedDate) =>
              close(() => onCommitText(pickedDate ?? '', 'none'))
            }
          />
        </Dropdown.Content>
      </Dropdown.Root>
    </StyledFastContactsEditorContainer>
  );
};
