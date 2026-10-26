import { Trans, useLingui } from '@lingui/react/macro';
import { styled } from '@linaria/react';
import { type KeyboardEvent, type Ref } from 'react';
import { SearchInput } from 'twenty-ui/components/input';
import {
  IconArrowMerge,
  IconFileExport,
  IconFileImport,
  IconFilter,
  IconPlus,
  IconRefresh,
  IconTrash,
} from 'twenty-ui/icon';
import { Button } from 'twenty-ui/primitives/input';
import { themeCssVariables } from 'twenty-ui/theme';

import { FastContactsBulkChangeDropdown } from '@/fast-contacts/components/FastContactsBulkChangeDropdown';
import { FastContactsColumnsDropdown } from '@/fast-contacts/components/FastContactsColumnsDropdown';
import { FAST_CONTACTS_SEARCH_INPUT_FOCUS_ID } from '@/fast-contacts/constants/FastContactsSearchInputFocusId';
import { type FastContactsCellValue } from '@/fast-contacts/types/FastContactsCellValue';
import { type FastContactsColumnKey } from '@/fast-contacts/types/FastContactsColumn';
import { type FastContactsEditContext } from '@/fast-contacts/types/FastContactsEditContext';
import { type FastContactsTag } from '@/fast-contacts/types/FastContactsPerson';
import { type FastContactsSheetLayout } from '@/fast-contacts/types/FastContactsSheetLayout';
import { usePushFocusItemToFocusStack } from '@/ui/utilities/focus/hooks/usePushFocusItemToFocusStack';
import { useRemoveFocusItemFromFocusStackById } from '@/ui/utilities/focus/hooks/useRemoveFocusItemFromFocusStackById';
import { useRemoveFocusItemFromFocusStackOnUnmount } from '@/ui/utilities/focus/hooks/useRemoveFocusItemFromFocusStackOnUnmount';
import { FocusComponentType } from '@/ui/utilities/focus/types/FocusComponentType';

const StyledToolbar = styled.div`
  align-items: center;
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
`;

const StyledSearchContainer = styled.div`
  width: 240px;
`;

const StyledCount = styled.div`
  color: ${themeCssVariables.font.color.secondary};
  white-space: nowrap;
`;

const StyledFilteredBadge = styled.div`
  align-items: center;
  color: ${themeCssVariables.color.blue};
  display: flex;
  gap: ${themeCssVariables.spacing[1]};
  white-space: nowrap;
`;

const StyledSpacer = styled.div`
  flex: 1;
`;

type FastContactsToolbarProps = {
  searchInputRef: Ref<HTMLInputElement>;
  searchText: string;
  onSearchTextChange: (searchText: string) => void;
  onSearchEscape: () => void;
  shownCount: number;
  totalCount: number;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  selectedRowCount: number;
  layout: FastContactsSheetLayout;
  editContext: FastContactsEditContext;
  editableColumnKeys: Set<string>;
  canCreateContacts: boolean;
  canDeleteContacts: boolean;
  canMergeContacts: boolean;
  isDeletedSheet: boolean;
  onNewContact: () => void;
  onImport: () => void;
  onDelete: () => void;
  onRestore: () => void;
  onMerge: () => void;
  onToggleColumn: (columnKey: FastContactsColumnKey) => void;
  onResetLayout: () => void;
  onExport: () => void;
  onBulkChange: (
    columnKey: FastContactsColumnKey,
    value: FastContactsCellValue,
  ) => void;
  onBulkTagChange: (mode: 'add' | 'remove', tag: FastContactsTag) => void;
};

