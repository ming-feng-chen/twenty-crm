import { useLingui } from '@lingui/react/macro';
import { isNonEmptyArray, isNonEmptyString } from '@sniptt/guards';
import { type RefObject, useState } from 'react';
import { Dropdown } from 'twenty-ui/components/navigation';
import { IconPlus } from 'twenty-ui/icon';

import { type FastContactsPickerOption } from '@/fast-contacts/types/FastContactsPickerOption';
import { normalizeFastContactsSearchText } from '@/fast-contacts/utils/normalizeFastContactsSearchText';
import { useFastContactsEditorClose } from '@/fast-contacts/hooks/useFastContactsEditorClose';

type FastContactsPickerCellEditorProps = {
  anchorRef: RefObject<HTMLElement | null>;
  ariaLabel: string;
  options: FastContactsPickerOption[];
  selectedKey: string | null;
  initialSearch: string;
  createLabel?: (search: string) => string;
  onSelect: (key: string | null) => void;
  onCreate?: (search: string) => void;
  onCancel: () => void;
};

export const FastContactsPickerCellEditor = ({
  anchorRef,
  ariaLabel,
  options,
  selectedKey,
  initialSearch,
  createLabel,
  onSelect,
  onCreate,
  onCancel,
}: FastContactsPickerCellEditorProps) => {
  const { t } = useLingui();
  const [search, setSearch] = useState(initialSearch);
  const close = useFastContactsEditorClose();

  const normalizedSearch = normalizeFastContactsSearchText(search.trim());
  const filteredOptions = options.filter((option) =>
    normalizeFastContactsSearchText(option.label).includes(normalizedSearch),
  );
  const hasExactMatch = options.some(
    (option) =>
      normalizeFastContactsSearchText(option.label) === normalizedSearch,
  );
  const canCreate =
    onCreate !== undefined && isNonEmptyString(search.trim()) && !hasExactMatch;

  return (
    <Dropdown.Root
      type="picker"
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          close(onCancel);
        }
      }}
    >
      <Dropdown.Content
        anchor={anchorRef}
        side="bottom"
        align="start"
        aria-label={ariaLabel}
        width={260}
      >
        <Dropdown.Search
          autoFocus
          aria-label={t`Search`}
          placeholder={t`Search`}
          value={search}
          onValueChange={setSearch}
        />
        <Dropdown.Section scrollable>
          {filteredOptions.map((option) => (
            <Dropdown.OptionItem
              key={option.key ?? 'blank'}
              selected={option.key === selectedKey}
              onSelect={() => close(() => onSelect(option.key))}
            >
              {option.label}
            </Dropdown.OptionItem>
          ))}
          {canCreate && (
            <Dropdown.ActionItem
              startIcon={<IconPlus />}
              onClick={() => close(() => onCreate(search.trim()))}
            >
              {createLabel?.(search.trim()) ?? search.trim()}
            </Dropdown.ActionItem>
          )}
          {!isNonEmptyArray(filteredOptions) && !canCreate && (
            <Dropdown.Empty>{t`No match`}</Dropdown.Empty>
          )}
        </Dropdown.Section>
      </Dropdown.Content>
    </Dropdown.Root>
  );
};
