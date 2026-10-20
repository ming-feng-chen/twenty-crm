import { defineSettingsMenuItem } from 'twenty-sdk/define';

import {
  CADENCE_RULES_SETTINGS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  CADENCE_RULES_SETTINGS_MENU_ITEM_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineSettingsMenuItem({
  universalIdentifier: CADENCE_RULES_SETTINGS_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  frontComponentUniversalIdentifier:
    CADENCE_RULES_SETTINGS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  title: 'Cadence rules',
  icon: 'IconAdjustments',
  scope: 'WORKSPACE',
});
