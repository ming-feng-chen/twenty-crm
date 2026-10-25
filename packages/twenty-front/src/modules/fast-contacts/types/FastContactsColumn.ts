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
  | 'linkedinConnectionNote';

export type FastContactsColumn = {
  key: FastContactsColumnKey;
  label: MessageDescriptor;
  defaultWidth: number;
};
