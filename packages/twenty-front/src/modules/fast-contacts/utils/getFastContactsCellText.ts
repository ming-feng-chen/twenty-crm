import { isNonEmptyString } from '@sniptt/guards';
import { doNotTranslate } from 'twenty-shared/i18n';
import { assertUnreachable, isDefined } from 'twenty-shared/utils';

import { type FastContactsCellFormatContext } from '@/fast-contacts/types/FastContactsCellFormatContext';
import { type FastContactsColumnKey } from '@/fast-contacts/types/FastContactsColumn';
import { type FastContactsPerson } from '@/fast-contacts/types/FastContactsPerson';
import { formatFastContactsFullName } from '@/fast-contacts/utils/formatFastContactsFullName';
import { formatFastContactsPhones } from '@/fast-contacts/utils/formatFastContactsPhones';
import { getFastContactsColumn } from '@/fast-contacts/utils/getFastContactsColumn';
import { getFastContactsLinkDisplayValues } from '@/fast-contacts/utils/getFastContactsLinkDisplayValues';
import { getFieldLinkDefinedLinks } from '@/object-record/record-field/ui/meta-types/input/utils/getFieldLinkDefinedLinks';
import { formatDateString } from '@/object-record/record-field/ui/utils/formatDateString';

// display: what the cell shows. clipboard: what Ctrl+C copies, so links are
// full URLs. export: like clipboard, with dates as yyyy-mm-dd for spreadsheets.
export type FastContactsCellTextPurpose = 'display' | 'clipboard' | 'export';

export const getFastContactsCellText = ({
  person,
  columnKey,
  formatContext,
  purpose = 'display',
}: {
  person: FastContactsPerson;
  columnKey: FastContactsColumnKey;
  formatContext: FastContactsCellFormatContext;
  purpose?: FastContactsCellTextPurpose;
}): string => {
  const column = getFastContactsColumn(columnKey);

  switch (column.kind) {
    case 'fullName':
      return formatFastContactsFullName(person.name);
    case 'company':
      return person.company?.name ?? '';
    case 'owner':
      return formatFastContactsFullName(person.cadenceOwner?.name);
    case 'tags':
      return person.tags.map((tag) => tag.name ?? '').join(', ');
    case 'text':
      return (person[columnKey] as string | null) ?? '';
    case 'select': {
      const value = person[columnKey] as string | null;

      if (!isDefined(value)) {
        return '';
      }

      return (
        formatContext.selectOptionsByColumnKey[columnKey]?.find(
          (option) => option.value === value,
        )?.label ?? value
      );
    }
    case 'date':
    case 'dateTime': {
      const value = person[columnKey] as string | null;

      if (!isDefined(value)) {
        return '';
      }

      // DATE values are stored as yyyy-mm-dd and must not shift with the viewer's time zone.
      const timeZone =
        column.kind === 'date' ? doNotTranslate('UTC') : formatContext.timeZone;

      if (purpose === 'export') {
        return column.kind === 'date'
          ? value
          : new Date(value).toLocaleDateString('en-CA', { timeZone });
      }

      return formatDateString({
        value,
        timeZone,
        dateFormat: formatContext.dateFormat,
        dateFieldSettings:
          purpose === 'display'
            ? formatContext.dateSettingsByColumnKey[columnKey]
            : undefined,
        localeCatalog: formatContext.localeCatalog,
      });
    }
    case 'boolean':
      if (purpose === 'display') {
        return '';
      }

      return person[columnKey] === true
        ? doNotTranslate('Yes')
        : doNotTranslate('No');
    case 'emails':
      return [
        person.emails?.primaryEmail,
        ...(person.emails?.additionalEmails ?? []),
      ]
        .filter(isNonEmptyString)
        .join(', ');
    case 'phones':
      return formatFastContactsPhones(person.phones).join(', ');
    case 'links':
      if (purpose !== 'display') {
        return isDefined(person.linkedinLink)
          ? getFieldLinkDefinedLinks(person.linkedinLink)
              .map((link) => link.url)
              .join(', ')
          : '';
      }

      return getFastContactsLinkDisplayValues(person.linkedinLink)
        .map((link) => link.label)
        .join(', ');
    default:
      return assertUnreachable(column.kind);
  }
};
