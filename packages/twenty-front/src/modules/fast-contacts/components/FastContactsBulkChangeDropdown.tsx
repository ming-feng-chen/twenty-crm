import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { Dropdown } from 'twenty-ui/components/navigation';
import { IconChevronDown, IconX } from 'twenty-ui/icon';
import { Button } from 'twenty-ui/primitives/input';

import { FAST_CONTACTS_BULK_CHANGE_COLUMN_KEYS } from '@/fast-contacts/constants/FastContactsBulkChangeColumnKeys';
import { type FastContactsCellValue } from '@/fast-contacts/types/FastContactsCellValue';
import {
  type FastContactsColumn,
  type FastContactsColumnKey,
} from '@/fast-contacts/types/FastContactsColumn';
import { type FastContactsEditContext } from '@/fast-contacts/types/FastContactsEditContext';
import { getFastContactsColumn } from '@/fast-contacts/utils/getFastContactsColumn';
import { getFastContactsColumnValueOptions } from '@/fast-contacts/utils/getFastContactsColumnValueOptions';
import { getFastContactsValueFromOptionKey } from '@/fast-contacts/utils/getFastContactsValueFromOptionKey';
import { normalizeFastContactsSearchText } from '@/fast-contacts/utils/normalizeFastContactsSearchText';
import { DatePicker } from '@/ui/input/components/internal/date/components/DatePicker';

type FastContactsBulkChangeDropdownProps = {
  editContext: FastContactsEditContext;
  editableColumnKeys: Set<string>;
  onApply: (
    columnKey: FastContactsColumnKey,
    value: FastContactsCellValue,
  ) => void;
};

const FastContactsBulkChangeValues = ({
  column,
  editContext,
  onApply,
}: {
  column: FastContactsColumn;
  editContext: FastContactsEditContext;
  onApply: (value: FastContactsCellValue) => void;
}) => {
  const { t } = useLingui();
  const [search, setSearch] = useState('');
  const [calendarDate, setCalendarDate] = useState<string | null>(null);

  if (column.kind === 'date') {
    return (
      <>
        <DatePicker
          instanceId={`fast-contacts-bulk-${column.key}`}
          plainDateString={calendarDate}
          keyboardEventsDisabled
          onChange={setCalendarDate}
          onClose={(pickedDate) => onApply(pickedDate)}
        />
        <Dropdown.Section>
          <Dropdown.ActionItem
            startIcon={<IconX />}
            onClick={() => onApply(null)}
          >
            {t`Clear date`}
          </Dropdown.ActionItem>
        </Dropdown.Section>
      </>
    );
  }

  if (column.kind === 'boolean') {
    return (
      <Dropdown.Section>
        <Dropdown.OptionItem onSelect={() => onApply(true)}>
          {t`Yes`}
        </Dropdown.OptionItem>
        <Dropdown.OptionItem onSelect={() => onApply(false)}>
          {t`No`}
        </Dropdown.OptionItem>
      </Dropdown.Section>
    );
  }

  const options = getFastContactsColumnValueOptions({
    column,
    editContext,
    includeBlank: !editContext.requiredColumnKeys.includes(column.key),
  }).filter((option) =>
    normalizeFastContactsSearchText(option.label).includes(
      normalizeFastContactsSearchText(search.trim()),
    ),
  );

  return (
    <>
      <Dropdown.Search
        aria-label={t`Search`}
        placeholder={t`Search`}
        value={search}
        onValueChange={setSearch}
      />
      <Dropdown.Section scrollable>
        {options.map((option) => (
          <Dropdown.OptionItem
            key={option.key ?? 'blank'}
            onSelect={() =>
              onApply(
                getFastContactsValueFromOptionKey({
                  column,
                  key: option.key,
                  editContext,
                }),
              )
            }
          >
            {option.label}
          </Dropdown.OptionItem>
        ))}
        {options.length === 0 && <Dropdown.Empty>{t`No match`}</Dropdown.Empty>}
      </Dropdown.Section>
    </>
  );
};

export const FastContactsBulkChangeDropdown = ({
  editContext,
  editableColumnKeys,
  onApply,
}: FastContactsBulkChangeDropdownProps) => {
  const { t, i18n } = useLingui();
  const [isOpen, setIsOpen] = useState(false);
  const columns = FAST_CONTACTS_BULK_CHANGE_COLUMN_KEYS.filter((columnKey) =>
    editableColumnKeys.has(columnKey),
  ).map(getFastContactsColumn);

  return (
    <Dropdown.Root type="menu" open={isOpen} onOpenChange={setIsOpen}>
      <Dropdown.Trigger
        render={
          <Button size="sm" variant="outline" endIcon={<IconChevronDown />}>
            {t`Change…`}
          </Button>
        }
      />
      <Dropdown.Content aria-label={t`Change selected contacts`} width={260}>
        <Dropdown.Page id="root">
          <Dropdown.Section>
            {columns.map((column) => (
              <Dropdown.ActionItem
                key={column.key}
                hasSubmenu
                page={column.key}
              >
                {i18n._(column.label)}
              </Dropdown.ActionItem>
            ))}
          </Dropdown.Section>
        </Dropdown.Page>
        {columns.map((column) => (
          <Dropdown.Page
            key={column.key}
            id={column.key}
            type={column.kind === 'date' ? 'panel' : 'picker'}
          >
            <Dropdown.Back>{i18n._(column.label)}</Dropdown.Back>
            <FastContactsBulkChangeValues
              column={column}
              editContext={editContext}
              onApply={(value) => {
                setIsOpen(false);
                onApply(column.key, value);
              }}
            />
          </Dropdown.Page>
        ))}
      </Dropdown.Content>
    </Dropdown.Root>
  );
};
