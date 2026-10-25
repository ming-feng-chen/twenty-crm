import { isNonEmptyString } from '@sniptt/guards';
import { doNotTranslate } from 'twenty-shared/i18n';
import { assertUnreachable, isDefined } from 'twenty-shared/utils';

import { type FastContactsCellFormatContext } from '@/fast-contacts/types/FastContactsCellFormatContext';
import { type FastContactsColumnKey } from '@/fast-contacts/types/FastContactsColumn';
import { type FastContactsPerson } from '@/fast-contacts/types/FastContactsPerson';
import { getFastContactsLinkDisplayValues } from '@/fast-contacts/utils/getFastContactsLinkDisplayValues';
import { type FieldFullNameValue } from '@/object-record/record-field/ui/types/FieldMetadata';
import { formatDateString } from '@/object-record/record-field/ui/utils/formatDateString';

const formatFullName = (fullName: FieldFullNameValue | null | undefined) =>
  [fullName?.firstName, fullName?.lastName].filter(isNonEmptyString).join(' ');

export const getFastContactsCellText = ({
  person,
  columnKey,
  formatContext,
}: {
  person: FastContactsPerson;
  columnKey: FastContactsColumnKey;
  formatContext: FastContactsCellFormatContext;
}): string => {
  switch (columnKey) {
    case 'name':
      return formatFullName(person.name);
    case 'company':
      return person.company?.name ?? '';
    case 'jobTitle':
      return person.jobTitle ?? '';
    case 'cadenceOwner':
      return formatFullName(person.cadenceOwner?.name);
    case 'cadenceStage':
      return isDefined(person.cadenceStage)
        ? (formatContext.stageLabelByValue.get(person.cadenceStage) ??
            person.cadenceStage)
        : '';
    case 'cadenceStep':
      return person.cadenceStep ?? '';
    case 'nextActionDate':
    case 'lastTouchOn':
      return formatDateString({
        value: person[columnKey],
        // DATE values are stored as yyyy-mm-dd and must not shift with the viewer's time zone.
        timeZone: doNotTranslate('UTC'),
        dateFormat: formatContext.dateFormat,
        dateFieldSettings:
          columnKey === 'nextActionDate'
            ? formatContext.nextActionDateSettings
            : formatContext.lastTouchOnSettings,
        localeCatalog: formatContext.localeCatalog,
      });
    case 'linkedinLink':
      return getFastContactsLinkDisplayValues(person.linkedinLink)
        .map((link) => link.label)
        .join(', ');
    case 'emails':
      return [
        person.emails?.primaryEmail,
        ...(person.emails?.additionalEmails ?? []),
      ]
        .filter(isNonEmptyString)
        .join(', ');
    case 'linkedinConnectionNote':
      return person.linkedinConnectionNote ?? '';
    default:
      return assertUnreachable(columnKey);
  }
};
