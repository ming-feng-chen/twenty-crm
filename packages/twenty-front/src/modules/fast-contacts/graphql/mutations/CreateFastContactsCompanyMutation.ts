import { gql } from '@apollo/client';

export const CREATE_FAST_CONTACTS_COMPANY_MUTATION = gql`
  mutation CreateFastContactsCompany($data: CompanyCreateInput!) {
    createCompany(data: $data) {
      id
      name
      group
    }
  }
`;
