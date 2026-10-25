import { isDefined } from 'twenty-shared/utils';

import { type FastContactsPerson } from '@/fast-contacts/types/FastContactsPerson';
import { normalizeFastContactsSearchText } from '@/fast-contacts/utils/normalizeFastContactsSearchText';

export const getFastContactsSearchWords = (searchText: string): string[] =>
  normalizeFastContactsSearchText(searchText).split(/\s+/).filter(Boolean);

export const filterFastContactsPeople = ({
  people,
  companyGroup,
  searchWords,
  searchTextByPersonId,
}: {
  people: FastContactsPerson[];
  companyGroup: string | null;
  searchWords: string[];
  searchTextByPersonId: Map<string, string>;
}): FastContactsPerson[] =>
  people.filter((person) => {
    if (isDefined(companyGroup) && person.company?.group !== companyGroup) {
      return false;
    }

    const searchText = searchTextByPersonId.get(person.id) ?? '';

    return searchWords.every((searchWord) => searchText.includes(searchWord));
  });
