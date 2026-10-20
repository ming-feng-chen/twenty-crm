import {
  type CadenceActionsView,
  parseCadenceActions,
} from 'src/ui/cadence-actions';
import { toCivilDate } from 'src/ui/dates';

// My Day's rows and how they are ordered (SPEC §6): "Reply to them" first,
// then Overdue, then Due today, oldest first in each; Everyone is grouped by
// owner and never shows unowned contacts.

export type MyDayPerson = {
  id: string;
  name: string;
  companyName: string | null;
  companyGroup: string | null;
  stage: string | null;
  step: string | null;
  state: string | null;
  health: string | null;
  nextActionDate: string | null;
  ownerId: string | null;
  primaryEmail: string | null;
  additionalEmails: string[];
  snoozeUntil: string | null;
  revisitDate: string | null;
  optedOut: boolean;
  optOutReason: string | null;
  isDue: boolean;
  actions: CadenceActionsView | null;
  actionsProblem: string | null;
};

// The person as the core API returns it for My Day.
export type PersonNode = {
  id: string;
  name?: { firstName?: string | null; lastName?: string | null } | null;
  company?: { name?: string | null; group?: string | null } | null;
  emails?: {
    primaryEmail?: string | null;
    additionalEmails?: unknown;
  } | null;
  cadenceStage?: string | null;
  cadenceStep?: string | null;
  cadenceState?: string | null;
  cadenceHealth?: string | null;
  nextActionDate?: unknown;
  cadenceOwnerId?: string | null;
  snoozeUntil?: unknown;
  revisitDate?: unknown;
  optedOut?: boolean | null;
  optOutReason?: string | null;
  cadenceDue?: boolean | null;
  cadenceActions?: unknown;
};

export const personName = (
  name: PersonNode['name'] | undefined,
): string => {
  const full = [name?.firstName, name?.lastName]
    .filter((part) => typeof part === 'string' && part.trim().length > 0)
    .map((part) => (part as string).trim())
    .join(' ');

  return full.length > 0 ? full : 'Unnamed person';
};

const nonEmpty = (value: string | null | undefined): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

export const toMyDayPerson = (node: PersonNode): MyDayPerson => {
  const parsed = parseCadenceActions(node.cadenceActions);

  return {
    id: node.id,
    name: personName(node.name),
    companyName: nonEmpty(node.company?.name),
    companyGroup: node.company?.group ?? null,
    stage: node.cadenceStage ?? null,
    step: nonEmpty(node.cadenceStep),
    state: node.cadenceState ?? null,
    health: node.cadenceHealth ?? null,
    nextActionDate: toCivilDate(node.nextActionDate),
    ownerId: nonEmpty(node.cadenceOwnerId),
    primaryEmail: nonEmpty(node.emails?.primaryEmail),
    additionalEmails: Array.isArray(node.emails?.additionalEmails)
      ? (node.emails.additionalEmails as unknown[]).filter(
          (entry): entry is string => typeof entry === 'string',
        )
      : [],
    snoozeUntil: toCivilDate(node.snoozeUntil),
    revisitDate: toCivilDate(node.revisitDate),
    optedOut: node.optedOut === true,
    optOutReason: node.optOutReason ?? null,
    isDue: node.cadenceDue === true,
    actions: parsed.ok ? parsed.value : null,
    actionsProblem: parsed.ok ? null : parsed.reason,
  };
};

// The cadence fields a route returns after an action (README: `person`),
// merged into the row we already show (routes do not return name/company).
export type RoutePersonView = {
  personId?: string;
  cadenceOwnerId?: string | null;
  cadenceStage?: string | null;
  cadenceHealth?: string | null;
  nextActionDate?: unknown;
  snoozeUntil?: unknown;
  revisitDate?: unknown;
  optedOut?: boolean | null;
  optOutReason?: string | null;
  cadenceStep?: string | null;
  cadenceState?: string | null;
  cadenceDue?: boolean | null;
  cadenceActions?: unknown;
};

export const mergeRoutePerson = (
  person: MyDayPerson,
  view: RoutePersonView,
): MyDayPerson => {
  const fresh = toMyDayPerson({
    id: person.id,
    cadenceStage: view.cadenceStage,
    cadenceStep: view.cadenceStep,
    cadenceState: view.cadenceState,
    cadenceHealth: view.cadenceHealth,
    nextActionDate: view.nextActionDate,
    cadenceOwnerId: view.cadenceOwnerId,
    snoozeUntil: view.snoozeUntil,
    revisitDate: view.revisitDate,
    optedOut: view.optedOut,
    optOutReason: view.optOutReason,
    cadenceDue: view.cadenceDue,
    cadenceActions: view.cadenceActions,
  });

  return {
    ...fresh,
    name: person.name,
    companyName: person.companyName,
    companyGroup: person.companyGroup,
    primaryEmail: person.primaryEmail,
    additionalEmails: person.additionalEmails,
  };
};

