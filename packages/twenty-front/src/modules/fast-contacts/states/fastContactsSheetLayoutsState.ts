import { isPlainObject } from 'twenty-shared/utils';

import { type FastContactsTabKey } from '@/fast-contacts/types/FastContactsTab';
import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';

// Raw stored layouts per sheet; read them through normalizeFastContactsSheetLayout.
export const fastContactsSheetLayoutsState = createAtomState<
  Partial<Record<FastContactsTabKey, unknown>>
>({
  key: 'fastContactsSheetLayoutsState',
  defaultValue: {},
  useLocalStorage: true,
  localStorageOptions: { getOnInit: true },
  validateInitFn: (sheetLayouts) => isPlainObject(sheetLayouts),
});
