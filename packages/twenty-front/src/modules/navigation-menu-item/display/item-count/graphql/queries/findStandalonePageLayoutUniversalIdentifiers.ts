import { gql } from '@apollo/client';

export const FIND_STANDALONE_PAGE_LAYOUT_UNIVERSAL_IDENTIFIERS = gql`
  query FindStandalonePageLayoutUniversalIdentifiers {
    getPageLayouts(pageLayoutType: STANDALONE_PAGE) {
      id
      universalIdentifier
    }
  }
`;
