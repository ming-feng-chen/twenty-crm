import { type FastContactsPerson } from '@/fast-contacts/types/FastContactsPerson';
import { applyFastContactsRefresh } from '@/fast-contacts/utils/applyFastContactsRefresh';
import { mergeFastContactsFullLoad } from '@/fast-contacts/utils/mergeFastContactsFullLoad';

const buildPerson = (id: string, jobTitle: string): FastContactsPerson => ({
  id,
  position: 0,
  updatedAt: '2026-10-22T10:00:00.000Z',
  name: null,
  jobTitle,
  cadenceStage: null,
  cadenceStep: null,
  nextActionDate: null,
  lastTouchOn: null,
  linkedinLink: null,
  emails: null,
  linkedinConnectionNote: null,
  company: null,
  cadenceOwner: null,
});

describe('mergeFastContactsFullLoad', () => {
  it('should replace the state with the loaded people', () => {
    const merged = mergeFastContactsFullLoad({
      currentPeopleById: new Map([['gone', buildPerson('gone', 'old')]]),
      loadedPeople: [buildPerson('a', 'loaded')],
      recordIdsChangedDuringLoad: new Set(),
    });

    expect([...merged.keys()]).toEqual(['a']);
  });

  it('should keep live changes made while the load was running', () => {
    const merged = mergeFastContactsFullLoad({
      currentPeopleById: new Map([['a', buildPerson('a', 'live edit')]]),
      loadedPeople: [buildPerson('a', 'stale'), buildPerson('b', 'deleted')],
      recordIdsChangedDuringLoad: new Set(['a', 'b']),
    });

    expect(merged.get('a')?.jobTitle).toBe('live edit');
    expect(merged.has('b')).toBe(false);
  });
});

describe('applyFastContactsRefresh', () => {
  it('should upsert refreshed people and drop the ones no longer returned', () => {
    const next = applyFastContactsRefresh({
      currentPeopleById: new Map([
        ['a', buildPerson('a', 'old')],
        ['b', buildPerson('b', 'kept')],
        ['c', buildPerson('c', 'deleted')],
      ]),
      refreshedPeople: [buildPerson('a', 'new')],
      recordIdsToRemoveIfMissing: ['a', 'c'],
    });

    expect(next.get('a')?.jobTitle).toBe('new');
    expect(next.get('b')?.jobTitle).toBe('kept');
    expect(next.has('c')).toBe(false);
  });
});
