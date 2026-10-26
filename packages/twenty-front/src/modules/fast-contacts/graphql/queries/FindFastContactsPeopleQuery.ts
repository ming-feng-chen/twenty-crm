import { gql } from '@apollo/client';

import { FAST_CONTACTS_PERSON_FIELDS_FRAGMENT } from '@/fast-contacts/graphql/fragments/FastContactsPersonFieldsFragment';

export const FIND_FAST_CONTACTS_PEOPLE_QUERY = gql`
  ${FAST_CONTACTS_PERSON_FIELDS_FRAGMENT}
  query FindFastContactsPeople(
    $filter: PersonFilterInput
    $first: Int
    $after: String
  ) {
    people(
      filter: $filter
      first: $first
      after: $after
      orderBy: [{ position: AscNullsFirst }, { id: AscNullsFirst }]
    ) {
      edges {
        node {
          ...FastContactsPersonFields
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;
