import { isPlainObject } from 'twenty-shared/utils';

import { type FastContactsColumnKey } from '@/fast-contacts/types/FastContactsColumn';
import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';

export const fastContactsColumnWidthsState = createAtomState<
  Partial<Record<FastContactsColumnKey, number>>
>({
  key: 'fastContactsColumnWidthsState',
  defaultValue: {},
  useLocalStorage: true,
  localStorageOptions: { getOnInit: true },
  validateInitFn: (columnWidths) => isPlainObject(columnWidths),
});
