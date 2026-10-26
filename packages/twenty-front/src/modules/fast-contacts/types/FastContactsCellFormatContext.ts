import { type Locale } from 'date-fns';

import { type FastContactsColumnKey } from '@/fast-contacts/types/FastContactsColumn';
import { type DateFormat } from '@/localization/constants/DateFormat';
import { type FieldDateMetadataSettings } from '@/object-record/record-field/ui/types/FieldMetadata';

export type FastContactsSelectOption = {
  value: string;
  label: string;
  position: number;
};

export type FastContactsCellFormatContext = {
  dateFormat: DateFormat;
  localeCatalog: Locale;
  timeZone: string;
  selectOptionsByColumnKey: Partial<
    Record<FastContactsColumnKey, FastContactsSelectOption[]>
  >;
  dateSettingsByColumnKey: Partial<
    Record<FastContactsColumnKey, FieldDateMetadataSettings>
  >;
};
