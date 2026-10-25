import { FAST_CONTACTS_TABS } from '@/fast-contacts/constants/FastContactsTabs';
import { type FastContactsTabKey } from '@/fast-contacts/types/FastContactsTab';
import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';

export const fastContactsActiveTabState = createAtomState<FastContactsTabKey>({
  key: 'fastContactsActiveTabState',
  defaultValue: 'all',
  useLocalStorage: true,
  localStorageOptions: { getOnInit: true },
  validateInitFn: (tabKey) =>
    FAST_CONTACTS_TABS.some((tab) => tab.key === tabKey),
});
