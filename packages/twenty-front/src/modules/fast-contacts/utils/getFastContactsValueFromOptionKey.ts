import { type FastContactsCellValue } from '@/fast-contacts/types/FastContactsCellValue';
import { type FastContactsColumn } from '@/fast-contacts/types/FastContactsColumn';
import { type FastContactsEditContext } from '@/fast-contacts/types/FastContactsEditContext';

// Turns a picked option (value, member id or company id) back into what the column stores.
export const getFastContactsValueFromOptionKey = ({
  column,
  key,
  editContext,
}: {
  column: FastContactsColumn;
  key: string | null;
  editContext: FastContactsEditContext;
}): FastContactsCellValue => {
  if (column.kind === 'owner') {
    const member = editContext.members.find(
      (candidate) => candidate.id === key,
    );

    return member === undefined ? null : { id: member.id, name: member.name };
  }

  if (column.kind === 'company') {
    return editContext.companies.find((company) => company.id === key) ?? null;
  }

  return key;
};
