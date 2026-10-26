// Twenty resets SELECT options to these on every app deploy, so colours are
// added here, not in the data model settings.
export const TAG_COLOR_OPTIONS = [
  { value: 'BLUE', label: 'Blue', color: 'blue', position: 0 },
  { value: 'GREEN', label: 'Green', color: 'green', position: 1 },
  { value: 'ORANGE', label: 'Orange', color: 'orange', position: 2 },
  { value: 'PURPLE', label: 'Purple', color: 'purple', position: 3 },
  { value: 'RED', label: 'Red', color: 'red', position: 4 },
  { value: 'TURQUOISE', label: 'Turquoise', color: 'turquoise', position: 5 },
  { value: 'PINK', label: 'Pink', color: 'pink', position: 6 },
  { value: 'YELLOW', label: 'Yellow', color: 'yellow', position: 7 },
  { value: 'SKY', label: 'Sky', color: 'sky', position: 8 },
  { value: 'GRAY', label: 'Gray', color: 'gray', position: 9 },
] as const;

export type TagColorValue = (typeof TAG_COLOR_OPTIONS)[number]['value'];

// Created on install when the workspace has never had a tag.
export const DEFAULT_TAG_NAMES = [
  'Partnership & innovation',
  'Marketing & customer',
  'Digital tech',
  'Commercial & retail',
  'Leadership',
] as const;
