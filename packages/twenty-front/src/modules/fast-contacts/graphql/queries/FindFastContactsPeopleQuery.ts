import { gql } from '@apollo/client';

export const FIND_FAST_CONTACTS_PEOPLE_QUERY = gql`
  query FindFastContactsPeople(
    $filter: PersonFilterInput
    $first: Int
    $after: String
  ) {
    people(
      filter: $filter
      first: $first
      after: $after
      orderBy: [{ position: AscNullsFirst }, { id: AscNullsFirst }]
    ) {
      edges {
        node {
          id
          position
          updatedAt
          name {
            firstName
            lastName
          }
          jobTitle
          cadenceStage
          cadenceStep
          nextActionDate
          lastTouchOn
          linkedinLink {
            primaryLinkUrl
            primaryLinkLabel
            secondaryLinks
          }
          emails {
            primaryEmail
            additionalEmails
          }
          linkedinConnectionNote
          company {
            id
            name
            group
          }
          cadenceOwner {
            id
            name {
              firstName
              lastName
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;
