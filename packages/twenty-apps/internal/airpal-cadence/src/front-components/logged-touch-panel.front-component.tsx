import { defineFrontComponent } from 'twenty-sdk/define';

import { LoggedTouchPanel } from 'src/ui/components/commands';
import { LOGGED_TOUCH_PANEL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/ui/universal-identifiers';

// The side panel the "Did it" command opens: what you just logged for the
// person, with Undo.
const LoggedTouch = () => <LoggedTouchPanel />;

export default defineFrontComponent({
  universalIdentifier: LOGGED_TOUCH_PANEL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'logged-touch-panel',
  description: 'The touches you logged for a person in the last 30 minutes, each with Undo.',
  component: LoggedTouch,
});
