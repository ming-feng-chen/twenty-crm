import { format, parse } from 'date-fns';
import { DATE_TYPE_FORMAT } from 'twenty-shared/constants';
import { isDefined } from 'twenty-shared/utils';

import { type DateFormat } from '@/localization/constants/DateFormat';
import { getDateFormatStringForDatePickerInputMask } from '~/utils/date-utils';

export const formatFastContactsDateForInput = ({
  date,
  dateFormat,
}: {
  date: string | null;
  dateFormat: DateFormat;
}): string =>
  isDefined(date)
    ? format(
        parse(date, DATE_TYPE_FORMAT, new Date()),
        getDateFormatStringForDatePickerInputMask(dateFormat),
      )
    : '';
