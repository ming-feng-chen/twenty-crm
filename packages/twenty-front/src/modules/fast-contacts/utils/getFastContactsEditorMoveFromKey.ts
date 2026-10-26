import { type KeyboardEvent } from 'react';

import { type FastContactsEditorMove } from '@/fast-contacts/types/FastContactsEditorMove';

export const getFastContactsEditorMoveFromKey = (
  event: KeyboardEvent,
): FastContactsEditorMove | null => {
  if (event.key === 'Enter' && !event.shiftKey) {
    return 'down';
  }

  if (event.key === 'Tab') {
    return event.shiftKey ? 'left' : 'right';
  }

  return null;
};
