import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { type FocusEvent, type KeyboardEvent, useRef, useState } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { themeCssVariables } from 'twenty-ui/theme';

import {
  StyledFastContactsEditorContainer,
  StyledFastContactsEditorInput,
} from '@/fast-contacts/components/cell-editors/FastContactsCellEditorStyles';
import { type FastContactsEditorMove } from '@/fast-contacts/types/FastContactsEditorMove';
import { formatFastContactsDateForInput } from '@/fast-contacts/utils/formatFastContactsDateForInput';
import { getFastContactsEditorMoveFromKey } from '@/fast-contacts/utils/getFastContactsEditorMoveFromKey';
import { parseFastContactsDateInput } from '@/fast-contacts/utils/parseFastContactsDateInput';
import { type DateFormat } from '@/localization/constants/DateFormat';
import { DatePicker } from '@/ui/input/components/internal/date/components/DatePicker';
import { getDateFormatStringForDatePickerInputMask } from '~/utils/date-utils';
import { useFastContactsEditorClose } from '@/fast-contacts/hooks/useFastContactsEditorClose';

const StyledEditor = styled(StyledFastContactsEditorContainer)`
  flex-direction: column;
`;

const StyledCalendar = styled.div`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  box-shadow: ${themeCssVariables.boxShadow.strong};
  left: 0;
  outline: none;
  position: absolute;
  top: 100%;
`;

type FastContactsDateCellEditorProps = {
  instanceId: string;
  value: string | null;
  initialText: string | null;
  dateFormat: DateFormat;
  onCommitText: (text: string, move: FastContactsEditorMove) => void;
  onCancel: () => void;
};

export const FastContactsDateCellEditor = ({
  instanceId,
  value,
  initialText,
  dateFormat,
  onCommitText,
  onCancel,
}: FastContactsDateCellEditorProps) => {
  const { t } = useLingui();
  const inputMask = getDateFormatStringForDatePickerInputMask(dateFormat);
  const containerRef = useRef<HTMLDivElement>(null);
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

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!containerRef.current?.contains(event.relatedTarget as Node | null)) {
      close(() => onCommitText(text, 'none'));
    }
  };

  return (
    <StyledEditor ref={containerRef} onBlur={handleBlur}>
      <StyledFastContactsEditorInput
        autoFocus
        aria-label={t`Date`}
        placeholder={inputMask.toLowerCase()}
        value={text}
        onChange={(event) => handleTextChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <StyledCalendar tabIndex={-1}>
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
      </StyledCalendar>
    </StyledEditor>
  );
};
