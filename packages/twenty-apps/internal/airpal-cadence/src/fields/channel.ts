import { defineField, FieldType } from 'twenty-sdk/define';
import { TOUCH_CHANNEL_FIELD_UNIVERSAL_IDENTIFIER, TOUCH_OBJECT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: TOUCH_CHANNEL_FIELD_UNIVERSAL_IDENTIFIER,
  name: 'channel',
  label: 'Channel',
  type: FieldType.TEXT,
  objectUniversalIdentifier: TOUCH_OBJECT_UNIVERSAL_IDENTIFIER,
  isNullable: true,
});
