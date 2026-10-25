import { msg } from '@lingui/core/macro';

import { type FastContactsColumn } from '@/fast-contacts/types/FastContactsColumn';

export const FAST_CONTACTS_COLUMNS: FastContactsColumn[] = [
  { key: 'name', label: msg`Name`, defaultWidth: 200 },
  { key: 'company', label: msg`Company`, defaultWidth: 180 },
  { key: 'jobTitle', label: msg`Job title`, defaultWidth: 180 },
  { key: 'cadenceOwner', label: msg`Owner`, defaultWidth: 140 },
  { key: 'cadenceStage', label: msg`Stage`, defaultWidth: 180 },
  { key: 'cadenceStep', label: msg`Step`, defaultWidth: 160 },
  { key: 'nextActionDate', label: msg`Next action date`, defaultWidth: 140 },
  { key: 'lastTouchOn', label: msg`Last touch`, defaultWidth: 120 },
  { key: 'linkedinLink', label: msg`LinkedIn`, defaultWidth: 180 },
  { key: 'emails', label: msg`Email`, defaultWidth: 220 },
  {
    key: 'linkedinConnectionNote',
    label: msg`Connection note`,
    defaultWidth: 260,
  },
];
