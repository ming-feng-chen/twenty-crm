import {
  defineView,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
  ViewFilterOperand,
  ViewSortDirection,
  ViewType,
} from 'twenty-sdk/define';

import {
  PERSON_CADENCE_DUE_FIELD_UNIVERSAL_IDENTIFIER,
  PERSON_CADENCE_OWNER_FIELD_UNIVERSAL_IDENTIFIER,
  PERSON_CADENCE_STAGE_FIELD_UNIVERSAL_IDENTIFIER,
  PERSON_CADENCE_STEP_FIELD_UNIVERSAL_IDENTIFIER,
  PERSON_LAST_TOUCH_ON_FIELD_UNIVERSAL_IDENTIFIER,
  PERSON_NEXT_ACTION_DATE_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import {
  MY_DAY_TABLE_DUE_FILTER_UNIVERSAL_IDENTIFIER,
  MY_DAY_TABLE_OWNER_FILTER_UNIVERSAL_IDENTIFIER,
  MY_DAY_TABLE_SORT_UNIVERSAL_IDENTIFIER,
  MY_DAY_TABLE_VIEW_FIELD_UNIVERSAL_IDENTIFIERS,
  MY_DAY_TABLE_VIEW_UNIVERSAL_IDENTIFIER,
} from 'src/ui/universal-identifiers';

const PERSON = STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person;

// "My Day (table)": a plain People view of the viewer's due contacts, oldest
// first, as a fallback if the My Day page has trouble. Touches are then
// logged with the person's "Did it" command.
const FIELDS = [
  [MY_DAY_TABLE_VIEW_FIELD_UNIVERSAL_IDENTIFIERS.name, PERSON.fields.name.universalIdentifier, 200],
  [MY_DAY_TABLE_VIEW_FIELD_UNIVERSAL_IDENTIFIERS.nextActionDate, PERSON_NEXT_ACTION_DATE_FIELD_UNIVERSAL_IDENTIFIER, 140],
  [MY_DAY_TABLE_VIEW_FIELD_UNIVERSAL_IDENTIFIERS.step, PERSON_CADENCE_STEP_FIELD_UNIVERSAL_IDENTIFIER, 260],
  [MY_DAY_TABLE_VIEW_FIELD_UNIVERSAL_IDENTIFIERS.stage, PERSON_CADENCE_STAGE_FIELD_UNIVERSAL_IDENTIFIER, 170],
  [MY_DAY_TABLE_VIEW_FIELD_UNIVERSAL_IDENTIFIERS.lastTouchOn, PERSON_LAST_TOUCH_ON_FIELD_UNIVERSAL_IDENTIFIER, 120],
  [MY_DAY_TABLE_VIEW_FIELD_UNIVERSAL_IDENTIFIERS.company, PERSON.fields.company.universalIdentifier, 170],
  [MY_DAY_TABLE_VIEW_FIELD_UNIVERSAL_IDENTIFIERS.emails, PERSON.fields.emails.universalIdentifier, 200],
  [MY_DAY_TABLE_VIEW_FIELD_UNIVERSAL_IDENTIFIERS.owner, PERSON_CADENCE_OWNER_FIELD_UNIVERSAL_IDENTIFIER, 160],
] as const;

export default defineView({
  universalIdentifier: MY_DAY_TABLE_VIEW_UNIVERSAL_IDENTIFIER,
  name: 'My Day (table)',
  objectUniversalIdentifier: PERSON.universalIdentifier,
  type: ViewType.TABLE,
  icon: 'IconCalendarDue',
  position: 11,
  fields: FIELDS.map(([universalIdentifier, field, size], position) => ({
    universalIdentifier,
    fieldMetadataUniversalIdentifier: field,
    position,
    isVisible: true,
    size,
  })),
  filters: [
    {
      universalIdentifier: MY_DAY_TABLE_OWNER_FILTER_UNIVERSAL_IDENTIFIER,
      fieldMetadataUniversalIdentifier:
        PERSON_CADENCE_OWNER_FIELD_UNIVERSAL_IDENTIFIER,
      operand: ViewFilterOperand.IS,
      // Twenty's own "Assigned to me" value: whoever is viewing.
      value: JSON.stringify({
        isCurrentWorkspaceMemberSelected: true,
        selectedRecordIds: [],
      }),
    },
    {
      universalIdentifier: MY_DAY_TABLE_DUE_FILTER_UNIVERSAL_IDENTIFIER,
      fieldMetadataUniversalIdentifier:
        PERSON_CADENCE_DUE_FIELD_UNIVERSAL_IDENTIFIER,
      operand: ViewFilterOperand.IS,
      value: 'true',
    },
  ],
  sorts: [
    {
      universalIdentifier: MY_DAY_TABLE_SORT_UNIVERSAL_IDENTIFIER,
      fieldMetadataUniversalIdentifier:
        PERSON_NEXT_ACTION_DATE_FIELD_UNIVERSAL_IDENTIFIER,
      direction: ViewSortDirection.ASC,
    },
  ],
});
