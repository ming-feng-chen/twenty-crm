// Builds the Partners import plan from the AirPal CRM Sheet export, its
// reconciliation pack and a CRM export, and checks each contact's resulting
// cadence step with the real engine. Reads files only; writes nothing to a CRM.
//
//   npx tsx scripts/partners-import/plan.ts --partners <csv> --pack <md>
//     --people <person.csv> --companies <company.csv> --today YYYY-MM-DD --out <dir>
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { DEFAULT_CADENCE_CONFIG } from 'src/engine/default-cadence-config';
import {
  computePersonCadence,
  type PersonRecord,
  type TouchRecord,
} from 'src/utils/person-cadence';

import { readCsv, readCsvBlock } from './csv';
import { renderReview } from './review';
import {
  type PlannedCompany,
  type PlannedPerson,
  type PlannedTouch,
  type ImportPlan,
} from './types';

const args = process.argv.slice(2);
const option = (flag: string) => {
  const index = args.indexOf(flag);

  if (index === -1 || index === args.length - 1) {
    throw new Error(`Missing ${flag}`);
  }

  return args[index + 1];
};

const partnersPath = option('--partners');
const packPath = option('--pack');
const peoplePath = option('--people');
const companiesPath = option('--companies');
const today = option('--today');
const outDirectory = option('--out');

const sha256 = (filePath: string) =>
  createHash('sha256').update(readFileSync(filePath)).digest('hex');

const partners = readCsv(readFileSync(partnersPath, 'utf8'));
const packText = readFileSync(packPath, 'utf8');
const events = readCsvBlock(packText, '## activity_history.csv');
const reconciliation = readCsvBlock(packText, '## reconciliation.csv');
const crmPeople = readCsv(readFileSync(peoplePath, 'utf8'));
const crmCompanies = readCsv(readFileSync(companiesPath, 'utf8'));

const normalize = (value: string | undefined) =>
  (value ?? '').trim().toLowerCase();
const normalizeLinkedin = (value: string | undefined) =>
  normalize(value)
    .replace(/^https?:\/\/(www\.)?/, '')
    .replace(/\/+$/, '');

const OWNER_EMAILS: Record<string, string> = {
  Feng: 'ming-feng.chen@airpal.co.uk',
  Ilesh: 'ilesh-vora@airpal.co.uk',
  Romy: 'romy-levy@airpal.co.uk',
};

const STAGES: Record<string, string> = {
  'Not contacted': 'NOT_CONTACTED',
  'Contacted, no reply': 'CONTACTED_NO_REPLY',
  'Replied, in conversation': 'REPLIED_IN_CONVERSATION',
  'Deck reviewed, follow-up needed': 'DECK_REVIEWED_FOLLOW_UP',
  Dead: 'DEAD',
  'Replied, left company': 'DEAD',
  'Replied, declined': 'DEAD',
  Invited: 'CONTACTED_NO_REPLY',
};

const OPT_OUTS: Record<string, string> = {
  'Replied, left company': 'NO_LONGER_THERE',
  'Replied, declined': 'NOT_INTERESTED',
};

// Calls are booked, so these two sit at the stage approved for that (Q5).
const MEETING_SCHEDULED_NAMES = new Set(['Nick Ames', 'Qihua Wang']);

const HEALTHS: Record<string, string> = {
  Active: 'ACTIVE',
  Hold: 'HOLD',
  Dead: 'DEAD',
};

const CATEGORIES: Record<string, string> = {
  'Duty free': 'DUTY_FREE',
  'Lounge operator': 'LOUNGE_OPERATOR',
  'Lounge network': 'LOUNGE_NETWORK',
  'F&B': 'F_AND_B',
};

// The owner tagged lux-Airport as a client (Q9).
const AIRPORT_ACCOUNTS = new Set(['lux-Airport']);

// Undated or disputed events, decided from the pack's own evidence.
const EVENT_DATE_DECISIONS: Record<string, { date: string; reason: string }> = {
  'Faiz Khan|message sent': {
    date: '2026-10-12',
    reason:
      'Dates conflict (CRM 10 Oct, thread 12 Oct morning); his reply on 12 Oct answers a morning message that day.',
  },
  'Qihua Wang|message sent': {
    date: '2026-10-12',
    reason: 'Recorded as 11-12 Oct; the Outreach log says 12 Oct.',
  },
  'Leilah King-Gotlib|connection accepted': {
    date: '2026-10-14',
    reason:
      'Recorded as 14-15 Oct; message 1 went at about 18:57 UK on 14 Oct, so she had accepted by then.',
  },
};

