import { msg } from '@lingui/core/macro';

import { type FastContactsTab } from '@/fast-contacts/types/FastContactsTab';

// Same membership as the Partner contacts and Airport contacts views: the company's Group.
export const FAST_CONTACTS_TABS: FastContactsTab[] = [
  { key: 'all', label: msg`All`, companyGroup: null },
  { key: 'partner', label: msg`Partner contacts`, companyGroup: 'PARTNER' },
  { key: 'airport', label: msg`Airport contacts`, companyGroup: 'AIRPORT' },
];
