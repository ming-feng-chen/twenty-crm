import { Trans } from '@lingui/react/macro';
import { styled } from '@linaria/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppPath, CoreObjectNameSingular } from 'twenty-shared/types';
import { Button } from 'twenty-ui/primitives/input';
import { themeCssVariables } from 'twenty-ui/theme';

import { FastContactsGrid } from '@/fast-contacts/components/FastContactsGrid';
import { FastContactsTabBar } from '@/fast-contacts/components/FastContactsTabBar';
import { FastContactsToolbar } from '@/fast-contacts/components/FastContactsToolbar';
import { FAST_CONTACTS_TABS } from '@/fast-contacts/constants/FastContactsTabs';
import { useFastContactsCellFormatContext } from '@/fast-contacts/hooks/useFastContactsCellFormatContext';
import { useFastContactsPeople } from '@/fast-contacts/hooks/useFastContactsPeople';
import { fastContactsActiveTabState } from '@/fast-contacts/states/fastContactsActiveTabState';
import { type FastContactsTabKey } from '@/fast-contacts/types/FastContactsTab';
import {
  filterFastContactsPeople,
  getFastContactsSearchWords,
} from '@/fast-contacts/utils/filterFastContactsPeople';
import { getFastContactsSearchTextByPersonId } from '@/fast-contacts/utils/getFastContactsSearchTextByPersonId';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';
import { useNavigateApp } from '~/hooks/useNavigateApp';

const StyledContainer = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
`;

const StyledMessage = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.secondary};
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[4]};
`;

const EMPTY_SEARCH_TEXT_BY_TAB_KEY: Record<FastContactsTabKey, string> = {
  all: '',
  partner: '',
  airport: '',
};

export const FastContactsPageContent = () => {
  const navigateApp = useNavigateApp();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const gridViewportRef = useRef<HTMLDivElement>(null);

  const { people, loadStatus, personObjectMetadataItem, reloadPeople } =
    useFastContactsPeople();
  const formatContext = useFastContactsCellFormatContext(
    personObjectMetadataItem,
  );

  const [fastContactsActiveTab, setFastContactsActiveTab] = useAtomState(
    fastContactsActiveTabState,
  );
  const [searchTextByTabKey, setSearchTextByTabKey] = useState(
    EMPTY_SEARCH_TEXT_BY_TAB_KEY,
  );

  const activeTab =
    FAST_CONTACTS_TABS.find((tab) => tab.key === fastContactsActiveTab) ??
    FAST_CONTACTS_TABS[0];
  const searchText = searchTextByTabKey[activeTab.key];
  const searchWords = useMemo(
    () => getFastContactsSearchWords(searchText),
    [searchText],
  );

  const searchTextByPersonId = useMemo(
    () => getFastContactsSearchTextByPersonId({ people, formatContext }),
    [people, formatContext],
  );

  const countByTabKey = useMemo(
    () =>
      Object.fromEntries(
        FAST_CONTACTS_TABS.map((tab) => [
          tab.key,
          filterFastContactsPeople({
            people,
            companyGroup: tab.companyGroup,
            searchWords: [],
            searchTextByPersonId,
          }).length,
        ]),
      ) as Record<FastContactsTabKey, number>,
    [people, searchTextByPersonId],
  );

  const shownPeople = useMemo(
    () =>
      filterFastContactsPeople({
        people,
        companyGroup: activeTab.companyGroup,
        searchWords,
        searchTextByPersonId,
      }),
    [people, activeTab.companyGroup, searchWords, searchTextByPersonId],
  );

  // Ctrl+F searches this table instead of opening the browser's find bar.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === 'f'
      ) {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearchTextChange = (nextSearchText: string) =>
    setSearchTextByTabKey({
      ...searchTextByTabKey,
      [activeTab.key]: nextSearchText,
    });

  const handleSearchEscape = () => {
    handleSearchTextChange('');
    gridViewportRef.current?.focus();
  };

  const handleOpenPerson = (personId: string) =>
    navigateApp(AppPath.RecordShowPage, {
      objectNameSingular: CoreObjectNameSingular.Person,
      objectRecordId: personId,
    });

  if (loadStatus === 'loading' && people.length === 0) {
    return (
      <StyledMessage>
        <Trans>Loading contacts...</Trans>
      </StyledMessage>
    );
  }

  return (
    <StyledContainer>
      {loadStatus === 'failed' && (
        <StyledMessage>
          {people.length === 0 ? (
            <Trans>Contacts could not be loaded.</Trans>
          ) : (
            <Trans>
              Contacts could not be refreshed and may be out of date.
            </Trans>
          )}
          <Button size="sm" onClick={() => void reloadPeople()}>
            <Trans>Retry</Trans>
          </Button>
        </StyledMessage>
      )}
      <FastContactsToolbar
        searchInputRef={searchInputRef}
        searchText={searchText}
        onSearchTextChange={handleSearchTextChange}
        onSearchEscape={handleSearchEscape}
        shownCount={shownPeople.length}
        totalCount={countByTabKey[activeTab.key]}
        hasActiveFilters={searchWords.length > 0}
        onClearFilters={handleSearchEscape}
      />
      <FastContactsGrid
        key={activeTab.key}
        viewportRef={gridViewportRef}
        people={shownPeople}
        formatContext={formatContext}
        onOpenPerson={handleOpenPerson}
      />
      <FastContactsTabBar
        activeTabKey={activeTab.key}
        countByTabKey={countByTabKey}
        onTabChange={setFastContactsActiveTab}
      />
    </StyledContainer>
  );
};
