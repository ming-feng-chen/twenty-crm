import { parsePhoneNumber } from 'libphonenumber-js';

import { createPhonesFromFieldValue } from '@/object-record/record-field/ui/meta-types/input/utils/phonesUtils';
import { type FieldPhonesValue } from '@/object-record/record-field/ui/types/FieldMetadata';

// International format, as PhonesDisplay shows it; an unparsable number is kept as stored.
export const formatFastContactsPhones = (
  phones: FieldPhonesValue | null,
): string[] =>
  phones === null
    ? []
    : createPhonesFromFieldValue(phones).map(({ number, callingCode }) => {
        try {
          return parsePhoneNumber(callingCode + number).formatInternational();
        } catch {
          return callingCode + number;
        }
      });
