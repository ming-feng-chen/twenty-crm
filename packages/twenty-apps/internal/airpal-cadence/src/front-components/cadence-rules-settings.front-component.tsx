import { defineFrontComponent } from 'twenty-sdk/define';

import { CADENCE_RULES_SETTINGS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { RulesPage } from 'src/ui/components/rules-page';

// The Cadence rules page (SPEC §6), used by the workspace settings tab and
// by the My Day page's "Cadence rules" tab (which members can reach).
const CadenceRulesSettings = () => <RulesPage />;

export default defineFrontComponent({
  universalIdentifier:
    CADENCE_RULES_SETTINGS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'cadence-rules-settings',
  description:
    'Cadence rules: the steps and settings in plain English, history, and (for admins) edit, preview, save and reset.',
  component: CadenceRulesSettings,
});
