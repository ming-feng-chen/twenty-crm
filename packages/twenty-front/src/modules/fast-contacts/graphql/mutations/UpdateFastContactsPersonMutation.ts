import { gql } from '@apollo/client';

import { FAST_CONTACTS_PERSON_FIELDS_FRAGMENT } from '@/fast-contacts/graphql/fragments/FastContactsPersonFieldsFragment';

export const UPDATE_FAST_CONTACTS_PERSON_MUTATION = gql`
  ${FAST_CONTACTS_PERSON_FIELDS_FRAGMENT}
  mutation UpdateFastContactsPerson($id: UUID!, $data: PersonUpdateInput!) {
    updatePerson(id: $id, data: $data) {
      ...FastContactsPersonFields
    }
  }
`;
