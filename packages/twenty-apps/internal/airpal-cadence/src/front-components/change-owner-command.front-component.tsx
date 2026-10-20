import { defineFrontComponent } from 'twenty-sdk/define';

import { ChangeOwnerPanel } from 'src/ui/components/commands';
import { CHANGE_OWNER_COMMAND_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/ui/universal-identifiers';

// Person command "Change owner…" (SPEC §4): Start fresh or Keep position.
const ChangeOwnerCommand = () => <ChangeOwnerPanel />;

export default defineFrontComponent({
  universalIdentifier: CHANGE_OWNER_COMMAND_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'change-owner-command',
  description: 'Hands the selected person over to another member: Start fresh or Keep position.',
  component: ChangeOwnerCommand,
});
