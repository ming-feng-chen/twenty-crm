import { Trans, useLingui } from '@lingui/react/macro';
import { styled } from '@linaria/react';
import { type KeyboardEvent, type Ref } from 'react';
import { SearchInput } from 'twenty-ui/components/input';
import { Button } from 'twenty-ui/primitives/input';
import { themeCssVariables } from 'twenty-ui/theme';

import { FAST_CONTACTS_SEARCH_INPUT_FOCUS_ID } from '@/fast-contacts/constants/FastContactsSearchInputFocusId';
import { usePushFocusItemToFocusStack } from '@/ui/utilities/focus/hooks/usePushFocusItemToFocusStack';
import { useRemoveFocusItemFromFocusStackById } from '@/ui/utilities/focus/hooks/useRemoveFocusItemFromFocusStackById';
import { useRemoveFocusItemFromFocusStackOnUnmount } from '@/ui/utilities/focus/hooks/useRemoveFocusItemFromFocusStackOnUnmount';
import { FocusComponentType } from '@/ui/utilities/focus/types/FocusComponentType';

const StyledToolbar = styled.div`
  align-items: center;
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  gap: ${themeCssVariables.spacing[3]};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
`;

const StyledSearchContainer = styled.div`
  width: 280px;
`;

const StyledShowingCount = styled.div`
  color: ${themeCssVariables.font.color.secondary};
  white-space: nowrap;
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
}: FastContactsToolbarProps) => {
  const { t } = useLingui();
  const { pushFocusItemToFocusStack } = usePushFocusItemToFocusStack();
  const { removeFocusItemFromFocusStackById } =
    useRemoveFocusItemFromFocusStackById();

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
          placeholder={t`Search this table`}
          value={searchText}
          onValueChange={(value) => onSearchTextChange(value)}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
      </StyledSearchContainer>
      <StyledShowingCount>
        <Trans>
          Showing {shownCount} of {totalCount}
        </Trans>
      </StyledShowingCount>
      {hasActiveFilters && (
        <Button size="sm" variant="link" onClick={onClearFilters}>
          <Trans>Clear filters</Trans>
        </Button>
      )}
    </StyledToolbar>
  );
};
