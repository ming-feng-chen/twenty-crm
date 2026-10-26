import { isDefined } from 'twenty-shared/utils';

import { type FastContactsCellFormatContext } from '@/fast-contacts/types/FastContactsCellFormatContext';
import { type FastContactsColumnFilter } from '@/fast-contacts/types/FastContactsColumnFilter';
import { type FastContactsColumnKey } from '@/fast-contacts/types/FastContactsColumn';
import { type FastContactsPerson } from '@/fast-contacts/types/FastContactsPerson';
import { getFastContactsCellDate } from '@/fast-contacts/utils/getFastContactsCellDate';
import { getFastContactsCellFilterKey } from '@/fast-contacts/utils/getFastContactsCellFilterKey';
import { getFastContactsCellText } from '@/fast-contacts/utils/getFastContactsCellText';
import { normalizeFastContactsSearchText } from '@/fast-contacts/utils/normalizeFastContactsSearchText';

export const matchesFastContactsColumnFilter = ({
  person,
  columnKey,
  filter,
  formatContext,
}: {
  person: FastContactsPerson;
  columnKey: FastContactsColumnKey;
  filter: FastContactsColumnFilter;
  formatContext: FastContactsCellFormatContext;
}): boolean => {
  switch (filter.type) {
    case 'values':
      if (columnKey === 'tags') {
        return filter.values.some((value) =>
          value === null
            ? person.tags.length === 0
            : person.tags.some((tag) => tag.id === value),
        );
      }

      return filter.values.includes(
        getFastContactsCellFilterKey(person, columnKey),
      );
    case 'contains':
      return normalizeFastContactsSearchText(
        getFastContactsCellText({ person, columnKey, formatContext }),
      ).includes(normalizeFastContactsSearchText(filter.text.trim()));
    case 'boolean':
      return (person[columnKey] === true) === filter.value;
    case 'date': {
      const date = getFastContactsCellDate({
        person,
        columnKey,
        timeZone: formatContext.timeZone,
      });

      if (filter.operator === 'isEmpty') {
        return !isDefined(date);
      }

      if (!isDefined(date)) {
        return false;
      }

      switch (filter.operator) {
        case 'before':
          return !isDefined(filter.from) || date < filter.from;
        case 'after':
          return !isDefined(filter.from) || date > filter.from;
        case 'between':
          return (
            (!isDefined(filter.from) || date >= filter.from) &&
            (!isDefined(filter.to) || date <= filter.to)
          );
      }
    }
  }
};
