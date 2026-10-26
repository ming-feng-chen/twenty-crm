import { gql } from '@apollo/client';

export const FIND_FAST_CONTACTS_COMPANIES_QUERY = gql`
  query FindFastContactsCompanies($first: Int, $after: String) {
    companies(
      first: $first
      after: $after
      orderBy: [{ name: AscNullsLast }, { id: AscNullsFirst }]
    ) {
      edges {
        node {
          id
          name
          group
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;
