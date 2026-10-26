import { gql } from '@apollo/client';

export const CREATE_FAST_CONTACTS_PERSON_TAGS_MUTATION = gql`
  mutation CreateFastContactsPersonTags($data: [PersonTagCreateInput!]!) {
    createPersonTags(data: $data) {
      id
    }
  }
`;
