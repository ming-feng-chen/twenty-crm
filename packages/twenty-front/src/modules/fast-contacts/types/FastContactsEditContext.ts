import { type FastContactsCellFormatContext } from '@/fast-contacts/types/FastContactsCellFormatContext';
import { type FastContactsColumnKey } from '@/fast-contacts/types/FastContactsColumn';
import {
  type FastContactsCompany,
  type FastContactsOwner,
} from '@/fast-contacts/types/FastContactsPerson';

export type FastContactsMember = FastContactsOwner & {
  userEmail: string | null;
};

export type FastContactsEditContext = {
  formatContext: FastContactsCellFormatContext;
  companies: FastContactsCompany[];
  members: FastContactsMember[];
  requiredColumnKeys: FastContactsColumnKey[];
};