export const FastContactsToolbar = ({
  searchInputRef,
  searchText,
  onSearchTextChange,
  onSearchEscape,
  shownCount,
  totalCount,
  hasActiveFilters,
  onClearFilters,
  selectedRowCount,
  layout,
  editContext,
  editableColumnKeys,
  canCreateContacts,
  canDeleteContacts,
  canMergeContacts,
  isDeletedSheet,
  onNewContact,
  onImport,
  onDelete,
  onRestore,
  onMerge,
  onToggleColumn,
  onResetLayout,
  onExport,
  onBulkChange,
  onBulkTagChange,
}: FastContactsToolbarProps) => {
  const { t } = useLingui();
  const { pushFocusItemToFocusStack } = usePushFocusItemToFocusStack();
  const { removeFocusItemFromFocusStackById } =
    useRemoveFocusItemFromFocusStackById();
  const hiddenCount = Math.max(totalCount - shownCount, 0);

  useRemoveFocusItemFromFocusStackOnUnmount({
    focusId: FAST_CONTACTS_SEARCH_INPUT_FOCUS_ID,
    isEnabled: true,
  });

  // Letters typed in the search box must not trigger the app's global hotkeys.
  const handleFocus = () =>
    pushFocusItemToFocusStack({
      focusId: FAST_CONTACTS_SEARCH_INPUT_FOCUS_ID,
      component: {
        type: FocusComponentType.TEXT_INPUT,
        instanceId: FAST_CONTACTS_SEARCH_INPUT_FOCUS_ID,
      },
      globalHotkeysConfig: {
        enableGlobalHotkeysConflictingWithKeyboard: false,
      },
    });

  const handleBlur = () =>
    removeFocusItemFromFocusStackById({
      focusId: FAST_CONTACTS_SEARCH_INPUT_FOCUS_ID,
    });

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onSearchEscape();
    }
  };

  return (
    <StyledToolbar>
      <StyledSearchContainer>
        <SearchInput
          ref={searchInputRef}
          size="sm"
          placeholder={t`Search this sheet`}
          value={searchText}
          onValueChange={(value) => onSearchTextChange(value)}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
      </StyledSearchContainer>
      <StyledCount>
        <Trans>
          Showing {shownCount} of {totalCount}
        </Trans>
      </StyledCount>
      {hasActiveFilters && (
        <>
          <StyledFilteredBadge>
            <IconFilter size={14} />
            <Trans>Filtered: {hiddenCount} hidden</Trans>
          </StyledFilteredBadge>
          <Button size="sm" variant="link" onClick={onClearFilters}>
            <Trans>Clear filters</Trans>
          </Button>
        </>
      )}
      <StyledSpacer />
      {selectedRowCount > 0 && (
        <>
          <StyledCount>
            <Trans>{selectedRowCount} selected</Trans>
          </StyledCount>
          {isDeletedSheet ? (
            canDeleteContacts && (
              <Button
                size="sm"
                variant="ghost"
                startIcon={<IconRefresh />}
                onClick={onRestore}
              >
                <Trans>Restore</Trans>
              </Button>
            )
          ) : (
            <>
              <FastContactsBulkChangeDropdown
                editContext={editContext}
                editableColumnKeys={editableColumnKeys}
                onApply={onBulkChange}
                onApplyTag={onBulkTagChange}
              />
              {canMergeContacts && selectedRowCount >= 2 && (
                <Button
                  size="sm"
                  variant="ghost"
                  startIcon={<IconArrowMerge />}
                  onClick={onMerge}
                >
                  <Trans>Merge</Trans>
                </Button>
              )}
              {canDeleteContacts && (
                <Button
                  size="sm"
                  variant="ghost"
                  color="danger"
                  startIcon={<IconTrash />}
                  onClick={onDelete}
                >
                  <Trans>Delete</Trans>
                </Button>
              )}
            </>
          )}
        </>
      )}
      {canCreateContacts && !isDeletedSheet && (
        <>
          <Button
            size="sm"
            variant="ghost"
            startIcon={<IconPlus />}
            onClick={onNewContact}
          >
            <Trans>New contact</Trans>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            startIcon={<IconFileImport />}
            onClick={onImport}
          >
            <Trans>Import</Trans>
          </Button>
        </>
      )}
      <FastContactsColumnsDropdown
        layout={layout}
        onToggleColumn={onToggleColumn}
        onResetLayout={onResetLayout}
      />
      <Button
        size="sm"
        variant="ghost"
        startIcon={<IconFileExport />}
        onClick={onExport}
      >
        {selectedRowCount > 0 ? (
          <Trans>Export selected</Trans>
        ) : (
          <Trans>Export</Trans>
        )}
      </Button>
    </StyledToolbar>
  );
};
