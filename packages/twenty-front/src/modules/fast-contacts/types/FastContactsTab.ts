import { type MessageDescriptor } from '@lingui/core';

import { type FastContactsPerson } from '@/fast-contacts/types/FastContactsPerson';

export type FastContactsTabKey =
  | 'all'
  | 'partner'
  | 'airport'
  | 'cold'
  | 'deleted';

export type FastContactsTab = {
  key: FastContactsTabKey;
  label: MessageDescriptor;
  includesPerson: (person: FastContactsPerson) => boolean;
  isDeletedSheet?: boolean;
};
