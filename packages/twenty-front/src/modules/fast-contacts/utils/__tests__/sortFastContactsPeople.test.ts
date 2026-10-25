import { type FastContactsPerson } from '@/fast-contacts/types/FastContactsPerson';
import { sortFastContactsPeople } from '@/fast-contacts/utils/sortFastContactsPeople';

const buildPerson = (id: string, position: number | null) =>
  ({ id, position }) as FastContactsPerson;

describe('sortFastContactsPeople', () => {
  it('should sort like the people query: nulls first, then position, then id', () => {
    const sorted = sortFastContactsPeople([
      buildPerson('c', 2),
      buildPerson('b', 1),
      buildPerson('a', 1),
      buildPerson('d', null),
    ]);

    expect(sorted.map((person) => person.id)).toEqual(['d', 'a', 'b', 'c']);
  });
});