const splitName = (fullName: string) => {
  const [firstName, ...rest] = fullName.trim().split(/\s+/);

  return { firstName, lastName: rest.join(' ') };
};

// Local wall time in a zone to an instant, by correcting the zone's offset.
const toInstant = (date: string, time: string, timeZone: string) => {
  const match = time.replace('~', '').match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);

  if (match === null) {
    return null;
  }

  const [, hours, minutes, seconds] = match;
  const guess = Date.UTC(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
    Number(hours),
    Number(minutes),
    Number(seconds ?? '0'),
  );
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(guess));
  const part = (type: string) =>
    Number(parts.find((entry) => entry.type === type)?.value);
  const asIfUtc = Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour'),
    part('minute'),
    part('second'),
  );

  return new Date(guess - (asIfUtc - guess)).toISOString();
};

const londonDate = (instant: string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(instant));

const eventTouch = (
  event: Record<string, string>,
): Omit<PlannedTouch, 'occurredOn' | 'occurredAt' | 'origin' | 'reason'> | null => {
  switch (event.event_type) {
    case 'connection request sent':
      return { channel: 'LINKEDIN_CONNECTION', direction: 'OUTBOUND', outcome: 'SENT' };
    case 'connection accepted':
      return { channel: 'LINKEDIN_CONNECTION', direction: 'INBOUND', outcome: 'ACCEPTED' };
    case 'message sent':
      return { channel: 'LINKEDIN_MESSAGE', direction: 'OUTBOUND', outcome: 'SENT' };
    case 'reply received':
      return { channel: 'LINKEDIN_MESSAGE', direction: 'INBOUND', outcome: 'REPLIED' };
    default:
      return null;
  }
};

const companyByName = new Map(
  crmCompanies.map((company) => [normalize(company.Name), company]),
);

const crmPersonIndex = {
  linkedin: new Map<string, Record<string, string>>(),
  email: new Map<string, Record<string, string>>(),
  name: new Map<string, Record<string, string>>(),
};

for (const person of crmPeople) {
  const linkedin = normalizeLinkedin(person['Linkedin / Link URL']);

  if (linkedin.length > 0) {
    crmPersonIndex.linkedin.set(linkedin, person);
  }

  const emails = [
    person['Emails / Primary Email'],
    ...(JSON.parse(person['Emails / Additional Emails'] || '[]') as string[]),
  ];

  for (const email of emails.map(normalize).filter(Boolean)) {
    crmPersonIndex.email.set(email, person);
  }

  crmPersonIndex.name.set(
    normalize(`${person['Name / First Name']} ${person['Name / Last Name']}`),
    person,
  );
}

const companies = new Map<string, PlannedCompany>();

for (const row of partners) {
  const key = normalize(row.account);
  const existing = companyByName.get(key);
  const planned = companies.get(key) ?? {
    key,
    name: row.account,
    existingId: existing?.Id ?? null,
    group: AIRPORT_ACCOUNTS.has(row.account) ? 'AIRPORT' : 'PARTNER',
    category: null,
    domain: null,
  };
  const category = CATEGORIES[row.type];

  if (category !== undefined) {
    planned.category = category;
  }

  companies.set(key, planned);
}

const PERSONAL_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'hotmail.com',
  'outlook.com',
  'yahoo.com',
  'icloud.com',
  'live.com',
]);

const emailDomainsByAccount = new Map<string, Set<string>>();

for (const row of partners) {
  const domain = normalize(row.email.split('@')[1]);

  if (domain && !PERSONAL_EMAIL_DOMAINS.has(domain)) {
    const key = normalize(row.account);

    emailDomainsByAccount.set(key, (emailDomainsByAccount.get(key) ?? new Set()).add(domain));
  }
}

const accountsByDomain = new Map<string, string[]>();

for (const [key, domains] of emailDomainsByAccount) {
  for (const domain of domains) {
    accountsByDomain.set(domain, [...(accountsByDomain.get(domain) ?? []), key]);
  }
}

// Only a domain that belongs to exactly one account, and is that account's only one
for (const company of companies.values()) {
  const domains = [...(emailDomainsByAccount.get(company.key) ?? [])];

  if (
    company.existingId === null &&
    domains.length === 1 &&
    accountsByDomain.get(domains[0])?.length === 1
  ) {
    company.domain = domains[0];
  }
}

