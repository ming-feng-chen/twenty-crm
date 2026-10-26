import { isDefined } from 'twenty-shared/utils';

import { type FastContactsCellFormatContext } from '@/fast-contacts/types/FastContactsCellFormatContext';
import { type FastContactsPerson } from '@/fast-contacts/types/FastContactsPerson';
import { type FastContactsSort } from '@/fast-contacts/types/FastContactsSheetLayout';
import { getFastContactsCellDate } from '@/fast-contacts/utils/getFastContactsCellDate';
import { getFastContactsCellText } from '@/fast-contacts/utils/getFastContactsCellText';
import { getFastContactsColumn } from '@/fast-contacts/utils/getFastContactsColumn';

const COLLATOR = new Intl.Collator(undefined, {
  sensitivity: 'base',
  numeric: true,
});

type SortKey = string | number | null;

const getSortKey = (
  person: FastContactsPerson,
  sort: FastContactsSort,
  formatContext: FastContactsCellFormatContext,
): SortKey => {
  const { columnKey } = sort;

  switch (getFastContactsColumn(columnKey).kind) {
    case 'select': {
      const value = person[columnKey];

      if (typeof value !== 'string' || value === '') {
        return null;
      }

      const position = formatContext.selectOptionsByColumnKey[columnKey]?.find(
        (option) => option.value === value,
      )?.position;

      return position ?? Number.MAX_SAFE_INTEGER;
    }
    case 'date':
    case 'dateTime':
      return getFastContactsCellDate({
        person,
        columnKey,
        timeZone: formatContext.timeZone,
      });
    case 'boolean':
      return person[columnKey] === true ? 1 : 0;
    default: {
      const text = getFastContactsCellText({
        person,
        columnKey,
        formatContext,
      });

      return text === '' ? null : text;
    }
  }
};

// Blanks go last in both directions; ties return 0 so a stable sort keeps the default order.
export const compareFastContactsPeopleByColumn = ({
  sort,
  formatContext,
}: {
  sort: FastContactsSort;
  formatContext: FastContactsCellFormatContext;
}) => {
  const sortKeyByPerson = new Map<FastContactsPerson, SortKey>();
  const getCachedSortKey = (person: FastContactsPerson) => {
    if (!sortKeyByPerson.has(person)) {
      sortKeyByPerson.set(person, getSortKey(person, sort, formatContext));
    }

    return sortKeyByPerson.get(person) ?? null;
  };
  const directionFactor = sort.direction === 'asc' ? 1 : -1;

  return (
    firstPerson: FastContactsPerson,
    secondPerson: FastContactsPerson,
  ) => {
    const firstKey = getCachedSortKey(firstPerson);
    const secondKey = getCachedSortKey(secondPerson);

    if (!isDefined(firstKey) || !isDefined(secondKey)) {
      return isDefined(firstKey) ? -1 : isDefined(secondKey) ? 1 : 0;
    }

    const comparison =
      typeof firstKey === 'number' && typeof secondKey === 'number'
        ? firstKey - secondKey
        : COLLATOR.compare(String(firstKey), String(secondKey));

    return comparison * directionFactor;
  };
};
