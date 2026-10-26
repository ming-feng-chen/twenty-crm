import { type FastContactsCellPosition } from '@/fast-contacts/types/FastContactsCellPosition';

// A cell range from anchor to focus, or, after clicking row numbers, whole rows.
export type FastContactsSelection = {
  anchor: FastContactsCellPosition;
  focus: FastContactsCellPosition;
  selectedRowIds: string[] | null;
};