const eventsByContact = new Map<string, Record<string, string>[]>();

for (const event of events) {
  eventsByContact.set(event.contact_id, [
    ...(eventsByContact.get(event.contact_id) ?? []),
    event,
  ]);
}

const reconciliationByContact = new Map(
  reconciliation.map((row) => [row.contact_id, row]),
);

const buildEventTouches = (
  row: Record<string, string>,
  flags: string[],
  skipped: string[],
): PlannedTouch[] => {
  const contactEvents = eventsByContact.get(row.id) ?? [];
  const drafts: (PlannedTouch & { isUndated: boolean })[] = [];

  for (const event of contactEvents) {
    const template = eventTouch(event);

    if (template === null) {
      skipped.push(
        `${event.event_type} on ${event.event_date || 'unknown date'}: not a touch; a booked call is logged by Calendar sync when it starts.`,
      );
      continue;
    }

    const decision = event.event_date
      ? undefined
      : EVENT_DATE_DECISIONS[`${row.name}|${event.event_type}`];
    const timeZone =
      event.time_zone ||
      (event.date_precision.startsWith('exact') ? 'Europe/London' : '');
    const occurredAt =
      event.event_date && event.event_time && timeZone
        ? toInstant(event.event_date, event.event_time, timeZone)
        : null;
    // The cadence counts days in UK time, so a Bangkok evening can be the UK day before
    const occurredOn = occurredAt
      ? londonDate(occurredAt)
      : decision?.date || event.event_date;

    drafts.push({
      ...template,
      occurredOn,
      occurredAt,
      origin: 'sheet-event',
      reason:
        decision?.reason ??
        (event.event_date ? `From the Sheet: ${event.date_detail}` : ''),
      isUndated: occurredOn === '',
    });
  }

  // An undated event happened on or before the next one, as finally dated
  drafts.forEach((draft, index) => {
    if (!draft.isUndated) {
      return;
    }

    const nextDated = drafts
      .slice(index + 1)
      .find((later) => !later.isUndated)?.occurredOn;
    const date = nextDated || row.last_touch;

    draft.occurredOn = date;
    draft.reason = date
      ? `Date not recorded; dated on ${date}, ${nextDated ? 'the next recorded event' : 'the last touch'}, as it happened on or before then.`
      : '';
  });

  const touches: PlannedTouch[] = drafts
    .filter((draft) => {
      if (draft.occurredOn) {
        return true;
      }

      flags.push(`No date can be found for a ${draft.channel} touch; left out.`);
      return false;
    })
    .map(({ isUndated: _isUndated, ...touch }) => touch);

  // An acceptance proves a request went out, even when the request was not logged.
  const acceptance = touches.find(
    (touch) => touch.channel === 'LINKEDIN_CONNECTION' && touch.direction === 'INBOUND',
  );
  const hasRequest = touches.some(
    (touch) => touch.channel === 'LINKEDIN_CONNECTION' && touch.direction === 'OUTBOUND',
  );

  const hasOutboundMessage = touches.some(
    (touch) => touch.channel === 'LINKEDIN_MESSAGE' && touch.direction === 'OUTBOUND',
  );

  if (hasOutboundMessage && acceptance === undefined && !hasRequest) {
    flags.push(
      'A LinkedIn message is recorded but no connection: either you were already connected or it was an InMail. Nothing rebuilt.',
    );
  }

  if (acceptance !== undefined && !hasRequest) {
    touches.unshift({
      channel: 'LINKEDIN_CONNECTION',
      direction: 'OUTBOUND',
      outcome: 'SENT',
      occurredOn: acceptance.occurredOn,
      occurredAt: null,
      origin: 'rebuilt',
      reason: 'An accepted connection means a request was sent; dated on the acceptance day.',
    });
  }

  return touches;
};

