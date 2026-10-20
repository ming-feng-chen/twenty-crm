import { type RecordPickerPickableMorphItem } from '@/object-record/record-picker/types/RecordPickerPickableMorphItem';

export type MultipleRecordPickerSelectAllOption = {
  recordIds: string[];
  objectMetadataId: string;
  onChange: (changedMorphItems: RecordPickerPickableMorphItem[]) => void;
};
