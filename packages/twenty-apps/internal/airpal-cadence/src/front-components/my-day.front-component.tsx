import { defineFrontComponent } from 'twenty-sdk/define';

import { MY_DAY_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { MyDayPage } from 'src/ui/components/my-day-page';

// The My Day page (SPEC §6); the logic lives in src/ui.
const MyDay = () => <MyDayPage />;

export default defineFrontComponent({
  universalIdentifier: MY_DAY_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'my-day',
  description:
    'My Day: the contacts due today or overdue, with the cadence buttons, Undo and the owner selector.',
  component: MyDay,
});