// Lost history (before 8 Oct): rebuild only what the Sheet's next action proves.
const buildRebuiltTouches = (
  row: Record<string, string>,
  flags: string[],
): PlannedTouch[] => {
  const nextAction = row.next_action.trim();
  const touchCount = Number(row.touch_count || '0');
  const date = row.last_touch || null;
  const rebuilt = (
    channel: string,
    direction: string,
    outcome: string,
    reason: string,
  ): PlannedTouch => ({
    channel,
    direction,
    outcome,
    occurredOn: date ?? '',
    occurredAt: null,
    origin: 'rebuilt',
    reason,
  });
  const requestSent = rebuilt(
    'LINKEDIN_CONNECTION',
    'OUTBOUND',
    'SENT',
    `Next action "${nextAction}" means the connection request was sent; dated on the last touch.`,
  );
  const accepted = rebuilt(
    'LINKEDIN_CONNECTION',
    'INBOUND',
    'ACCEPTED',
    `Next action "${nextAction}" means they accepted; dated on the last touch.`,
  );
  const messageOne = rebuilt(
    'LINKEDIN_MESSAGE',
    'OUTBOUND',
    'SENT',
    `Next action "${nextAction}" means message 1 was sent; dated on the last touch.`,
  );

  const notYetContacted =
    /^(send linkedin connection request|linkedin connect)/i.test(nextAction);

  if (notYetContacted) {
    if (touchCount > 0 || date !== null) {
      flags.push(
        `The Sheet records ${touchCount} touch(es)${date ? `, last on ${date}` : ''}, but the next action is still a connection request. Nothing rebuilt.`,
      );
    }

    return [];
  }

  const proved: PlannedTouch[] = /^check acceptance/i.test(nextAction)
    ? [requestSent]
    : /linkedin message 1/i.test(nextAction)
      ? [requestSent, accepted]
      : /linkedin message 2/i.test(nextAction)
        ? [requestSent, accepted, messageOne]
        : [];

  if (proved.length > 0 && date === null) {
    flags.push(
      `Next action "${nextAction}" implies earlier touches, but the Sheet has no last-touch date to put them on. Nothing rebuilt.`,
    );
    return [];
  }

  if (/email 1/i.test(nextAction)) {
    flags.push(
      `Next action "${nextAction}" means the LinkedIn steps were skipped or finished, but the Sheet does not say how. Nothing rebuilt.`,
    );
    return [];
  }

  if (proved.length === 0 && (touchCount > 0 || date !== null)) {
    flags.push(
      `The Sheet records ${touchCount} touch(es)${date ? `, last on ${date}` : ''}, but the next action ("${nextAction || 'none'}") does not say which. Nothing rebuilt; the cadence restarts unless you tell me otherwise.`,
    );
  }

  return proved;
};

const formatDate = (date: string) =>
  date
    ? new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : '';

const buildNote = (row: Record<string, string>) => {
  const reconciliationRow = reconciliationByContact.get(row.id);
  const lines = [
    '**From the AirPal CRM Sheet, Partners tab (exported 18 Oct 2026)**',
    '',
    row.next_action ? `- Next action: ${row.next_action}` : null,
    row.next_action_date ? `- Next action date: ${formatDate(row.next_action_date)}` : null,
    `- Touches recorded in the Sheet: ${row.touch_count || '0'}${row.last_touch ? ` (last ${formatDate(row.last_touch)})` : ''}`,
    reconciliationRow && reconciliationRow.discrepancy !== 'none'
      ? `- Reconciliation: ${reconciliationRow.discrepancy}`
      : null,
    row.notes ? '' : null,
    row.notes ? `Notes: ${row.notes}` : null,
  ];

  return lines.filter((line): line is string => line !== null).join('\n');
};

