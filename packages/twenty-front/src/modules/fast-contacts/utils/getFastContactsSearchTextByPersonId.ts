import { FAST_CONTACTS_COLUMNS } from '@/fast-contacts/constants/FastContactsColumns';
import { type FastContactsCellFormatContext } from '@/fast-contacts/types/FastContactsCellFormatContext';
import { type FastContactsPerson } from '@/fast-contacts/types/FastContactsPerson';
import { getFastContactsCellText } from '@/fast-contacts/utils/getFastContactsCellText';
import { normalizeFastContactsSearchText } from '@/fast-contacts/utils/normalizeFastContactsSearchText';

// Searches what the grid shows, so a match is always visible in the row.
export const getFastContactsSearchTextByPersonId = ({
  people,
  formatContext,
}: {
  people: FastContactsPerson[];
  formatContext: FastContactsCellFormatContext;
}): Map<string, string> =>
  new Map(
    people.map((person) => [
      person.id,
      normalizeFastContactsSearchText(
        FAST_CONTACTS_COLUMNS.map((column) =>
          getFastContactsCellText({
            person,
            columnKey: column.key,
            formatContext,
          }),
        ).join('\n'),
      ),
    ]),
  );
