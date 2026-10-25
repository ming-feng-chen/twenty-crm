import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';

export type FastContactsFullLoad = {
  loadId: number;
  startedAt: number;
  recordIdsChangedDuringLoad: Set<string> | null;
};

export const fastContactsFullLoadState = createAtomState<FastContactsFullLoad>({
  key: 'fastContactsFullLoadState',
  defaultValue: {
    loadId: 0,
    startedAt: 0,
    recordIdsChangedDuringLoad: null,
  },
});