const people: PlannedPerson[] = partners.map((row) => {
  const flags: string[] = [];
  const skippedEvents: string[] = [];
  const crmMatch =
    (row.linkedin_url && crmPersonIndex.linkedin.get(normalizeLinkedin(row.linkedin_url))) ||
    (row.email && crmPersonIndex.email.get(normalize(row.email))) ||
    crmPersonIndex.name.get(normalize(row.name)) ||
    null;
  const matchedBy = crmMatch === null
    ? null
    : row.linkedin_url && crmPersonIndex.linkedin.get(normalizeLinkedin(row.linkedin_url)) === crmMatch
      ? 'linkedin'
      : row.email && crmPersonIndex.email.get(normalize(row.email)) === crmMatch
        ? 'email'
        : 'name';

  const eventTouches = buildEventTouches(row, flags, skippedEvents);
  const touches = eventTouches.length > 0
    ? eventTouches
    : buildRebuiltTouches(row, flags);

  const stage = MEETING_SCHEDULED_NAMES.has(row.name)
    ? 'MEETING_SCHEDULED'
    : STAGES[row.stage];
  const health = HEALTHS[row.health];

  if (stage === undefined) {
    flags.push(`Stage "${row.stage}" has no CRM equivalent.`);
  }

  if (health === undefined) {
    flags.push(`Health "${row.health}" has no CRM equivalent.`);
  }

  const ownerEmail = row.owner_name ? OWNER_EMAILS[row.owner_name] ?? null : null;

  if (row.owner_name && ownerEmail === null) {
    flags.push(`Owner "${row.owner_name}" is not a known team member.`);
  }

  const optOutReason = OPT_OUTS[row.stage] ?? null;
  const { firstName, lastName } = splitName(row.name);

  const personRecord: PersonRecord = {
    id: row.id,
    cadenceOwnerId: ownerEmail,
    cadenceStage: stage ?? 'NOT_CONTACTED',
    cadenceHealth: health ?? 'ACTIVE',
    emails: { primaryEmail: row.email || null },
    linkedinLink: { primaryLinkUrl: row.linkedin_url || null },
    optedOut: optOutReason !== null,
    optOutReason,
    nextActionDateOverride: row.next_action_date || null,
  };
  const touchRecords: TouchRecord[] = touches.map((touch, index) => ({
    id: `${row.id}-${index}`,
    personId: row.id,
    channel: touch.channel,
    direction: touch.direction,
    outcome: touch.outcome,
    occurredOn: touch.occurredOn,
    occurredAt: touch.occurredAt,
    source: 'MANUAL',
    createdAt: `${today}T23:59:00.000Z`,
  }));
  const { result } = computePersonCadence({
    person: personRecord,
    touches: touchRecords,
    config: DEFAULT_CADENCE_CONFIG,
    today,
    suppressed: false,
  });

  return {
    sheetId: row.id,
    name: row.name,
    firstName,
    lastName,
    companyKey: normalize(row.account),
    existingPersonId: crmMatch?.Id ?? null,
    existingPersonName: crmMatch
      ? `${crmMatch['Name / First Name']} ${crmMatch['Name / Last Name']}`
      : null,
    matchedBy,
    jobTitle: row.title,
    email: row.email || null,
    linkedinUrl: row.linkedin_url || null,
    ownerName: row.owner_name || null,
    ownerEmail,
    stage: stage ?? 'NOT_CONTACTED',
    health: health ?? 'ACTIVE',
    optOutReason,
    nextActionDate: row.next_action_date || null,
    connectionNote: row.connection_note || null,
    note: { title: 'From the AirPal CRM Sheet (18 Oct)', markdown: buildNote(row) },
    sheet: {
      stage: row.stage,
      nextAction: row.next_action,
      nextActionDate: row.next_action_date,
      lastTouch: row.last_touch,
      touchCount: Number(row.touch_count || '0'),
    },
    touches,
    skippedEvents,
    engine: {
      stepLabel: result.stepLabel,
      positionLabel: result.positionLabel,
      state: result.status.state,
      nextActionDate: result.nextActionDate,
      isDue: result.isDue,
    },
    flags,
  };
});

const plan: ImportPlan = {
  generatedAt: new Date().toISOString(),
  today,
  sources: {
    partners: { file: path.basename(partnersPath), sha256: sha256(partnersPath) },
    pack: { file: path.basename(packPath), sha256: sha256(packPath) },
    people: { file: path.basename(peoplePath), sha256: sha256(peoplePath) },
    companies: { file: path.basename(companiesPath), sha256: sha256(companiesPath) },
  },
  companies: [...companies.values()],
  people,
};

mkdirSync(outDirectory, { recursive: true });
writeFileSync(path.join(outDirectory, 'plan.json'), JSON.stringify(plan, null, 2));
writeFileSync(path.join(outDirectory, 'review.html'), renderReview(plan));

const touchCount = people.reduce((sum, person) => sum + person.touches.length, 0);
const rebuiltCount = people.reduce(
  (sum, person) => sum + person.touches.filter((touch) => touch.origin === 'rebuilt').length,
  0,
);

console.log(
  `Companies: ${plan.companies.length} (${plan.companies.filter((company) => company.existingId).length} already in the CRM)`,
);
console.log(
  `People: ${people.length} (${people.filter((person) => person.existingPersonId).length} already in the CRM)`,
);
console.log(`Touches: ${touchCount} (${rebuiltCount} rebuilt)`);
console.log(`Contacts flagged: ${people.filter((person) => person.flags.length > 0).length}`);
console.log(`Written: ${path.join(outDirectory, 'plan.json')} and review.html`);
