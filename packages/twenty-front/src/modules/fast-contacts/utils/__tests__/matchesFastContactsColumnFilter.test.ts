import {
  buildFastContactsTestPerson,
  FAST_CONTACTS_TEST_FORMAT_CONTEXT,
} from '@/fast-contacts/testing/fastContactsTestData';
import { matchesFastContactsColumnFilter } from '@/fast-contacts/utils/matchesFastContactsColumnFilter';

const matchesTags = (personTagIds: string[], values: (string | null)[]) =>
  matchesFastContactsColumnFilter({
    person: buildFastContactsTestPerson({
      tags: personTagIds.map((id) => ({ id, name: id, color: null })),
    }),
    columnKey: 'tags',
    filter: { type: 'values', values },
    formatContext: FAST_CONTACTS_TEST_FORMAT_CONTEXT,
  });

describe('matchesFastContactsColumnFilter', () => {
  it('should keep a person with any of the ticked tags', () => {
    expect(matchesTags(['tag-1', 'tag-2'], ['tag-2'])).toBe(true);
    expect(matchesTags(['tag-1'], ['tag-2'])).toBe(false);
  });

  it('should treat (Blank) as having no tags', () => {
    expect(matchesTags([], [null])).toBe(true);
    expect(matchesTags(['tag-1'], [null])).toBe(false);
  });
});
