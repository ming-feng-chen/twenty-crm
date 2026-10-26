import { FAST_CONTACTS_TABS } from '@/fast-contacts/constants/FastContactsTabs';
import {
  buildFastContactsTestPerson,
  FAST_CONTACTS_TEST_FORMAT_CONTEXT,
} from '@/fast-contacts/testing/fastContactsTestData';
import { type FastContactsSheetLayout } from '@/fast-contacts/types/FastContactsSheetLayout';
import {
  type FastContactsTab,
  type FastContactsTabKey,
} from '@/fast-contacts/types/FastContactsTab';
import { computeFastContactsRowIds } from '@/fast-contacts/utils/computeFastContactsRowIds';
import { getDefaultFastContactsSheetLayout } from '@/fast-contacts/utils/getDefaultFastContactsSheetLayout';
import { getFastContactsSearchTextByPersonId } from '@/fast-contacts/utils/getFastContactsSearchTextByPersonId';
import { getFastContactsSearchWords } from '@/fast-contacts/utils/getFastContactsSearchWords';

const PEOPLE = [
  buildFastContactsTestPerson({
    id: 'ada',
    name: { firstName: 'Ada', lastName: 'Lovelace' },
    cadenceStage: 'CONTACTED_NO_REPLY',
    nextActionDate: '2026-10-24',
  }),
  buildFastContactsTestPerson({
    id: 'bob',
    name: { firstName: 'Bob', lastName: 'Brown' },
    company: { id: 'company-2', name: 'Heathrow', group: 'AIRPORT' },
    cadenceStage: 'NOT_CONTACTED',
    nextActionDate: null,
    cadenceOwner: null,
  }),
  buildFastContactsTestPerson({
    id: 'cy',
    name: { firstName: 'Cy', lastName: 'García' },
    company: null,
    cadenceStage: 'DEAD',
    nextActionDate: null,
    optedOut: true,
  }),
  buildFastContactsTestPerson({
    id: 'di',
    name: { firstName: 'Di', lastName: 'Aaron' },
    company: { id: 'company-2', name: 'Heathrow', group: 'AIRPORT' },
    cadenceStage: 'PILOT_AGREED',
    nextActionDate: '2026-11-02',
  }),
];

const compute = ({
  tabKey = 'all',
  layout = {},
  searchText = '',
}: {
  tabKey?: FastContactsTabKey;
  layout?: Partial<FastContactsSheetLayout>;
  searchText?: string;
}) =>
  computeFastContactsRowIds({
    people: PEOPLE,
    tab: FAST_CONTACTS_TABS.find(
      (tab) => tab.key === tabKey,
    ) as FastContactsTab,
    layout: { ...getDefaultFastContactsSheetLayout(), ...layout },
    searchWords: getFastContactsSearchWords(searchText),
    searchTextByPersonId: getFastContactsSearchTextByPersonId({
      people: PEOPLE,
      formatContext: FAST_CONTACTS_TEST_FORMAT_CONTEXT,
    }),
    formatContext: FAST_CONTACTS_TEST_FORMAT_CONTEXT,
  });

describe('computeFastContactsRowIds', () => {
  it('should keep the default order with no sort', () => {
    expect(compute({})).toEqual(['ada', 'bob', 'cy', 'di']);
  });

  it('should split people into sheets by company group', () => {
    expect(compute({ tabKey: 'partner' })).toEqual(['ada']);
    expect(compute({ tabKey: 'airport' })).toEqual(['bob', 'di']);
  });

  it('should show live contacts with no next action date on the Cold sheet', () => {
    expect(compute({ tabKey: 'cold' })).toEqual(['bob']);
  });

  it('should search without accents', () => {
    expect(compute({ searchText: 'garcia' })).toEqual(['cy']);
  });

  it('should sort text both ways', () => {
    const sort = { columnKey: 'name' as const, direction: 'asc' as const };

    expect(compute({ layout: { sort } })).toEqual(['ada', 'bob', 'cy', 'di']);
    expect(
      compute({ layout: { sort: { ...sort, direction: 'desc' } } }),
    ).toEqual(['di', 'cy', 'bob', 'ada']);
  });

  it('should sort a dropdown by option order, not alphabetically', () => {
    expect(
      compute({
        layout: { sort: { columnKey: 'cadenceStage', direction: 'asc' } },
      }),
    ).toEqual(['bob', 'ada', 'di', 'cy']);
  });

  it('should put blanks last in both directions', () => {
    expect(
      compute({
        layout: { sort: { columnKey: 'nextActionDate', direction: 'asc' } },
      }),
    ).toEqual(['ada', 'di', 'bob', 'cy']);
    expect(
      compute({
        layout: { sort: { columnKey: 'nextActionDate', direction: 'desc' } },
      }),
    ).toEqual(['di', 'ada', 'bob', 'cy']);
  });

  it('should combine filters across columns', () => {
    expect(
      compute({
        layout: {
          filters: {
            company: { type: 'values', values: ['company-2', null] },
            nextActionDate: {
              type: 'date',
              operator: 'isEmpty',
              from: null,
              to: null,
            },
          },
        },
      }),
    ).toEqual(['bob', 'cy']);
  });

  it('should filter owners including blanks', () => {
    expect(
      compute({
        layout: {
          filters: { cadenceOwner: { type: 'values', values: [null] } },
        },
      }),
    ).toEqual(['bob']);
  });

  it('should filter dates by range and text by contents', () => {
    expect(
      compute({
        layout: {
          filters: {
            nextActionDate: {
              type: 'date',
              operator: 'between',
              from: '2026-10-25',
              to: '2026-11-30',
            },
          },
        },
      }),
    ).toEqual(['di']);
    expect(
      compute({
        layout: { filters: { name: { type: 'contains', text: 'BRO' } } },
      }),
    ).toEqual(['bob']);
  });

  it('should filter checkboxes', () => {
    expect(
      compute({
        layout: { filters: { optedOut: { type: 'boolean', value: true } } },
      }),
    ).toEqual(['cy']);
  });
});
