import { type Locale } from 'date-fns';

import { type DateFormat } from '@/localization/constants/DateFormat';
import { type FieldDateMetadataSettings } from '@/object-record/record-field/ui/types/FieldMetadata';

export type FastContactsCellFormatContext = {
  dateFormat: DateFormat;
  localeCatalog: Locale;
  stageLabelByValue: Map<string, string>;
  nextActionDateSettings?: FieldDateMetadataSettings;
  lastTouchOnSettings?: FieldDateMetadataSettings;
};
