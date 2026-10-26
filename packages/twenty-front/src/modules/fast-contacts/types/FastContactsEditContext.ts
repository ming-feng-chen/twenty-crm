import { type FastContactsCellFormatContext } from '@/fast-contacts/types/FastContactsCellFormatContext';
import { type FastContactsColumnKey } from '@/fast-contacts/types/FastContactsColumn';
import {
  type FastContactsCompany,
  type FastContactsOwner,
  type FastContactsTag,
} from '@/fast-contacts/types/FastContactsPerson';

export type FastContactsMember = FastContactsOwner & {
  userEmail: string | null;
};

export type FastContactsEditContext = {
  formatContext: FastContactsCellFormatContext;
  companies: FastContactsCompany[];
  tags: FastContactsTag[];
  members: FastContactsMember[];
  requiredColumnKeys: FastContactsColumnKey[];
};
