import { type FastContactsColumnKey } from '@/fast-contacts/types/FastContactsColumn';

// `initialText` is set when typing started the edit, and replaces the value.
export type FastContactsEditingCell = {
  personId: string;
  columnKey: FastContactsColumnKey;
  initialText: string | null;
};
