import { type FastContactsCellValue } from '@/fast-contacts/types/FastContactsCellValue';
import { type FastContactsColumnKey } from '@/fast-contacts/types/FastContactsColumn';

export type FastContactsCellWrite = {
  personId: string;
  columnKey: FastContactsColumnKey;
  value: FastContactsCellValue;
};

export type FastContactsSkippedCell = {
  personId: string;
  columnKey: FastContactsColumnKey;
  reason: string;
};

export type FastContactsCellChange = FastContactsCellWrite & {
  previousValue: FastContactsCellValue;
};

export type FastContactsOwnerChangeMode = 'START_FRESH' | 'KEEP_POSITION';
