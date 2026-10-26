import { describe, expect, it } from 'vitest';

import { TAG_COLOR_OPTIONS } from 'src/constants/tag-values';
import {
  isSameTagName,
  normalizeTagName,
  pickTagColor,
} from 'src/utils/tag-names';

describe('tag names', () => {
  it('trims and collapses spaces', () => {
    expect(normalizeTagName('  Digital   tech ')).toBe('Digital tech');
  });

  it('treats names differing only in case or spacing as the same tag', () => {
    expect(isSameTagName('digital  TECH', 'Digital tech')).toBe(true);
    expect(isSameTagName('Digital', 'Digital tech')).toBe(false);
  });

  it('cycles through the palette', () => {
    expect(pickTagColor(0)).toBe('BLUE');
    expect(pickTagColor(1)).toBe('GREEN');
    expect(pickTagColor(TAG_COLOR_OPTIONS.length)).toBe('BLUE');
  });
});
