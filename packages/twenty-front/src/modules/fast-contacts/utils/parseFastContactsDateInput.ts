import { format, isValid, parse } from 'date-fns';
import { DATE_TYPE_FORMAT } from 'twenty-shared/constants';

import { DateFormat } from '@/localization/constants/DateFormat';
import { getDateFormatStringForDatePickerInputMask } from '~/utils/date-utils';

// The viewer's typing mask first, then ISO and the display formats, so a
// date copied from this grid or from a spreadsheet pastes back as the same day.
export const parseFastContactsDateInput = ({
  text,
  dateFormat,
}: {
  text: string;
  dateFormat: DateFormat;
}): string | null => {
  const trimmedText = text.trim();
  const candidateFormats = [
    getDateFormatStringForDatePickerInputMask(dateFormat).replace(
      /dd|MM/g,
      (token) => token[0],
    ),
    DATE_TYPE_FORMAT,
    ...(dateFormat === DateFormat.SYSTEM ? [] : [dateFormat]),
    DateFormat.DAY_FIRST,
    DateFormat.MONTH_FIRST,
  ];

  for (const candidateFormat of candidateFormats) {
    const parsedDate = parse(trimmedText, candidateFormat, new Date());

    if (isValid(parsedDate) && parsedDate.getFullYear() >= 1000) {
      return format(parsedDate, DATE_TYPE_FORMAT);
    }
  }

  return null;
};
