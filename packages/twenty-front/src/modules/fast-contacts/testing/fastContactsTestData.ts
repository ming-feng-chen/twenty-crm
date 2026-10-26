import { enUS } from 'date-fns/locale';

import { type FastContactsCellFormatContext } from '@/fast-contacts/types/FastContactsCellFormatContext';
import { type FastContactsEditContext } from '@/fast-contacts/types/FastContactsEditContext';
import { type FastContactsPerson } from '@/fast-contacts/types/FastContactsPerson';
import { DateFormat } from '@/localization/constants/DateFormat';

export const FAST_CONTACTS_TEST_PERSON: FastContactsPerson = {
  id: 'person-1',
  position: 1,
  createdAt: '2026-10-20T23:30:00.000Z',
  updatedAt: '2026-10-22T10:00:00.000Z',
  name: { firstName: 'Ada', lastName: 'Lovelace' },
  jobTitle: 'Head of Partnerships',
  city: 'London',
  cadenceStage: 'CONTACTED_NO_REPLY',
  cadenceStep: 'Email 2',
  cadenceState: 'RUNNING',
  cadenceHealth: 'ACTIVE',
  nextActionDate: '2026-10-24',
  lastTouchOn: null,
  snoozeUntil: null,
  revisitDate: null,
  optedOut: false,
  optOutReason: null,
  linkedinLink: {
    primaryLinkUrl: 'https://www.linkedin.com/in/ada-lovelace',
    primaryLinkLabel: null,
    secondaryLinks: null,
  },
  emails: { primaryEmail: 'ada@example.com', additionalEmails: null },
  phones: {
    primaryPhoneNumber: '7700900123',
    primaryPhoneCountryCode: 'GB',
    primaryPhoneCallingCode: '+44',
    additionalPhones: null,
  },
  linkedinConnectionNote: null,
  company: { id: 'company-1', name: 'Analytical Engines', group: 'PARTNER' },
  cadenceOwner: {
    id: 'member-1',
    name: { firstName: 'Romy', lastName: 'Levy' },
  },
};

export const FAST_CONTACTS_TEST_FORMAT_CONTEXT: FastContactsCellFormatContext =
  {
    dateFormat: DateFormat.DAY_FIRST,
    localeCatalog: enUS,
    timeZone: 'Europe/London',
    selectOptionsByColumnKey: {
      cadenceStage: [
        { value: 'NOT_CONTACTED', label: 'Not contacted', position: 0 },
        {
          value: 'CONTACTED_NO_REPLY',
          label: 'Contacted - no reply',
          position: 1,
        },
        { value: 'PILOT_AGREED', label: 'Pilot agreed', position: 7 },
        { value: 'DEAD', label: 'Dead', position: 8 },
      ],
      cadenceHealth: [
        { value: 'ACTIVE', label: 'Active', position: 0 },
        { value: 'HOLD', label: 'Hold', position: 1 },
      ],
    },
    dateSettingsByColumnKey: {},
  };

export const FAST_CONTACTS_TEST_EDIT_CONTEXT: FastContactsEditContext = {
  formatContext: FAST_CONTACTS_TEST_FORMAT_CONTEXT,
  companies: [
    { id: 'company-1', name: 'Analytical Engines', group: 'PARTNER' },
    { id: 'company-2', name: 'Heathrow', group: 'AIRPORT' },
    { id: 'company-3', name: 'Twin', group: null },
    { id: 'company-4', name: 'twin', group: null },
  ],
  members: [
    {
      id: 'member-1',
      name: { firstName: 'Romy', lastName: 'Levy' },
      userEmail: 'romy@airpal.co.uk',
    },
    {
      id: 'member-2',
      name: { firstName: 'Ilesh', lastName: 'Vora' },
      userEmail: 'ilesh@airpal.co.uk',
    },
  ],
  requiredColumnKeys: ['cadenceStage'],
};

export const buildFastContactsTestPerson = (
  overrides: Partial<FastContactsPerson>,
): FastContactsPerson => ({ ...FAST_CONTACTS_TEST_PERSON, ...overrides });
