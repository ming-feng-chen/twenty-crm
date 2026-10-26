import { buildFastContactsTestPerson } from '@/fast-contacts/testing/fastContactsTestData';
import { findFastContactsDuplicates } from '@/fast-contacts/utils/findFastContactsDuplicates';

const PEOPLE_BY_ID = new Map(
  [
    buildFastContactsTestPerson({
      id: 'jane',
      emails: { primaryEmail: 'Jane@Heathrow.com', additionalEmails: null },
      linkedinLink: {
        primaryLinkUrl: 'https://www.linkedin.com/in/jane/',
        primaryLinkLabel: null,
        secondaryLinks: null,
      },
    }),
    buildFastContactsTestPerson({
      id: 'new',
      emails: null,
      linkedinLink: null,
    }),
  ].map((person) => [person.id, person]),
);

describe('findFastContactsDuplicates', () => {
  it('should find another contact with the same email or LinkedIn profile', () => {
    expect(
      findFastContactsDuplicates({
        writes: [
          {
            personId: 'new',
            columnKey: 'emails',
            value: {
              primaryEmail: ' jane@heathrow.com',
              additionalEmails: null,
            },
          },
          {
            personId: 'new',
            columnKey: 'linkedinLink',
            value: {
              primaryLinkUrl: 'linkedin.com/in/JANE',
              primaryLinkLabel: '',
              secondaryLinks: null,
            },
          },
        ],
        peopleById: PEOPLE_BY_ID,
      }),
    ).toEqual([
      { personId: 'new', existingPersonId: 'jane' },
      { personId: 'new', existingPersonId: 'jane' },
    ]);
  });

  it('should ignore the contact being edited and empty values', () => {
    expect(
      findFastContactsDuplicates({
        writes: [
          {
            personId: 'jane',
            columnKey: 'emails',
            value: {
              primaryEmail: 'jane@heathrow.com',
              additionalEmails: null,
            },
          },
          {
            personId: 'new',
            columnKey: 'emails',
            value: { primaryEmail: '', additionalEmails: null },
          },
        ],
        peopleById: PEOPLE_BY_ID,
      }),
    ).toEqual([]);
  });
});
