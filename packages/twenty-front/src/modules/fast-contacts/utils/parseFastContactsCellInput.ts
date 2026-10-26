import { t } from '@lingui/core/macro';
import { isNonEmptyString } from '@sniptt/guards';
import { parsePhoneNumber } from 'libphonenumber-js';
import { absoluteUrlSchema, emailSchema } from 'twenty-shared/utils';

import { type FastContactsCellValueResult } from '@/fast-contacts/types/FastContactsCellValue';
import { type FastContactsColumnKey } from '@/fast-contacts/types/FastContactsColumn';
import { type FastContactsEditContext } from '@/fast-contacts/types/FastContactsEditContext';
import {
  type FastContactsPerson,
  type FastContactsTag,
} from '@/fast-contacts/types/FastContactsPerson';
import { formatFastContactsFullName } from '@/fast-contacts/utils/formatFastContactsFullName';
import { getFastContactsColumn } from '@/fast-contacts/utils/getFastContactsColumn';
import { normalizeFastContactsSearchText } from '@/fast-contacts/utils/normalizeFastContactsSearchText';
import { parseFastContactsDateInput } from '@/fast-contacts/utils/parseFastContactsDateInput';

const valid = (value: unknown): FastContactsCellValueResult => ({
  isValid: true,
  value: value as FastContactsPerson[FastContactsColumnKey],
});

const invalid = (error: string): FastContactsCellValueResult => ({
  isValid: false,
  error,
});

const normalize = (text: string) =>
  normalizeFastContactsSearchText(text).trim().replace(/\s+/g, ' ');

const TRUE_TEXTS = ['yes', 'y', 'true', '1', 'x', '✓', '✔'];
const FALSE_TEXTS = ['no', 'n', 'false', '0', ''];

// Pasted values may hold several entries ("a@x.com, b@y.com"); the first becomes the primary one.
const getFirstEntry = (text: string) => text.split(/[,;\n]/)[0].trim();

// Turns typed or pasted text into the value the column stores. Composite
// fields only change their primary entry; additional entries are kept.
export const parseFastContactsCellInput = ({
  person,
  columnKey,
  text,
  editContext,
}: {
  person: FastContactsPerson;
  columnKey: FastContactsColumnKey;
  text: string;
  editContext: FastContactsEditContext;
}): FastContactsCellValueResult => {
  const column = getFastContactsColumn(columnKey);
  const trimmedText = text.trim();

  if (!column.isEditable) {
    return invalid(t`This column is read-only`);
  }

  switch (column.kind) {
    case 'fullName': {
      if (trimmedText === '') {
        return invalid(t`A contact needs a name`);
      }

      const [firstName, ...lastNameParts] = trimmedText.split(/\s+/);

      return valid({ firstName, lastName: lastNameParts.join(' ') });
    }
    case 'text':
      return valid(trimmedText);
    case 'select': {
      if (trimmedText === '') {
        return editContext.requiredColumnKeys.includes(columnKey)
          ? invalid(t`This column can't be empty`)
          : valid(null);
      }

      const options =
        editContext.formatContext.selectOptionsByColumnKey[columnKey] ?? [];
      const option = options.find(
        (candidate) =>
          normalize(candidate.label) === normalize(trimmedText) ||
          normalize(candidate.value) === normalize(trimmedText),
      );

      return option !== undefined
        ? valid(option.value)
        : invalid(t`"${trimmedText}" is not an option`);
    }
    case 'date': {
      if (trimmedText === '') {
        return valid(null);
      }

      const date = parseFastContactsDateInput({
        text: trimmedText,
        dateFormat: editContext.formatContext.dateFormat,
      });

      return date !== null
        ? valid(date)
        : invalid(t`"${trimmedText}" is not a date`);
    }
    case 'boolean': {
      const normalizedText = normalize(trimmedText);

      if (TRUE_TEXTS.includes(normalizedText)) {
        return valid(true);
      }

      return FALSE_TEXTS.includes(normalizedText)
        ? valid(false)
        : invalid(t`Use Yes or No`);
    }
    case 'emails': {
      const email = getFirstEntry(trimmedText);

      if (email !== '' && !emailSchema.safeParse(email).success) {
        return invalid(t`"${email}" is not an email address`);
      }

      return valid({
        primaryEmail: email,
        additionalEmails: person.emails?.additionalEmails ?? null,
      });
    }
    case 'links': {
      const url = getFirstEntry(trimmedText);

      if (url !== '' && !absoluteUrlSchema.safeParse(url).success) {
        return invalid(t`"${url}" is not a link`);
      }

      return valid({
        primaryLinkUrl: url,
        primaryLinkLabel: '',
        secondaryLinks: person.linkedinLink?.secondaryLinks ?? null,
      });
    }
    case 'phones': {
      const number = getFirstEntry(trimmedText);
      const additionalPhones = person.phones?.additionalPhones ?? null;

      if (number === '') {
        return valid({
          primaryPhoneNumber: '',
          primaryPhoneCountryCode: '',
          primaryPhoneCallingCode: '',
          additionalPhones,
        });
      }

      try {
        const phone = parsePhoneNumber(number);

        if (!phone.isValid()) {
          throw new Error();
        }

        return valid({
          primaryPhoneNumber: phone.nationalNumber,
          primaryPhoneCountryCode: phone.country ?? '',
          primaryPhoneCallingCode: `+${phone.countryCallingCode}`,
          additionalPhones,
        });
      } catch {
        return invalid(
          t`"${number}" is not a phone number; start it with the country code, like +44`,
        );
      }
    }
    case 'owner': {
      if (trimmedText === '') {
        return valid(null);
      }

      const matches = editContext.members.filter(
        (member) =>
          normalize(formatFastContactsFullName(member.name)) ===
            normalize(trimmedText) ||
          normalize(member.userEmail ?? '') === normalize(trimmedText),
      );
      const firstNameMatches = editContext.members.filter(
        (member) =>
          normalize(member.name?.firstName ?? '') === normalize(trimmedText),
      );
      const member =
        matches.length === 1
          ? matches[0]
          : matches.length === 0 && firstNameMatches.length === 1
            ? firstNameMatches[0]
            : undefined;

      return member !== undefined
        ? valid({ id: member.id, name: member.name })
        : invalid(t`No single team member is called "${trimmedText}"`);
    }
    case 'company': {
      if (trimmedText === '') {
        return valid(null);
      }

      const matches = editContext.companies.filter(
        (company) =>
          isNonEmptyString(company.name) &&
          normalize(company.name) === normalize(trimmedText),
      );

      if (matches.length > 1) {
        return invalid(
          t`${matches.length} companies are called "${trimmedText}"; pick one from the list`,
        );
      }

      return matches.length === 1
        ? valid(matches[0])
        : invalid(t`No company is called "${trimmedText}"`);
    }
    case 'tags': {
      const names = trimmedText
        .split(/[,;\n]/)
        .map((name) => name.trim())
        .filter((name) => name !== '');
      const tags: FastContactsTag[] = [];

      for (const name of names) {
        const tag = editContext.tags.find(
          (candidate) =>
            isNonEmptyString(candidate.name) &&
            normalize(candidate.name) === normalize(name),
        );

        if (tag === undefined) {
          return invalid(t`No tag is called "${name}"`);
        }

        if (!tags.includes(tag)) {
          tags.push(tag);
        }
      }

      return valid(tags);
    }
    case 'dateTime':
      return invalid(t`This column is read-only`);
  }
};
