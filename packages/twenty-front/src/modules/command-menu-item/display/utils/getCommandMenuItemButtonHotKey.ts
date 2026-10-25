import { type CommandMenuItemFieldsFragment } from '~/generated-metadata/graphql';

// AirPal: the owner removed single-letter command shortcuts, so no button gets one.
export const getCommandMenuItemButtonHotKey = (
  _commandMenuItem: Pick<CommandMenuItemFieldsFragment, 'hotKeys'>,
): string | undefined => undefined;
