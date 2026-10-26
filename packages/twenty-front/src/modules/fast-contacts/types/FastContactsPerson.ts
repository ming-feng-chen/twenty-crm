import {
  type FieldEmailsValue,
  type FieldFullNameValue,
  type FieldLinksValue,
  type FieldPhonesValue,
} from '@/object-record/record-field/ui/types/FieldMetadata';

export type FastContactsCompany = {
  id: string;
  name: string | null;
  group: string | null;
};

export type FastContactsOwner = {
  id: string;
  name: FieldFullNameValue | null;
};

export type FastContactsTag = {
  id: string;
  name: string | null;
  color: string | null;
};

export type FastContactsPerson = {
  id: string;
  position: number | null;
  createdAt: string;
  updatedAt: string;
  name: FieldFullNameValue | null;
  jobTitle: string | null;
  city: string | null;
  cadenceStage: string | null;
  cadenceStep: string | null;
  cadenceState: string | null;
  cadenceHealth: string | null;
  nextActionDate: string | null;
  lastTouchOn: string | null;
  snoozeUntil: string | null;
  revisitDate: string | null;
  optedOut: boolean | null;
  optOutReason: string | null;
  linkedinLink: FieldLinksValue | null;
  emails: FieldEmailsValue | null;
  phones: FieldPhonesValue | null;
  linkedinConnectionNote: string | null;
  company: FastContactsCompany | null;
  cadenceOwner: FastContactsOwner | null;
  tags: FastContactsTag[];
};
