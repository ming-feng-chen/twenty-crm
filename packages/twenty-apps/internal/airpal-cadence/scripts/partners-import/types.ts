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
  // Set when an existing company is reused under the Sheet's name (e.g. one
  // email sync named after its domain), so the import renames it.
  existingName?: string | null;
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
  companyKey: string | null;
  existingPersonId: string | null;
  existingPersonName: string | null;
  matchedBy: 'linkedin' | 'email' | 'name' | 'similar name' | null;
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
  sheetTab?: 'Partners' | 'Airports';
  generatedAt: string;
  today: string;
  sources: Record<string, { file: string; sha256: string }>;
  companies: PlannedCompany[];
  people: PlannedPerson[];
  // Existing companies whose every contact moves to a Sheet organisation; the
  // import moves them to the bin if they are still empty.
  crmCompaniesLeftEmpty?: { id: string; name: string }[];
};
