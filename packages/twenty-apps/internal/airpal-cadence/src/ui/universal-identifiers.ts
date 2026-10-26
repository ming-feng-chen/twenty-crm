// Universal identifiers of the UI entities added after the spike. The spike's
// own (My Day, the rules settings, Did it) stay in
// src/constants/universal-identifiers.ts so deployed entities keep their ids.

// front components
export const LOGGED_TOUCH_PANEL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER =
  'df8ecb36-6614-4b9b-b8f3-894ae6032e9b';
export const CHANGE_OWNER_COMMAND_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER =
  '04c1ab47-f2bb-42e4-ae8b-7aa941834a62';
export const RECOMPUTE_COMMAND_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER =
  '4e53d00d-b52e-4c0f-b7ab-6d853e92c132';

// command menu items
export const CHANGE_OWNER_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER =
  'db209c47-56b6-4b60-a484-4a2574b7bbfe';
export const RECOMPUTE_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER =
  'cce001c7-3969-4d6e-aa98-c799362c6ea8';

// My Day page: the Cadence rules tab (members cannot open Settings ->
// Applications, so the rules are readable here too)
export const MY_DAY_RULES_TAB_UNIVERSAL_IDENTIFIER =
  '793fb172-fdce-43bf-982a-fe8e9cf317c3';
export const MY_DAY_RULES_WIDGET_UNIVERSAL_IDENTIFIER =
  '96c45d0e-cdf2-455a-aae2-817d2260ed74';

// Sidebar link to the Contacts page, which lives in twenty-front at /contacts
export const CONTACTS_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER =
  '8a543c1e-e7ea-445d-8c8b-5bb381acfaa6';

// Cold view
export const COLD_VIEW_UNIVERSAL_IDENTIFIER = 'a26c6a00-788a-4634-aea7-06edccdefb27';
export const COLD_VIEW_NO_DATE_FILTER_UNIVERSAL_IDENTIFIER =
  'b08b7700-f63c-4508-b39f-3944ea15bccf';
export const COLD_VIEW_LIVE_STAGE_FILTER_UNIVERSAL_IDENTIFIER =
  'dada4c9b-040d-4e66-a081-c75a673c399f';
export const COLD_VIEW_SORT_UNIVERSAL_IDENTIFIER = '05b8f2c3-3030-4926-bab0-6b3d86bd60f3';
export const COLD_VIEW_FIELD_UNIVERSAL_IDENTIFIERS = {
  name: 'a0cfec37-1025-4219-a1c8-9a9d90f106ff',
  company: 'ed63c177-bb6f-45ff-856d-9009309f2aa8',
  owner: '46064d52-7041-4f9c-89e0-93302d47c459',
  stage: '0a96692c-6b16-449c-a84f-0611850c7c00',
  step: '254fd381-a593-461a-938b-a8ebf37c9599',
  health: '4db7bb27-7e4f-4bd4-80ee-b4e649013e89',
  touches: '4fbd9547-c3da-409f-b5e9-678f2d1c3e3b',
  emails: '5a2eee42-f513-47af-ba6c-34cd95402072',
  linkedin: '969bf0b0-b39f-47e9-80de-98d27b6d6001',
  lastTouchOn: '6b4a89cf-b253-4fd8-b555-b0e0e90c4169',
} as const;

// "My Day (table)": the native fallback view
export const MY_DAY_TABLE_VIEW_UNIVERSAL_IDENTIFIER = '62095d5c-534f-4ce2-aadf-976ab9f400eb';
export const MY_DAY_TABLE_OWNER_FILTER_UNIVERSAL_IDENTIFIER =
  '605f1e1c-3b9f-4f62-9f1d-6a1c1acfbab6';
export const MY_DAY_TABLE_DUE_FILTER_UNIVERSAL_IDENTIFIER =
  'c24e144a-7a72-4dda-a3af-496bb41c40e3';
export const MY_DAY_TABLE_SORT_UNIVERSAL_IDENTIFIER = '5ec25774-c7ff-4ad6-ac12-d4633cae9d26';
export const MY_DAY_TABLE_VIEW_FIELD_UNIVERSAL_IDENTIFIERS = {
  name: 'f852b26b-25db-49d0-acc9-6819f41816fe',
  company: '6765abc1-0d3a-4fb0-9496-86009f27f7e0',
  stage: 'bc0dfa04-bf33-4ff9-86bf-06c9e83ab7c3',
  step: 'f38f87b0-e73a-4b57-880b-2cfb24662e5d',
  nextActionDate: 'a2245918-d43a-41ae-ae3b-5267efaf1bd9',
  owner: '9a377d9c-fedf-458a-be43-645dfcdd9684',
  emails: '407eefdf-a77c-45be-b1f0-52f80136e1df',
  lastTouchOn: 'a898b605-c0c8-46cc-b47b-0d132ab949ab',
} as const;
