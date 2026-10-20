import { defineField, FieldType } from 'twenty-sdk/define';

import { TOUCH_OBJECT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: 'da953e95-aa28-4d7c-81d5-35b7384adc4e',
  name: 'occurredAt',
  label: 'Occurred at',
  type: FieldType.DATE_TIME,
  objectUniversalIdentifier: TOUCH_OBJECT_UNIVERSAL_IDENTIFIER,
  description: 'Exact time of the latest synced email in this direction on the touch day.',
  icon: 'IconClock',
  isNullable: true,
  isUIEditable: false,
});
