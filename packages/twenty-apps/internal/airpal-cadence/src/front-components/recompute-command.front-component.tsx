import { defineFrontComponent } from 'twenty-sdk/define';

import { RecomputeCommandRunner } from 'src/ui/components/commands';
import { RECOMPUTE_COMMAND_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/ui/universal-identifiers';

// Person command "Recompute": works the cadence out again for this person now.
const RecomputeCommand = () => <RecomputeCommandRunner />;

export default defineFrontComponent({
  universalIdentifier: RECOMPUTE_COMMAND_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'recompute-command',
  description: "Recomputes the selected person's cadence now and shows the result.",
  isHeadless: true,
  component: RecomputeCommand,
});