export type CompanyGroupFilter = 'ALL' | 'PARTNER' | 'AIRPORT';

export const filterByCompanyGroup = (
  people: MyDayPerson[],
  filter: CompanyGroupFilter,
): MyDayPerson[] =>
  filter === 'ALL' ? people : people.filter((person) => person.companyGroup === filter);

export type SectionKey = 'replyOwed' | 'overdue' | 'dueToday';

export const SECTION_TITLES: Record<SectionKey, string> = {
  replyOwed: 'Reply to them',
  overdue: 'Overdue',
  dueToday: 'Due today',
};

const SECTION_ORDER: SectionKey[] = ['replyOwed', 'overdue', 'dueToday'];

export const isReplyOwed = (person: MyDayPerson): boolean =>
  person.state === 'REPLY_OWED' || person.actions?.state === 'REPLY_OWED';

export const sectionOf = (person: MyDayPerson, today: string): SectionKey => {
  if (isReplyOwed(person)) {
    return 'replyOwed';
  }

  return person.nextActionDate !== null && person.nextActionDate < today
    ? 'overdue'
    : 'dueToday';
};

const compareText = (first: string, second: string) =>
  first.localeCompare(second, 'en-GB', { sensitivity: 'base' });

// Oldest first; a reply owed longest comes first among replies.
const sortKey = (person: MyDayPerson): string =>
  (isReplyOwed(person) ? person.actions?.replyOwedSince : null) ??
  person.nextActionDate ??
  '9999-12-31';

export const comparePeople = (first: MyDayPerson, second: MyDayPerson) =>
  sortKey(first).localeCompare(sortKey(second)) ||
  compareText(first.name, second.name) ||
  first.id.localeCompare(second.id);

export type Section = {
  key: SectionKey;
  title: string;
  people: MyDayPerson[];
};

// All three sections, in order, even when empty, so counts can be shown.
export const buildSections = (
  people: readonly MyDayPerson[],
  today: string,
): Section[] =>
  SECTION_ORDER.map((key) => ({
    key,
    title: SECTION_TITLES[key],
    people: people
      .filter((person) => sectionOf(person, today) === key)
      .sort(comparePeople),
  }));

export type MemberSummary = { id: string; displayName: string };

export type OwnerGroup = {
  ownerId: string;
  ownerName: string;
  sections: Section[];
  total: number;
};

// Everyone: one group per owner, by owner name; unowned contacts never appear
// (the old rules), even if the query let one through.
export const groupByOwner = (
  people: readonly MyDayPerson[],
  members: readonly MemberSummary[],
  today: string,
): OwnerGroup[] => {
  const byOwner = new Map<string, MyDayPerson[]>();

  for (const person of people) {
    if (person.ownerId === null) {
      continue;
    }

    byOwner.set(person.ownerId, [...(byOwner.get(person.ownerId) ?? []), person]);
  }

  return [...byOwner.entries()]
    .map(([ownerId, owned]) => ({
      ownerId,
      ownerName:
        members.find((member) => member.id === ownerId)?.displayName ??
        'A former member',
      sections: buildSections(owned, today),
      total: owned.length,
    }))
    .sort(
      (first, second) =>
        compareText(first.ownerName, second.ownerName) ||
        first.ownerId.localeCompare(second.ownerId),
    );
};

export type Selection =
  | { kind: 'me' }
  | { kind: 'member'; memberId: string }
  | { kind: 'everyone' };

export const ME: Selection = { kind: 'me' };
export const EVERYONE: Selection = { kind: 'everyone' };

export const selectionToValue = (selection: Selection): string =>
  selection.kind === 'member' ? `member:${selection.memberId}` : selection.kind;

export const selectionFromValue = (value: string): Selection => {
  if (value === 'everyone') {
    return EVERYONE;
  }

  if (value.startsWith('member:') && value.length > 'member:'.length) {
    return { kind: 'member', memberId: value.slice('member:'.length) };
  }

  return ME;
};

// The owner filter for the query: a member id, or every owner.
export type OwnerFilter = { ownerId: string } | { anyOwner: true };

export const ownerFilterFor = (
  selection: Selection,
  viewerMemberId: string | null,
): OwnerFilter | null => {
  switch (selection.kind) {
    case 'everyone':
      return { anyOwner: true };
    case 'member':
      return { ownerId: selection.memberId };
    case 'me':
      // Without knowing who the viewer is there is no "Me" list to show;
      // the page says so instead of showing someone else's.
      return viewerMemberId === null ? null : { ownerId: viewerMemberId };
  }
};

// The owner is shown on rows unless the list is the viewer's own.
export const showsOwner = (
  selection: Selection,
  viewerMemberId: string | null,
): boolean =>
  selection.kind === 'everyone' ||
  (selection.kind === 'member' && selection.memberId !== viewerMemberId);

export const countSections = (sections: readonly Section[]) =>
  Object.fromEntries(
    sections.map((section) => [section.key, section.people.length]),
  ) as Record<SectionKey, number>;
