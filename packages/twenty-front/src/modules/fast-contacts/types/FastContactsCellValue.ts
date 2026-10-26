import { type FastContactsColumnKey } from '@/fast-contacts/types/FastContactsColumn';
import { type FastContactsPerson } from '@/fast-contacts/types/FastContactsPerson';

export type FastContactsCellValue = FastContactsPerson[FastContactsColumnKey];

export type FastContactsCellValueResult =
  | { isValid: true; value: FastContactsCellValue }
  | { isValid: false; error: string };
