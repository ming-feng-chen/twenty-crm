import { type TagColor } from 'twenty-ui/primitives/data-display';
import { MAIN_COLOR_NAMES } from 'twenty-ui/theme';

// Tags store the Cadence app's colour option value (BLUE); the theme names
// the same colour in lower case.
export const getFastContactsTagColor = (color: string | null): TagColor => {
  const themeColor = color?.toLowerCase();

  return MAIN_COLOR_NAMES.find((name) => name === themeColor) ?? 'gray';
};
