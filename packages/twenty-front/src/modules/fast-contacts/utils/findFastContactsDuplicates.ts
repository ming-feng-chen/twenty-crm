import { isNonEmptyString } from '@sniptt/guards';

import { type FastContactsCellWrite } from '@/fast-contacts/types/FastContactsCellWrite';
import { type FastContactsPerson } from '@/fast-contacts/types/FastContactsPerson';
import {
  type FieldEmailsValue,
  type FieldLinksValue,
} from '@/object-record/record-field/ui/types/FieldMetadata';

export type FastContactsDuplicate = {
  personId: string;
  existingPersonId: string;
};

const normalizeEmail = (email: string | null | undefined) =>
  email?.trim().toLowerCase() ?? '';

// LinkedIn URLs differ in protocol, "www.", case and trailing slashes for the same profile.
const normalizeUrl = (url: string | null | undefined) =>
  (url ?? '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '');

const getWrittenKey = (write: FastContactsCellWrite): string => {
  if (write.columnKey === 'emails') {
    return normalizeEmail(
      (write.value as FieldEmailsValue | null)?.primaryEmail,
    );
  }

  if (write.columnKey === 'linkedinLink') {
    return normalizeUrl(
      (write.value as FieldLinksValue | null)?.primaryLinkUrl,
    );
  }

  return '';
};

const getPersonKeys = (person: FastContactsPerson, columnKey: string) =>
  columnKey === 'emails'
    ? [
        person.emails?.primaryEmail,
        ...(person.emails?.additionalEmails ?? []),
      ].map(normalizeEmail)
    : [
        person.linkedinLink?.primaryLinkUrl,
        ...(person.linkedinLink?.secondaryLinks ?? []).map((link) => link?.url),
      ].map(normalizeUrl);

// Another contact already has the email or LinkedIn profile being typed in.
export const findFastContactsDuplicates = ({
  writes,
  peopleById,
}: {
  writes: FastContactsCellWrite[];
  peopleById: Map<string, FastContactsPerson>;
}): FastContactsDuplicate[] =>
  writes.flatMap((write) => {
    const writtenKey = getWrittenKey(write);

    if (!isNonEmptyString(writtenKey)) {
      return [];
    }

    const existingPerson = [...peopleById.values()].find(
      (person) =>
        person.id !== write.personId &&
        getPersonKeys(person, write.columnKey).includes(writtenKey),
    );

    return existingPerson === undefined
      ? []
      : [{ personId: write.personId, existingPersonId: existingPerson.id }];
  });
