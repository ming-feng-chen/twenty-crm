import { type MessageDescriptor } from '@lingui/core';

export type FastContactsTabKey = 'all' | 'partner' | 'airport';

export type FastContactsTab = {
  key: FastContactsTabKey;
  label: MessageDescriptor;
  companyGroup: string | null;
};
