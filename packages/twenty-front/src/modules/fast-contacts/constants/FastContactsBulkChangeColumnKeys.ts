import { type FastContactsColumnKey } from '@/fast-contacts/types/FastContactsColumn';

// Text columns are bulk-changed by pasting instead.
export const FAST_CONTACTS_BULK_CHANGE_COLUMN_KEYS: FastContactsColumnKey[] = [
  'cadenceOwner',
  'cadenceStage',
  'cadenceHealth',
  'company',
  'nextActionDate',
  'snoozeUntil',
  'revisitDate',
  'optedOut',
  'optOutReason',
];
