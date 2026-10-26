import { gql } from '@apollo/client';

export const RESTORE_FAST_CONTACTS_PEOPLE_MUTATION = gql`
  mutation RestoreFastContactsPeople($filter: PersonFilterInput!) {
    restorePeople(filter: $filter) {
      id
    }
  }
`;
