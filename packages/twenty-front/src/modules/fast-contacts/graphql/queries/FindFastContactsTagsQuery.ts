import { gql } from '@apollo/client';

export const FIND_FAST_CONTACTS_TAGS_QUERY = gql`
  query FindFastContactsTags {
    tags(first: 500, orderBy: [{ name: AscNullsLast }]) {
      edges {
        node {
          id
          name
          color
        }
      }
    }
  }
`;
