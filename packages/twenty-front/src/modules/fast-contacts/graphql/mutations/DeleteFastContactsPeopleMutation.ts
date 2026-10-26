import { gql } from '@apollo/client';

export const DELETE_FAST_CONTACTS_PEOPLE_MUTATION = gql`
  mutation DeleteFastContactsPeople($filter: PersonFilterInput!) {
    deletePeople(filter: $filter) {
      id
    }
  }
`;
