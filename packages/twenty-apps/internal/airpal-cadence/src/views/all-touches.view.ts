import { defineView, ViewType } from 'twenty-sdk/define';

import {
  ALL_TOUCHES_VIEW_UNIVERSAL_IDENTIFIER,
  TOUCH_CHANNEL_FIELD_UNIVERSAL_IDENTIFIER,
  TOUCH_DIRECTION_FIELD_UNIVERSAL_IDENTIFIER,
  TOUCH_LOGGED_BY_FIELD_UNIVERSAL_IDENTIFIER,
  TOUCH_NAME_FIELD_UNIVERSAL_IDENTIFIER,
  TOUCH_OBJECT_UNIVERSAL_IDENTIFIER,
  TOUCH_OCCURRED_ON_FIELD_UNIVERSAL_IDENTIFIER,
  TOUCH_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

const VIEW_FIELDS = [
  {
    id: 'c19cd73c-1e80-41a9-804c-4d8728acd59f',
    field: TOUCH_NAME_FIELD_UNIVERSAL_IDENTIFIER,
    size: 220,
  },
  {
    id: '431e24fc-4f3f-48d7-a946-085456ecaa3c',
    field: TOUCH_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
    size: 180,
  },
  {
    id: '605b40bf-ab70-4351-a3f9-1f38116a30f4',
    field: TOUCH_CHANNEL_FIELD_UNIVERSAL_IDENTIFIER,
    size: 160,
  },
  {
    id: '177661c5-e5e4-4724-b5de-c1561e2042d0',
    field: TOUCH_DIRECTION_FIELD_UNIVERSAL_IDENTIFIER,
    size: 120,
  },
  {
    id: 'bbd44b3d-34d1-4dad-8a89-b535170d54b1',
    field: TOUCH_OCCURRED_ON_FIELD_UNIVERSAL_IDENTIFIER,
    size: 140,
  },
  {
    id: 'cac08407-7fc0-4d6b-85ab-7360e5fc5e91',
    field: TOUCH_LOGGED_BY_FIELD_UNIVERSAL_IDENTIFIER,
    size: 160,
  },
];

export default defineView({
  universalIdentifier: ALL_TOUCHES_VIEW_UNIVERSAL_IDENTIFIER,
  name: 'All Touches',
  objectUniversalIdentifier: TOUCH_OBJECT_UNIVERSAL_IDENTIFIER,
  type: ViewType.TABLE,
  icon: 'IconHandClick',
  position: 0,
  fields: VIEW_FIELDS.map(({ id, field, size }, position) => ({
    universalIdentifier: id,
    fieldMetadataUniversalIdentifier: field,
    position,
    isVisible: true,
    size,
  })),
});
