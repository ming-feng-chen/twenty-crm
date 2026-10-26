import { TAG_COLOR_OPTIONS, type TagColorValue } from 'src/constants/tag-values';

export const normalizeTagName = (name: string): string =>
  name.trim().replace(/\s+/g, ' ');

export const isSameTagName = (first: string, second: string): boolean =>
  normalizeTagName(first).toLocaleLowerCase() ===
  normalizeTagName(second).toLocaleLowerCase();

// New tags cycle through the palette so neighbours look different.
export const pickTagColor = (existingTagCount: number): TagColorValue =>
  TAG_COLOR_OPTIONS[existingTagCount % TAG_COLOR_OPTIONS.length].value;
