import { isNonEmptyString } from '@sniptt/guards';

import { type FieldFullNameValue } from '@/object-record/record-field/ui/types/FieldMetadata';

export const formatFastContactsFullName = (
  fullName: FieldFullNameValue | null | undefined,
): string =>
  [fullName?.firstName, fullName?.lastName].filter(isNonEmptyString).join(' ');
