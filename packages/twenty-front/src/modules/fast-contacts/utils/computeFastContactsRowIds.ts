import { isDefined } from 'twenty-shared/utils';

import { type FastContactsCellFormatContext } from '@/fast-contacts/types/FastContactsCellFormatContext';
import { type FastContactsColumnKey } from '@/fast-contacts/types/FastContactsColumn';
import { type FastContactsPerson } from '@/fast-contacts/types/FastContactsPerson';
import { type FastContactsSheetLayout } from '@/fast-contacts/types/FastContactsSheetLayout';
import { type FastContactsTab } from '@/fast-contacts/types/FastContactsTab';
import { compareFastContactsPeopleByColumn } from '@/fast-contacts/utils/compareFastContactsPeopleByColumn';
import { matchesFastContactsColumnFilter } from '@/fast-contacts/utils/matchesFastContactsColumnFilter';

// `people` arrives in the default order (position, then id).
export const computeFastContactsRowIds = ({
  people,
  tab,
  layout,
  searchWords,
  searchTextByPersonId,
  formatContext,
}: {
  people: FastContactsPerson[];
  tab: FastContactsTab;
  layout: FastContactsSheetLayout;
  searchWords: string[];
  searchTextByPersonId: Map<string, string>;
  formatContext: FastContactsCellFormatContext;
}): string[] => {
  const filterEntries = Object.entries(layout.filters) as [
    FastContactsColumnKey,
    NonNullable<FastContactsSheetLayout['filters'][FastContactsColumnKey]>,
  ][];

  const matchingPeople = people.filter((person) => {
    if (!tab.includesPerson(person)) {
      return false;
    }

    const searchText = searchTextByPersonId.get(person.id) ?? '';

    if (!searchWords.every((searchWord) => searchText.includes(searchWord))) {
      return false;
    }

    return filterEntries.every(([columnKey, filter]) =>
      matchesFastContactsColumnFilter({
        person,
        columnKey,
        filter,
        formatContext,
      }),
    );
  });

  if (isDefined(layout.sort)) {
    matchingPeople.sort(
      compareFastContactsPeopleByColumn({ sort: layout.sort, formatContext }),
    );
  }

  return matchingPeople.map((person) => person.id);
};
