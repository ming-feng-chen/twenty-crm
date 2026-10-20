import {
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
  ViewFilterOperand,
  ViewSortDirection,
  ViewType,
} from 'twenty-sdk/define';

import {
  PERSON_CADENCE_OWNER_FIELD_UNIVERSAL_IDENTIFIER,
  PERSON_CADENCE_STAGE_FIELD_UNIVERSAL_IDENTIFIER,
  PERSON_CADENCE_STEP_FIELD_UNIVERSAL_IDENTIFIER,
  PERSON_LAST_TOUCH_ON_FIELD_UNIVERSAL_IDENTIFIER,
  PERSON_NEXT_ACTION_DATE_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import { type CompanyGroupValue } from 'src/constants/organisation-values';
import {
  COMPANY_CATEGORY_FIELD_UNIVERSAL_IDENTIFIER,
  COMPANY_GROUP_FIELD_UNIVERSAL_IDENTIFIER,
  PERSON_LINKEDIN_CONNECTION_NOTE_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/partners-airports-identifiers';

const COMPANY = STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company;
const PERSON = STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person;

type CompanyViewFieldIdentifiers = Record<
  'name' | 'category' | 'people' | 'domainName' | 'linkedinLink',
  string
>;

type ContactViewFieldIdentifiers = Record<
  | 'name'
  | 'company'
  | 'jobTitle'
  | 'owner'
  | 'stage'
  | 'step'
  | 'nextActionDate'
  | 'lastTouchOn'
  | 'linkedinLink'
  | 'emails'
  | 'connectionNote',
  string
>;

const toViewFields = (fields: readonly (readonly [string, string, number])[]) =>
  fields.map(([universalIdentifier, field, size], position) => ({
    universalIdentifier,
    fieldMetadataUniversalIdentifier: field,
    position,
    isVisible: true,
    size,
  }));

export const buildOrganisationGroupView = ({
  universalIdentifier,
  name,
  icon,
  position,
  group,
  viewFieldIdentifiers,
  filterUniversalIdentifier,
  sortUniversalIdentifier,
}: {
  universalIdentifier: string;
  name: string;
  icon: string;
  position: number;
  group: CompanyGroupValue;
  viewFieldIdentifiers: CompanyViewFieldIdentifiers;
  filterUniversalIdentifier: string;
  sortUniversalIdentifier: string;
}) => ({
  universalIdentifier,
  name,
  objectUniversalIdentifier: COMPANY.universalIdentifier,
  type: ViewType.TABLE,
  icon,
  position,
  fields: toViewFields([
    [viewFieldIdentifiers.name, COMPANY.fields.name.universalIdentifier, 220],
    [viewFieldIdentifiers.category, COMPANY_CATEGORY_FIELD_UNIVERSAL_IDENTIFIER, 150],
    [viewFieldIdentifiers.people, COMPANY.fields.people.universalIdentifier, 260],
    [viewFieldIdentifiers.domainName, COMPANY.fields.domainName.universalIdentifier, 180],
    [viewFieldIdentifiers.linkedinLink, COMPANY.fields.linkedinLink.universalIdentifier, 180],
  ]),
  filters: [
    {
      universalIdentifier: filterUniversalIdentifier,
      fieldMetadataUniversalIdentifier: COMPANY_GROUP_FIELD_UNIVERSAL_IDENTIFIER,
      operand: ViewFilterOperand.IS,
      value: [group],
    },
  ],
  sorts: [
    {
      universalIdentifier: sortUniversalIdentifier,
      fieldMetadataUniversalIdentifier: COMPANY.fields.name.universalIdentifier,
      direction: ViewSortDirection.ASC,
    },
  ],
});

// People are grouped through their company, so a contact follows the group of
// the organisation they work at.
export const buildGroupContactsView = ({
  universalIdentifier,
  name,
  icon,
  position,
  group,
  viewFieldIdentifiers,
  filterUniversalIdentifier,
  sortUniversalIdentifier,
}: {
  universalIdentifier: string;
  name: string;
  icon: string;
  position: number;
  group: CompanyGroupValue;
  viewFieldIdentifiers: ContactViewFieldIdentifiers;
  filterUniversalIdentifier: string;
  sortUniversalIdentifier: string;
}) => ({
  universalIdentifier,
  name,
  objectUniversalIdentifier: PERSON.universalIdentifier,
  type: ViewType.TABLE,
  icon,
  position,
  fields: toViewFields([
    [viewFieldIdentifiers.name, PERSON.fields.name.universalIdentifier, 200],
    [viewFieldIdentifiers.company, PERSON.fields.company.universalIdentifier, 180],
    [viewFieldIdentifiers.jobTitle, PERSON.fields.jobTitle.universalIdentifier, 200],
    [viewFieldIdentifiers.owner, PERSON_CADENCE_OWNER_FIELD_UNIVERSAL_IDENTIFIER, 150],
    [viewFieldIdentifiers.stage, PERSON_CADENCE_STAGE_FIELD_UNIVERSAL_IDENTIFIER, 170],
    [viewFieldIdentifiers.step, PERSON_CADENCE_STEP_FIELD_UNIVERSAL_IDENTIFIER, 240],
    [viewFieldIdentifiers.nextActionDate, PERSON_NEXT_ACTION_DATE_FIELD_UNIVERSAL_IDENTIFIER, 130],
    [viewFieldIdentifiers.lastTouchOn, PERSON_LAST_TOUCH_ON_FIELD_UNIVERSAL_IDENTIFIER, 120],
    [viewFieldIdentifiers.linkedinLink, PERSON.fields.linkedinLink.universalIdentifier, 170],
    [viewFieldIdentifiers.emails, PERSON.fields.emails.universalIdentifier, 200],
    [viewFieldIdentifiers.connectionNote, PERSON_LINKEDIN_CONNECTION_NOTE_FIELD_UNIVERSAL_IDENTIFIER, 240],
  ]),
  filters: [
    {
      universalIdentifier: filterUniversalIdentifier,
      fieldMetadataUniversalIdentifier: PERSON.fields.company.universalIdentifier,
      relationTargetFieldMetadataUniversalIdentifier:
        COMPANY_GROUP_FIELD_UNIVERSAL_IDENTIFIER,
      operand: ViewFilterOperand.IS,
      value: [group],
    },
  ],
  sorts: [
    {
      universalIdentifier: sortUniversalIdentifier,
      fieldMetadataUniversalIdentifier: PERSON.fields.name.universalIdentifier,
      direction: ViewSortDirection.ASC,
    },
  ],
});
