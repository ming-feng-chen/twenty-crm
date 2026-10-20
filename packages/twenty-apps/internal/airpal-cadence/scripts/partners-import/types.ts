export type PlannedTouch = {
  channel: string;
  direction: string;
  outcome: string;
  occurredOn: string;
  occurredAt: string | null;
  origin: 'sheet-event' | 'rebuilt';
  reason: string;
};

export type PlannedCompany = {
  key: string;
  name: string;
  existingId: string | null;
  group: 'PARTNER' | 'AIRPORT';
  category: string | null;
  // Lets Twenty's "Create company when adding new person" workflow match the
  // contacts' email domain to this company instead of creating another.
  domain: string | null;
};

export type PlannedPerson = {
  sheetId: string;
  name: string;
  firstName: string;
  lastName: string;
  companyKey: string;
  existingPersonId: string | null;
  existingPersonName: string | null;
  matchedBy: 'linkedin' | 'email' | 'name' | null;
  jobTitle: string;
  email: string | null;
  linkedinUrl: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  stage: string;
  health: string;
  optOutReason: string | null;
  nextActionDate: string | null;
  connectionNote: string | null;
  note: { title: string; markdown: string };
  sheet: {
    stage: string;
    nextAction: string;
    nextActionDate: string;
    lastTouch: string;
    touchCount: number;
  };
  touches: PlannedTouch[];
  skippedEvents: string[];
  engine: {
    stepLabel: string;
    positionLabel: string;
    state: string;
    nextActionDate: string | null;
    isDue: boolean;
  };
  flags: string[];
};

export type ImportPlan = {
  generatedAt: string;
  today: string;
  sources: Record<string, { file: string; sha256: string }>;
  companies: PlannedCompany[];
  people: PlannedPerson[];
};
