import { t } from '@lingui/core/macro';

import { type FastContactsColumn } from '@/fast-contacts/types/FastContactsColumn';
import { type FastContactsEditContext } from '@/fast-contacts/types/FastContactsEditContext';
import { type FastContactsPickerOption } from '@/fast-contacts/types/FastContactsPickerOption';
import { formatFastContactsFullName } from '@/fast-contacts/utils/formatFastContactsFullName';

// The choices a dropdown, Owner or Company column offers, blank first.
export const getFastContactsColumnValueOptions = ({
  column,
  editContext,
  includeBlank,
}: {
  column: FastContactsColumn;
  editContext: FastContactsEditContext;
  includeBlank: boolean;
}): FastContactsPickerOption[] => {
  const blankOptions = includeBlank ? [{ key: null, label: t`(Blank)` }] : [];

  switch (column.kind) {
    case 'select':
      return [
        ...blankOptions,
        ...(
          editContext.formatContext.selectOptionsByColumnKey[column.key] ?? []
        ).map((option) => ({ key: option.value, label: option.label })),
      ];
    case 'owner':
      return [
        ...blankOptions,
        ...editContext.members.map((member) => ({
          key: member.id,
          label: formatFastContactsFullName(member.name),
        })),
      ];
    case 'company':
      return [
        ...blankOptions,
        ...editContext.companies.map((company) => ({
          key: company.id,
          label: company.name ?? '',
        })),
      ];
    case 'tags':
      return [
        ...blankOptions,
        ...editContext.tags.map((tag) => ({
          key: tag.id,
          label: tag.name ?? '',
        })),
      ];
    default:
      return [];
  }
};
