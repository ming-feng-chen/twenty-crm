import { atom, useStore } from 'jotai';
import { useState } from 'react';

// Enter or Tab close an editor, and the blur that follows must not save a second time.
export const useFastContactsEditorClose = () => {
  const store = useStore();
  const [isClosedAtom] = useState(() => atom(false));

  return (action: () => void) => {
    if (store.get(isClosedAtom)) {
      return;
    }

    store.set(isClosedAtom, true);
    action();
  };
};
