import { useLingui } from '@lingui/react/macro';
import { isDefined } from 'twenty-shared/utils';
import { Dropdown } from 'twenty-ui/components/navigation';
import {
  IconEyeOff,
  IconFilter,
  IconPin,
  IconPinnedOff,
  IconSortAscending,
  IconSortDescending,
  IconX,
} from 'twenty-ui/icon';

import { FastContactsColumnFilterPage } from '@/fast-contacts/components/FastContactsColumnFilterPage';
import { type FastContactsColumnFilter } from '@/fast-contacts/types/FastContactsColumnFilter';
import { type FastContactsColumn } from '@/fast-contacts/types/FastContactsColumn';
import { type FastContactsEditContext } from '@/fast-contacts/types/FastContactsEditContext';
import { type FastContactsSortDirection } from '@/fast-contacts/types/FastContactsSheetLayout';

export type FastContactsColumnMenuAnchor =
  | HTMLElement
  | { getBoundingClientRect: () => DOMRect };

type FastContactsColumnMenuProps = {
  column: FastContactsColumn;
  anchor: FastContactsColumnMenuAnchor;
  sortDirection: FastContactsSortDirection | null;
  filter: FastContactsColumnFilter | undefined;
  canFreezeUpToHere: boolean;
  canUnfreeze: boolean;
  editContext: FastContactsEditContext;
  onClose: () => void;
  onSort: (direction: FastContactsSortDirection | null) => void;
  onFilterChange: (filter: FastContactsColumnFilter | null) => void;
  onHide: () => void;
  onFreezeUpToHere: () => void;
  onUnfreeze: () => void;
};

export const FastContactsColumnMenu = ({
  column,
  anchor,
  sortDirection,
  filter,
  canFreezeUpToHere,
  canUnfreeze,
  editContext,
  onClose,
  onSort,
  onFilterChange,
  onHide,
  onFreezeUpToHere,
  onUnfreeze,
}: FastContactsColumnMenuProps) => {
  const { t, i18n } = useLingui();
  const columnLabel = i18n._(column.label);

  return (
    <Dropdown.Root
      type="menu"
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}
    >
      <Dropdown.Content
        anchor={anchor}
        side="bottom"
        align="start"
        aria-label={t`${columnLabel} column`}
        width={240}
      >
        <Dropdown.Page id="root">
          <Dropdown.Section>
            <Dropdown.ActionItem
              startIcon={<IconSortAscending />}
              onClick={() => onSort('asc')}
            >
              {t`Sort A to Z`}
            </Dropdown.ActionItem>
            <Dropdown.ActionItem
              startIcon={<IconSortDescending />}
              onClick={() => onSort('desc')}
            >
              {t`Sort Z to A`}
            </Dropdown.ActionItem>
            {isDefined(sortDirection) && (
              <Dropdown.ActionItem
                startIcon={<IconX />}
                onClick={() => onSort(null)}
              >
                {t`Remove sort`}
              </Dropdown.ActionItem>
            )}
          </Dropdown.Section>
          <Dropdown.Separator />
          <Dropdown.Section>
            <Dropdown.ActionItem
              startIcon={<IconFilter />}
              hasSubmenu
              page="filter"
            >
              {isDefined(filter) ? t`Filter (on)` : t`Filter`}
            </Dropdown.ActionItem>
            {isDefined(filter) && (
              <Dropdown.ActionItem
                startIcon={<IconX />}
                onClick={() => onFilterChange(null)}
              >
                {t`Remove filter`}
              </Dropdown.ActionItem>
            )}
          </Dropdown.Section>
          <Dropdown.Separator />
          <Dropdown.Section>
            {column.key !== 'name' && (
              <Dropdown.ActionItem startIcon={<IconEyeOff />} onClick={onHide}>
                {t`Hide column`}
              </Dropdown.ActionItem>
            )}
            {canFreezeUpToHere && (
              <Dropdown.ActionItem
                startIcon={<IconPin />}
                onClick={onFreezeUpToHere}
              >
                {t`Freeze up to here`}
              </Dropdown.ActionItem>
            )}
            {canUnfreeze && (
              <Dropdown.ActionItem
                startIcon={<IconPinnedOff />}
                onClick={onUnfreeze}
              >
                {t`Unfreeze`}
              </Dropdown.ActionItem>
            )}
          </Dropdown.Section>
        </Dropdown.Page>
        <Dropdown.Page id="filter" type="panel">
          <Dropdown.Back>{t`Filter ${columnLabel}`}</Dropdown.Back>
          <FastContactsColumnFilterPage
            column={column}
            filter={filter}
            editContext={editContext}
            onFilterChange={onFilterChange}
          />
        </Dropdown.Page>
      </Dropdown.Content>
    </Dropdown.Root>
  );
};
