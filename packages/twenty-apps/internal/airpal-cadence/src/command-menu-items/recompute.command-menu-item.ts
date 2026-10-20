import {
  defineCommandMenuItem,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  RECOMPUTE_COMMAND_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  RECOMPUTE_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
} from 'src/ui/universal-identifiers';

export default defineCommandMenuItem({
  universalIdentifier: RECOMPUTE_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  label: 'Recompute cadence',
  shortLabel: 'Recompute',
  isPinned: false,
  availabilityType: 'RECORD_SELECTION',
  availabilityObjectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  frontComponentUniversalIdentifier:
    RECOMPUTE_COMMAND_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
});
