import { type FastContactsPerson } from '@/fast-contacts/types/FastContactsPerson';
import {
  filterFastContactsPeople,
  getFastContactsSearchWords,
} from '@/fast-contacts/utils/filterFastContactsPeople';

const buildPerson = (id: string, group: string | null) =>
  ({
    id,
    company: group === null ? null : { id: `company-${id}`, name: '', group },
  }) as FastContactsPerson;

const PEOPLE = [
  buildPerson('borja', 'AIRPORT'),
  buildPerson('vishal', 'PARTNER'),
  buildPerson('no-company', null),
];

const SEARCH_TEXT_BY_PERSON_ID = new Map([
  ['borja', 'borja garcia garcia\nhuesca airport'],
  ['vishal', 'vishal sharma\nexecutive assistant'],
  ['no-company', 'someone'],
]);

const filterIds = (companyGroup: string | null, searchText: string) =>
  filterFastContactsPeople({
    people: PEOPLE,
    companyGroup,
    searchWords: getFastContactsSearchWords(searchText),
    searchTextByPersonId: SEARCH_TEXT_BY_PERSON_ID,
  }).map((person) => person.id);

describe('filterFastContactsPeople', () => {
  it('should keep everyone on the All tab with an empty search', () => {
    expect(filterIds(null, '  ')).toEqual(['borja', 'vishal', 'no-company']);
  });

  it("should keep only the tab's company group", () => {
    expect(filterIds('PARTNER', '')).toEqual(['vishal']);
    expect(filterIds('AIRPORT', '')).toEqual(['borja']);
  });

  it('should match every word anywhere in the row, ignoring case and accents', () => {
    expect(filterIds(null, 'GARCÍA  Huesca')).toEqual(['borja']);
    expect(filterIds(null, 'garcia sharma')).toEqual([]);
  });

  it('should apply the search inside the active tab only', () => {
    expect(filterIds('PARTNER', 'garcia')).toEqual([]);
  });
});
