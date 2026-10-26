import { useLingui } from '@lingui/react/macro';
import { Dropdown } from 'twenty-ui/components/navigation';
import { IconColumns, IconRestore } from 'twenty-ui/icon';
import { Button } from 'twenty-ui/primitives/input';

import { type FastContactsColumnKey } from '@/fast-contacts/types/FastContactsColumn';
import { type FastContactsSheetLayout } from '@/fast-contacts/types/FastContactsSheetLayout';
import { getFastContactsColumn } from '@/fast-contacts/utils/getFastContactsColumn';

type FastContactsColumnsDropdownProps = {
  layout: FastContactsSheetLayout;
  onToggleColumn: (columnKey: FastContactsColumnKey) => void;
  onResetLayout: () => void;
};

export const FastContactsColumnsDropdown = ({
  layout,
  onToggleColumn,
  onResetLayout,
}: FastContactsColumnsDropdownProps) => {
  const { t, i18n } = useLingui();

  return (
    <Dropdown.Root type="menu" multiple>
      <Dropdown.Trigger
        render={
          <Button size="sm" variant="ghost" startIcon={<IconColumns />}>
            {t`Columns`}
          </Button>
        }
      />
      <Dropdown.Content aria-label={t`Columns`} width={240}>
        <Dropdown.Section scrollable>
          {layout.columnOrder.map((columnKey) => (
            <Dropdown.OptionItem
              key={columnKey}
              indicator="checkbox"
              closeOnSelect={false}
              disabled={columnKey === 'name'}
              selected={!layout.hiddenColumnKeys.includes(columnKey)}
              onSelect={() => onToggleColumn(columnKey)}
            >
              {i18n._(getFastContactsColumn(columnKey).label)}
            </Dropdown.OptionItem>
          ))}
        </Dropdown.Section>
        <Dropdown.Separator />
        <Dropdown.Section>
          <Dropdown.ActionItem
            startIcon={<IconRestore />}
            onClick={onResetLayout}
          >
            {t`Reset layout`}
          </Dropdown.ActionItem>
        </Dropdown.Section>
      </Dropdown.Content>
    </Dropdown.Root>
  );
};
