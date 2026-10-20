import {
  defineCommandMenuItem,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  DID_IT_COMMAND_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  DID_IT_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineCommandMenuItem({
  universalIdentifier: DID_IT_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  label: 'Did it (log the cadence step)',
  shortLabel: 'Did it',
  isPinned: true,
  availabilityType: 'RECORD_SELECTION',
  availabilityObjectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  frontComponentUniversalIdentifier:
    DID_IT_COMMAND_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
});
