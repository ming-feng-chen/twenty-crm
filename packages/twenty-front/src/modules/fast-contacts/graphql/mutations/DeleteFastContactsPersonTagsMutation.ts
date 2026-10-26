import { gql } from '@apollo/client';

export const DELETE_FAST_CONTACTS_PERSON_TAGS_MUTATION = gql`
  mutation DeleteFastContactsPersonTags($filter: PersonTagFilterInput!) {
    deletePersonTags(filter: $filter) {
      id
    }
  }
`;
