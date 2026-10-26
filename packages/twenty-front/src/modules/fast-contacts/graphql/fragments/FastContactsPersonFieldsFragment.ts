import { gql } from '@apollo/client';

export const FAST_CONTACTS_PERSON_FIELDS_FRAGMENT = gql`
  fragment FastContactsPersonFields on Person {
    id
    position
    createdAt
    updatedAt
    name {
      firstName
      lastName
    }
    jobTitle
    city
    cadenceStage
    cadenceStep
    cadenceState
    cadenceHealth
    nextActionDate
    lastTouchOn
    snoozeUntil
    revisitDate
    optedOut
    optOutReason
    linkedinLink {
      primaryLinkUrl
      primaryLinkLabel
      secondaryLinks
    }
    emails {
      primaryEmail
      additionalEmails
    }
    phones {
      primaryPhoneNumber
      primaryPhoneCountryCode
      primaryPhoneCallingCode
      additionalPhones
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
    tags {
      edges {
        node {
          tag {
            id
            name
            color
          }
        }
      }
    }
  }
`;
