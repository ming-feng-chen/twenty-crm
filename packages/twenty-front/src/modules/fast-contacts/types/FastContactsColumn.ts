import { type MessageDescriptor } from '@lingui/core';

export type FastContactsColumnKey =
  | 'name'
  | 'company'
  | 'jobTitle'
  | 'cadenceOwner'
  | 'cadenceStage'
  | 'cadenceStep'
  | 'nextActionDate'
  | 'lastTouchOn'
  | 'linkedinLink'
  | 'emails'
  | 'linkedinConnectionNote'
  | 'phones'
  | 'city'
  | 'cadenceHealth'
  | 'snoozeUntil'
  | 'revisitDate'
  | 'optedOut'
  | 'optOutReason'
  | 'createdAt';

export type FastContactsColumnKind =
  | 'fullName'
  | 'company'
  | 'owner'
  | 'text'
  | 'select'
  | 'date'
  | 'dateTime'
  | 'boolean'
  | 'emails'
  | 'phones'
  | 'links';

export type FastContactsColumn = {
  key: FastContactsColumnKey;
  kind: FastContactsColumnKind;
  label: MessageDescriptor;
  defaultWidth: number;
  isEditable: boolean;
  isVisibleByDefault: boolean;
};
