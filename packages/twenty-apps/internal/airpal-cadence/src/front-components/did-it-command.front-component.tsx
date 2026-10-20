import { defineFrontComponent } from 'twenty-sdk/define';

import { DID_IT_COMMAND_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { DidItCommandRunner } from 'src/ui/components/commands';

// Person command "Did it": logs the prescribed touch through the log-touch
// route as the viewer, then opens the panel with its Undo.
const DidItCommand = () => <DidItCommandRunner />;

export default defineFrontComponent({
  universalIdentifier: DID_IT_COMMAND_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'did-it-command',
  description:
    'Logs the touch the cadence prescribes for the selected person ("Did it"), as you, dated today.',
  isHeadless: true,
  component: DidItCommand,
});
