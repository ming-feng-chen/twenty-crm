import {
  defineView,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
  ViewFilterOperand,
  ViewSortDirection,
  ViewType,
} from 'twenty-sdk/define';

import {
  PERSON_CADENCE_HEALTH_FIELD_UNIVERSAL_IDENTIFIER,
  PERSON_CADENCE_OWNER_FIELD_UNIVERSAL_IDENTIFIER,
  PERSON_CADENCE_STAGE_FIELD_UNIVERSAL_IDENTIFIER,
  PERSON_CADENCE_STEP_FIELD_UNIVERSAL_IDENTIFIER,
  PERSON_LAST_TOUCH_ON_FIELD_UNIVERSAL_IDENTIFIER,
  PERSON_NEXT_ACTION_DATE_FIELD_UNIVERSAL_IDENTIFIER,
  PERSON_TOUCHES_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import {
  COLD_VIEW_FIELD_UNIVERSAL_IDENTIFIERS,
  COLD_VIEW_LIVE_STAGE_FILTER_UNIVERSAL_IDENTIFIER,
  COLD_VIEW_NO_DATE_FILTER_UNIVERSAL_IDENTIFIER,
  COLD_VIEW_SORT_UNIVERSAL_IDENTIFIER,
  COLD_VIEW_UNIVERSAL_IDENTIFIER,
} from 'src/ui/universal-identifiers';

const PERSON = STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person;

// Cold (SPEC §6), exactly as the old CRM's: no next action date and not at
// Pilot agreed or Dead, for every owner (unowned people included). With My
// Day it covers every live contact. Last touch says how long each has gone
// cold; the Touches column lists them.
const FIELDS = [
  [COLD_VIEW_FIELD_UNIVERSAL_IDENTIFIERS.name, PERSON.fields.name.universalIdentifier, 200],
  [COLD_VIEW_FIELD_UNIVERSAL_IDENTIFIERS.company, PERSON.fields.company.universalIdentifier, 170],
  [COLD_VIEW_FIELD_UNIVERSAL_IDENTIFIERS.owner, PERSON_CADENCE_OWNER_FIELD_UNIVERSAL_IDENTIFIER, 160],
  [COLD_VIEW_FIELD_UNIVERSAL_IDENTIFIERS.stage, PERSON_CADENCE_STAGE_FIELD_UNIVERSAL_IDENTIFIER, 170],
  [COLD_VIEW_FIELD_UNIVERSAL_IDENTIFIERS.step, PERSON_CADENCE_STEP_FIELD_UNIVERSAL_IDENTIFIER, 240],
  [COLD_VIEW_FIELD_UNIVERSAL_IDENTIFIERS.lastTouchOn, PERSON_LAST_TOUCH_ON_FIELD_UNIVERSAL_IDENTIFIER, 120],
  [COLD_VIEW_FIELD_UNIVERSAL_IDENTIFIERS.health, PERSON_CADENCE_HEALTH_FIELD_UNIVERSAL_IDENTIFIER, 110],
  [COLD_VIEW_FIELD_UNIVERSAL_IDENTIFIERS.touches, PERSON_TOUCHES_FIELD_UNIVERSAL_IDENTIFIER, 220],
  [COLD_VIEW_FIELD_UNIVERSAL_IDENTIFIERS.emails, PERSON.fields.emails.universalIdentifier, 200],
  [COLD_VIEW_FIELD_UNIVERSAL_IDENTIFIERS.linkedin, PERSON.fields.linkedinLink.universalIdentifier, 170],
] as const;

export default defineView({
  universalIdentifier: COLD_VIEW_UNIVERSAL_IDENTIFIER,
  name: 'Cold',
  objectUniversalIdentifier: PERSON.universalIdentifier,
  type: ViewType.TABLE,
  icon: 'IconSnowflake',
  position: 10,
  fields: FIELDS.map(([universalIdentifier, field, size], position) => ({
    universalIdentifier,
    fieldMetadataUniversalIdentifier: field,
    position,
    isVisible: true,
    size,
  })),
  filters: [
    {
      universalIdentifier: COLD_VIEW_NO_DATE_FILTER_UNIVERSAL_IDENTIFIER,
      fieldMetadataUniversalIdentifier:
        PERSON_NEXT_ACTION_DATE_FIELD_UNIVERSAL_IDENTIFIER,
      operand: ViewFilterOperand.IS_EMPTY,
      value: '',
    },
    {
      universalIdentifier: COLD_VIEW_LIVE_STAGE_FILTER_UNIVERSAL_IDENTIFIER,
      fieldMetadataUniversalIdentifier:
        PERSON_CADENCE_STAGE_FIELD_UNIVERSAL_IDENTIFIER,
      operand: ViewFilterOperand.IS_NOT,
      value: ['PILOT_AGREED', 'DEAD'],
    },
  ],
  sorts: [
    {
      universalIdentifier: COLD_VIEW_SORT_UNIVERSAL_IDENTIFIER,
      fieldMetadataUniversalIdentifier: PERSON.fields.name.universalIdentifier,
      direction: ViewSortDirection.ASC,
    },
  ],
});
