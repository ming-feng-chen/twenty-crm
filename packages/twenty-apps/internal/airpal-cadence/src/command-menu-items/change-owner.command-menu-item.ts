import {
  defineCommandMenuItem,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  CHANGE_OWNER_COMMAND_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  CHANGE_OWNER_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
} from 'src/ui/universal-identifiers';

export default defineCommandMenuItem({
  universalIdentifier: CHANGE_OWNER_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  label: 'Change owner…',
  shortLabel: 'Change owner',
  isPinned: false,
  availabilityType: 'RECORD_SELECTION',
  availabilityObjectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  frontComponentUniversalIdentifier:
    CHANGE_OWNER_COMMAND_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
});
