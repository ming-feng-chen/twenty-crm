import { msg } from '@lingui/core/macro';
import { isDefined } from 'twenty-shared/utils';

import { FAST_CONTACTS_COLD_EXCLUDED_STAGES } from '@/fast-contacts/constants/FastContactsColdExcludedStages';
import { type FastContactsTab } from '@/fast-contacts/types/FastContactsTab';

// Partner and Airport match the Partner contacts and Airport contacts views
// (the company's Group); Cold matches the Cold view.
export const FAST_CONTACTS_TABS: FastContactsTab[] = [
  { key: 'all', label: msg`All`, includesPerson: () => true },
  {
    key: 'partner',
    label: msg`Partner contacts`,
    includesPerson: (person) => person.company?.group === 'PARTNER',
  },
  {
    key: 'airport',
    label: msg`Airport contacts`,
    includesPerson: (person) => person.company?.group === 'AIRPORT',
  },
  {
    key: 'cold',
    label: msg`Cold`,
    includesPerson: (person) =>
      !isDefined(person.nextActionDate) &&
      !FAST_CONTACTS_COLD_EXCLUDED_STAGES.includes(person.cadenceStage ?? ''),
  },
  // Rows come from the deleted contacts, not from the live list.
  {
    key: 'deleted',
    label: msg`Deleted`,
    includesPerson: () => true,
    isDeletedSheet: true,
  },
];
