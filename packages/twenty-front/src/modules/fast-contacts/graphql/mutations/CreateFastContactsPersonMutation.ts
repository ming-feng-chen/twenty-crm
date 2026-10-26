import { gql } from '@apollo/client';

import { FAST_CONTACTS_PERSON_FIELDS_FRAGMENT } from '@/fast-contacts/graphql/fragments/FastContactsPersonFieldsFragment';

export const CREATE_FAST_CONTACTS_PERSON_MUTATION = gql`
  ${FAST_CONTACTS_PERSON_FIELDS_FRAGMENT}
  mutation CreateFastContactsPerson($data: PersonCreateInput!) {
    createPerson(data: $data) {
      ...FastContactsPersonFields
    }
  }
`;
