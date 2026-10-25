import {
  type FieldEmailsValue,
  type FieldFullNameValue,
  type FieldLinksValue,
} from '@/object-record/record-field/ui/types/FieldMetadata';

export type FastContactsPerson = {
  id: string;
  position: number | null;
  updatedAt: string;
  name: FieldFullNameValue | null;
  jobTitle: string | null;
  cadenceStage: string | null;
  cadenceStep: string | null;
  nextActionDate: string | null;
  lastTouchOn: string | null;
  linkedinLink: FieldLinksValue | null;
  emails: FieldEmailsValue | null;
  linkedinConnectionNote: string | null;
  company: {
    id: string;
    name: string | null;
    group: string | null;
  } | null;
  cadenceOwner: {
    id: string;
    name: FieldFullNameValue | null;
  } | null;
};
