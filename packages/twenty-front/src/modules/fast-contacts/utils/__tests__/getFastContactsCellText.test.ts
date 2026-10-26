import {
  buildFastContactsTestPerson,
  FAST_CONTACTS_TEST_FORMAT_CONTEXT,
} from '@/fast-contacts/testing/fastContactsTestData';
import { type FastContactsColumnKey } from '@/fast-contacts/types/FastContactsColumn';
import { type FastContactsPerson } from '@/fast-contacts/types/FastContactsPerson';
import {
  type FastContactsCellTextPurpose,
  getFastContactsCellText,
} from '@/fast-contacts/utils/getFastContactsCellText';

const getText = (
  columnKey: FastContactsColumnKey,
  overrides: Partial<FastContactsPerson> = {},
  purpose: FastContactsCellTextPurpose = 'display',
) =>
  getFastContactsCellText({
    person: buildFastContactsTestPerson(overrides),
    columnKey,
    formatContext: FAST_CONTACTS_TEST_FORMAT_CONTEXT,
    purpose,
  });

describe('getFastContactsCellText', () => {
  it('should join first and last name, skipping empty parts', () => {
    expect(getText('name')).toBe('Ada Lovelace');
    expect(
      getText('cadenceOwner', {
        cadenceOwner: {
          id: 'member-1',
          name: { firstName: 'Romy', lastName: '' },
        },
      }),
    ).toBe('Romy');
  });

  it('should show option labels rather than values', () => {
    expect(getText('cadenceStage')).toBe('Contacted - no reply');
    expect(getText('cadenceHealth')).toBe('Active');
  });

  it('should keep a date on the stored day whatever the viewer time zone', () => {
    expect(getText('nextActionDate')).toBe('24 Oct, 2026');
  });

  it('should show a creation time on the viewer calendar day', () => {
    expect(getText('createdAt', {}, 'export')).toBe('2026-10-21');
  });

  it('should export dates as yyyy-mm-dd', () => {
    expect(getText('nextActionDate', {}, 'export')).toBe('2026-10-24');
  });

  it('should show blanks for missing values', () => {
    expect(getText('lastTouchOn')).toBe('');
    expect(getText('linkedinConnectionNote')).toBe('');
    expect(getText('company', { company: null })).toBe('');
    expect(getText('cadenceStage', { cadenceStage: null })).toBe('');
  });

  it('should label a LinkedIn profile by its handle but copy its URL', () => {
    expect(getText('linkedinLink')).toBe('ada-lovelace');
    expect(getText('linkedinLink', {}, 'clipboard')).toBe(
      'https://www.linkedin.com/in/ada-lovelace',
    );
  });

  it('should list every email', () => {
    expect(
      getText('emails', {
        emails: {
          primaryEmail: 'ada@example.com',
          additionalEmails: ['ada@home.example'],
        },
      }),
    ).toBe('ada@example.com, ada@home.example');
  });

  it('should format phones internationally', () => {
    expect(getText('phones')).toBe('+44 7700 900123');
  });

  it('should copy a checkbox as Yes or No and show no text in the cell', () => {
    expect(getText('optedOut')).toBe('');
    expect(getText('optedOut', { optedOut: true }, 'clipboard')).toBe('Yes');
    expect(getText('optedOut', {}, 'export')).toBe('No');
  });
});
