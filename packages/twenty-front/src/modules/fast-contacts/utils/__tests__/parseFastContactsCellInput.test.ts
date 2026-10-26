import {
  buildFastContactsTestPerson,
  FAST_CONTACTS_TEST_EDIT_CONTEXT,
} from '@/fast-contacts/testing/fastContactsTestData';
import { type FastContactsColumnKey } from '@/fast-contacts/types/FastContactsColumn';
import { type FastContactsPerson } from '@/fast-contacts/types/FastContactsPerson';
import { parseFastContactsCellInput } from '@/fast-contacts/utils/parseFastContactsCellInput';

const parse = (
  columnKey: FastContactsColumnKey,
  text: string,
  overrides: Partial<FastContactsPerson> = {},
) =>
  parseFastContactsCellInput({
    person: buildFastContactsTestPerson(overrides),
    columnKey,
    text,
    editContext: FAST_CONTACTS_TEST_EDIT_CONTEXT,
  });

describe('parseFastContactsCellInput', () => {
  it('should split a name at the first space and refuse an empty one', () => {
    expect(parse('name', '  Jane van Dyke ')).toEqual({
      isValid: true,
      value: { firstName: 'Jane', lastName: 'van Dyke' },
    });
    expect(parse('name', 'Cher')).toEqual({
      isValid: true,
      value: { firstName: 'Cher', lastName: '' },
    });
    expect(parse('name', ' ').isValid).toBe(false);
  });

  it('should refuse read-only columns', () => {
    expect(parse('cadenceStep', 'Email 3').isValid).toBe(false);
    expect(parse('lastTouchOn', '2026-10-01').isValid).toBe(false);
    expect(parse('createdAt', '2026-10-01').isValid).toBe(false);
  });

  it('should match dropdown options by label or value, ignoring case', () => {
    expect(parse('cadenceStage', 'contacted - NO reply')).toEqual({
      isValid: true,
      value: 'CONTACTED_NO_REPLY',
    });
    expect(parse('cadenceStage', 'dead')).toEqual({
      isValid: true,
      value: 'DEAD',
    });
    expect(parse('cadenceStage', 'Maybe').isValid).toBe(false);
  });

  it('should refuse to clear a required dropdown but clear an optional one', () => {
    expect(parse('cadenceStage', '').isValid).toBe(false);
    expect(parse('cadenceHealth', '')).toEqual({ isValid: true, value: null });
  });

  it('should read dates in the viewer format, ISO and the display format', () => {
    expect(parse('nextActionDate', '3/11/2026')).toEqual({
      isValid: true,
      value: '2026-11-03',
    });
    expect(parse('nextActionDate', '2026-11-03')).toEqual({
      isValid: true,
      value: '2026-11-03',
    });
    expect(parse('nextActionDate', '3 Nov, 2026')).toEqual({
      isValid: true,
      value: '2026-11-03',
    });
    expect(parse('nextActionDate', '')).toEqual({ isValid: true, value: null });
    expect(parse('nextActionDate', '31/02/2026').isValid).toBe(false);
    expect(parse('nextActionDate', '3/11/26').isValid).toBe(false);
  });

  it('should read checkbox words', () => {
    expect(parse('optedOut', 'Yes')).toEqual({ isValid: true, value: true });
    expect(parse('optedOut', 'TRUE')).toEqual({ isValid: true, value: true });
    expect(parse('optedOut', '')).toEqual({ isValid: true, value: false });
    expect(parse('optedOut', 'maybe').isValid).toBe(false);
  });

  it('should change only the primary email and keep the others', () => {
    expect(
      parse('emails', 'new@example.com, other@example.com', {
        emails: {
          primaryEmail: 'old@example.com',
          additionalEmails: ['x@y.z'],
        },
      }),
    ).toEqual({
      isValid: true,
      value: { primaryEmail: 'new@example.com', additionalEmails: ['x@y.z'] },
    });
    expect(parse('emails', 'jane@').isValid).toBe(false);
  });

  it('should validate links', () => {
    expect(parse('linkedinLink', 'https://linkedin.com/in/jane')).toEqual({
      isValid: true,
      value: {
        primaryLinkUrl: 'https://linkedin.com/in/jane',
        primaryLinkLabel: '',
        secondaryLinks: null,
      },
    });
    expect(parse('linkedinLink', 'not a link').isValid).toBe(false);
  });

  it('should parse international phone numbers', () => {
    expect(parse('phones', '+44 20 7946 0958')).toEqual({
      isValid: true,
      value: {
        primaryPhoneNumber: '2079460958',
        primaryPhoneCountryCode: 'GB',
        primaryPhoneCallingCode: '+44',
        additionalPhones: null,
      },
    });
    expect(parse('phones', '12').isValid).toBe(false);
  });

  it('should match owners by full name, unique first name or email', () => {
    expect(parse('cadenceOwner', 'ilesh vora')).toEqual({
      isValid: true,
      value: { id: 'member-2', name: { firstName: 'Ilesh', lastName: 'Vora' } },
    });
    expect(parse('cadenceOwner', 'Romy')).toMatchObject({
      isValid: true,
      value: { id: 'member-1' },
    });
    expect(parse('cadenceOwner', 'romy@airpal.co.uk')).toMatchObject({
      isValid: true,
      value: { id: 'member-1' },
    });
    expect(parse('cadenceOwner', 'Nobody').isValid).toBe(false);
    expect(parse('cadenceOwner', '')).toEqual({ isValid: true, value: null });
  });

  it('should match companies by exact name and refuse unknown or ambiguous ones', () => {
    expect(parse('company', 'heathrow')).toMatchObject({
      isValid: true,
      value: { id: 'company-2' },
    });
    expect(parse('company', 'Gatwick').isValid).toBe(false);
    expect(parse('company', 'Twin').isValid).toBe(false);
    expect(parse('company', '')).toEqual({ isValid: true, value: null });
  });
});
