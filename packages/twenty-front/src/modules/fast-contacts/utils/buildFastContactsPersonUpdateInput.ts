import { type FastContactsCellValue } from '@/fast-contacts/types/FastContactsCellValue';
import { type FastContactsColumnKey } from '@/fast-contacts/types/FastContactsColumn';
import {
  type FastContactsCompany,
  type FastContactsOwner,
} from '@/fast-contacts/types/FastContactsPerson';

const withoutTypename = (value: FastContactsCellValue) => {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  const { __typename: _typename, ...rest } = value as Record<string, unknown>;

  return rest;
};

export const buildFastContactsPersonUpdateInput = (
  columnKey: FastContactsColumnKey,
  value: FastContactsCellValue,
): Record<string, unknown> => {
  switch (columnKey) {
    case 'company':
      return { companyId: (value as FastContactsCompany | null)?.id ?? null };
    case 'cadenceOwner':
      return {
        cadenceOwnerId: (value as FastContactsOwner | null)?.id ?? null,
      };
    default:
      return { [columnKey]: withoutTypename(value) };
  }
};
