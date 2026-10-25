import { enUS } from 'date-fns/locale';

import { type FastContactsPerson } from '@/fast-contacts/types/FastContactsPerson';
import { getFastContactsCellText } from '@/fast-contacts/utils/getFastContactsCellText';
import { DateFormat } from '@/localization/constants/DateFormat';

const PERSON: FastContactsPerson = {
  id: 'person-1',
  position: 1,
  updatedAt: '2026-10-22T10:00:00.000Z',
  name: { firstName: 'Ada', lastName: 'Lovelace' },
  jobTitle: 'Head of Partnerships',
  cadenceStage: 'CONTACTED_NO_REPLY',
  cadenceStep: 'Email 2',
  nextActionDate: '2026-10-24',
  lastTouchOn: null,
  linkedinLink: {
    primaryLinkUrl: 'https://www.linkedin.com/in/ada-lovelace',
    primaryLinkLabel: null,
    secondaryLinks: null,
  },
  emails: { primaryEmail: 'ada@example.com', additionalEmails: null },
  linkedinConnectionNote: null,
  company: { id: 'company-1', name: 'Analytical Engines', group: 'PARTNER' },
  cadenceOwner: { id: 'member-1', name: { firstName: 'Romy', lastName: '' } },
};

const FORMAT_CONTEXT = {
  dateFormat: DateFormat.DAY_FIRST,
  localeCatalog: enUS,
  stageLabelByValue: new Map([['CONTACTED_NO_REPLY', 'Contacted - no reply']]),
};

const getText = (
  columnKey: Parameters<typeof getFastContactsCellText>[0]['columnKey'],
  person: FastContactsPerson = PERSON,
) =>
  getFastContactsCellText({ person, columnKey, formatContext: FORMAT_CONTEXT });

describe('getFastContactsCellText', () => {
  it('should join first and last name, skipping empty parts', () => {
    expect(getText('name')).toBe('Ada Lovelace');
    expect(getText('cadenceOwner')).toBe('Romy');
  });

  it('should show the stage label rather than its value', () => {
    expect(getText('cadenceStage')).toBe('Contacted - no reply');
  });

  it('should keep a date on the stored day whatever the viewer time zone', () => {
    expect(getText('nextActionDate')).toBe('24 Oct, 2026');
  });

  it('should show blanks for missing values', () => {
    expect(getText('lastTouchOn')).toBe('');
    expect(getText('linkedinConnectionNote')).toBe('');
    expect(getText('company', { ...PERSON, company: null })).toBe('');
    expect(getText('cadenceStage', { ...PERSON, cadenceStage: null })).toBe('');
  });

  it('should label a LinkedIn profile by its handle', () => {
    expect(getText('linkedinLink')).toBe('ada-lovelace');
  });

  it('should list every email', () => {
    expect(
      getText('emails', {
        ...PERSON,
        emails: {
          primaryEmail: 'ada@example.com',
          additionalEmails: ['ada@home.example'],
        },
      }),
    ).toBe('ada@example.com, ada@home.example');
  });
});
