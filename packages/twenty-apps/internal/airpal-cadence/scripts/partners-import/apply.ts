// Applies plan.json to a CRM. Matches live records again (LinkedIn, then email,
// then name) so a rerun or a different workspace never duplicates anyone.
// Read-only unless `apply` gets the fingerprint `dry-run` printed.
//
//   TWENTY_API_TOKEN=... npx tsx scripts/partners-import/apply.ts dry-run --url <server> --plan <plan.json>
//   TWENTY_API_TOKEN=... npx tsx scripts/partners-import/apply.ts apply --url <server> --plan <plan.json> --confirm <fingerprint>
//   TWENTY_API_TOKEN=... npx tsx scripts/partners-import/apply.ts recompute --url <server> --plan <plan.json>
//
// --owner-map a@x=b@y,... maps plan owner emails to the target's members (staging).
// Production (crm.airpal.co.uk) also needs --production.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  type ImportPlan,
  type PlannedCompany,
  type PlannedPerson,
  type PlannedTouch,
} from './types';

const args = process.argv.slice(2);
const mode = args[0];
const option = (flag: string) =>
  args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined;
const fail = (message: string): never => {
  throw new Error(message);
};

const serverUrl = (option('--url') ?? fail('Pass --url.')).replace(/\/+$/, '');
const token = process.env.TWENTY_API_TOKEN ?? fail('Set TWENTY_API_TOKEN.');
const planPath = option('--plan') ?? fail('Pass --plan.');
const plan = JSON.parse(readFileSync(planPath, 'utf8')) as ImportPlan;
const ownerMap = Object.fromEntries(
  (option('--owner-map') ?? '')
    .split(',')
    .filter(Boolean)
    .map((pair) => pair.split('=').map((value) => value.trim().toLowerCase())),
) as Record<string, string>;

if (/crm\.airpal\.co\.uk/.test(serverUrl) && !args.includes('--production')) {
  fail('Refusing to touch production without --production.');
}

const PAGE_SIZE = 60;
const BATCH_SIZE = 20;
// API keys are limited to about 100 requests a minute
const REQUEST_SPACING_IN_MS = 700;

const sleep = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

let lastRequestAt = 0;

const graphql = async <TData>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<TData> => {
  for (let attempt = 0; attempt < 6; attempt++) {
    const wait = lastRequestAt + REQUEST_SPACING_IN_MS - Date.now();

    if (wait > 0) {
      await sleep(wait);
    }

    lastRequestAt = Date.now();

    const response = await fetch(`${serverUrl}/graphql`, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(60_000),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (response.status === 429) {
      await sleep(5_000 * (attempt + 1));
      continue;
    }

    if (!response.ok) {
      fail(`GraphQL returned HTTP ${response.status}.`);
    }

    const body = (await response.json()) as {
      data: TData;
      errors?: { message: string }[];
    };

    if (body.errors) {
      fail(body.errors.map((error) => error.message).join('; '));
    }

    return body.data;
  }

  return fail('Rate limited too many times.');
};

// Bulk-created touches race the person-created recompute, which can land last
// with "Not started", so every imported person is recomputed once at the end.
const recomputePerson = async (personId: string) => {
  for (let attempt = 0; attempt < 6; attempt++) {
    const wait = lastRequestAt + REQUEST_SPACING_IN_MS - Date.now();

    if (wait > 0) {
      await sleep(wait);
    }

    lastRequestAt = Date.now();

    const response = await fetch(`${serverUrl}/s/cadence/recompute`, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(60_000),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ personId }),
    });

    if (response.status === 429) {
      await sleep(5_000 * (attempt + 1));
      continue;
    }

    const body = (await response.json()) as { ok?: boolean; recompute?: { status: string } };

    if (!response.ok || body.ok !== true) {
      fail(`Recompute of ${personId} failed with HTTP ${response.status}.`);
    }

    return body.recompute?.status ?? 'unknown';
  }

  return fail('Rate limited too many times.');
};

type Connection<TNode> = {
  edges: { node: TNode }[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
};

const readAll = async <TNode>(
  pluralName: string,
  filterType: string,
  selection: string,
  filter: Record<string, unknown> = {},
): Promise<TNode[]> => {
  const nodes: TNode[] = [];
  let after: string | null = null;

  for (;;) {
    const data: Record<string, Connection<TNode>> = await graphql(
      `query($after: String, $filter: ${filterType}) {
        ${pluralName}(first: ${PAGE_SIZE}, after: $after, filter: $filter) {
          edges { node { ${selection} } }
          pageInfo { hasNextPage endCursor }
        }
      }`,
      { after, filter },
    );
    const page = data[pluralName];

    nodes.push(...page.edges.map(({ node }) => node));

    if (!page.pageInfo.hasNextPage) {
      return nodes;
    }

    after = page.pageInfo.endCursor;
  }
};

const normalize = (value: string | null | undefined) =>
  (value ?? '').trim().toLowerCase();
const normalizeLinkedin = (value: string | null | undefined) =>
  normalize(value)
    .replace(/^https?:\/\/(www\.)?/, '')
    .replace(/\/+$/, '');

type LivePerson = {
  id: string;
  name: { firstName: string; lastName: string };
  emails: { primaryEmail: string | null; additionalEmails: string[] | null };
  linkedinLink: { primaryLinkUrl: string | null };
};

type LiveState = {
  companyIdByName: Map<string, string>;
  companyNameById: Map<string, string>;
  companyIdByDomain: Map<string, string>;
  findPerson: (person: PlannedPerson) => LivePerson | undefined;
  memberIdByEmail: Map<string, string>;
};

const readLiveState = async (): Promise<LiveState> => {
  const [companies, people, members] = await Promise.all([
    readAll<{ id: string; name: string; domainName: { primaryLinkUrl: string | null } | null }>(
      'companies',
      'CompanyFilterInput',
      'id name domainName { primaryLinkUrl }',
    ),
    readAll<LivePerson>(
      'people',
      'PersonFilterInput',
      'id name { firstName lastName } emails { primaryEmail additionalEmails } linkedinLink { primaryLinkUrl }',
    ),
    readAll<{ id: string; userEmail: string }>(
      'workspaceMembers',
      'WorkspaceMemberFilterInput',
      'id userEmail',
    ),
  ]);

  const byLinkedin = new Map<string, LivePerson>();
  const byEmail = new Map<string, LivePerson>();
  const byName = new Map<string, LivePerson>();
  const byId = new Map(people.map((person) => [person.id, person]));

  for (const person of people) {
    const linkedin = normalizeLinkedin(person.linkedinLink?.primaryLinkUrl);

    if (linkedin) {
      byLinkedin.set(linkedin, person);
    }

    for (const email of [
      person.emails?.primaryEmail,
      ...(person.emails?.additionalEmails ?? []),
    ]) {
      if (normalize(email)) {
        byEmail.set(normalize(email), person);
      }
    }

    byName.set(normalize(`${person.name.firstName} ${person.name.lastName}`), person);
  }

  return {
    companyIdByName: new Map(companies.map((company) => [normalize(company.name), company.id])),
    companyNameById: new Map(companies.map((company) => [company.id, company.name])),
    companyIdByDomain: new Map(
      companies
        .filter((company) => company.domainName?.primaryLinkUrl)
        .map((company) => [
          normalize(company.domainName?.primaryLinkUrl)
            .replace(/^https?:\/\/(www\.)?/, '')
            .replace(/\/.*$/, ''),
          company.id,
        ]),
    ),
    findPerson: (person) =>
      (person.linkedinUrl ? byLinkedin.get(normalizeLinkedin(person.linkedinUrl)) : undefined) ??
      (person.email ? byEmail.get(normalize(person.email)) : undefined) ??
      byName.get(normalize(person.name)) ??
      (person.existingPersonId ? byId.get(person.existingPersonId) : undefined),
    memberIdByEmail: new Map(members.map((member) => [normalize(member.userEmail), member.id])),
  };
};

const resolveOwnerId = (person: PlannedPerson, live: LiveState) => {
  if (person.ownerEmail === null) {
    return null;
  }

  const targetEmail = ownerMap[normalize(person.ownerEmail)] ?? normalize(person.ownerEmail);

  return live.memberIdByEmail.get(targetEmail) ?? fail(
    `No member ${targetEmail} for owner ${person.ownerName}; pass --owner-map.`,
  );
};

// By the Sheet's name first; otherwise the company the plan chose to reuse,
// which is renamed. A plan made from another workspace's export falls back to name.
const resolveCompany = (company: PlannedCompany, live: LiveState) => {
  const byName = live.companyIdByName.get(company.key);

  if (byName) {
    return { id: byName, rename: false };
  }

  if (company.existingId && live.companyNameById.has(company.existingId)) {
    return { id: company.existingId, rename: true };
  }

  return null;
};

const buildDryRun = (live: LiveState) => {
  const companiesToCreate = plan.companies.filter(
    (company) => resolveCompany(company, live) === null,
  );
  const companiesToRename = plan.companies.filter(
    (company) => resolveCompany(company, live)?.rename === true,
  );
  const peopleToUpdate = plan.people.filter((person) => live.findPerson(person));

  for (const person of plan.people) {
    resolveOwnerId(person, live);
  }

  return {
    server: new URL(serverUrl).host,
    planSha256: createHash('sha256').update(readFileSync(planPath)).digest('hex'),
    ownerMap,
    companiesToCreate: companiesToCreate.map((company) => company.name).sort(),
    companiesToUpdate: plan.companies.length - companiesToCreate.length,
    companiesToRename: companiesToRename
      .map((company) => `${live.companyNameById.get(company.existingId as string)} -> ${company.name}`)
      .sort(),
    peopleToCreate: plan.people.length - peopleToUpdate.length,
    peopleToUpdate: peopleToUpdate.map((person) => person.name).sort(),
    touches: plan.people.reduce((sum, person) => sum + person.touches.length, 0),
    notes: plan.people.length,
    companiesToBinIfEmpty: (plan.crmCompaniesLeftEmpty ?? []).map((company) => company.name).sort(),
  };
};

const fingerprint = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);

const personData = (person: PlannedPerson, companyId: string | null, ownerId: string | null) => ({
  name: { firstName: person.firstName, lastName: person.lastName },
  jobTitle: person.jobTitle,
  emails: { primaryEmail: person.email ?? '' },
  linkedinLink: { primaryLinkUrl: person.linkedinUrl ?? '' },
  companyId,
  cadenceOwnerId: ownerId,
  cadenceStage: person.stage,
  cadenceHealth: person.health,
  optedOut: person.optOutReason !== null,
  optOutReason: person.optOutReason,
  linkedinConnectionNote: person.connectionNote,
});

const touchData = (person: PlannedPerson, personId: string, touch: PlannedTouch) => ({
  personId,
  name: `${person.name} (from the AirPal CRM Sheet)`,
  channel: touch.channel,
  direction: touch.direction,
  outcome: touch.outcome,
  occurredOn: touch.occurredOn,
  occurredAt: touch.occurredAt,
  source: 'MANUAL',
  note: `${touch.origin === 'rebuilt' ? 'Rebuilt from the Sheet' : 'Imported from the Sheet'}: ${touch.reason}`,
});

const apply = async () => {
  const live = await readLiveState();
  const dryRun = buildDryRun(live);

  if (fingerprint(dryRun) !== option('--confirm')) {
    console.log(JSON.stringify(dryRun, null, 2));
    fail(`Fingerprint ${fingerprint(dryRun)} differs from --confirm; review the dry run again.`);
  }

  const receiptDirectory = path.join(path.dirname(planPath), 'receipts');
  mkdirSync(receiptDirectory, { recursive: true });
  const receiptPath = path.join(
    receiptDirectory,
    `${dryRun.server}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  );
  const receipt = {
    dryRun,
    createdCompanyIds: [] as string[],
    updatedCompanyIds: [] as string[],
    createdPersonIds: [] as string[],
    updatedPersonIds: [] as string[],
    createdTouchIds: [] as string[],
    createdNoteIds: [] as string[],
    skippedDuplicateTouches: 0,
    deletedWorkflowCompanies: [] as string[],
    deletedEmptyCompanies: [] as string[],
    domainsAlreadyTaken: [] as string[],
  };
  const startedAt = new Date().toISOString();
  const save = () => writeFileSync(receiptPath, JSON.stringify(receipt, null, 2));

  save();

  const companyIdByKey = new Map<string, string>();

  for (const company of plan.companies) {
    const resolved = resolveCompany(company, live);
    const existingId = resolved?.id;
    // Websites are unique per workspace; the final companyId update covers a skipped one
    const domainHolderId = company.domain
      ? live.companyIdByDomain.get(company.domain)
      : undefined;
    const canSetDomain =
      company.domain !== null &&
      (domainHolderId === undefined || domainHolderId === existingId);

    if (company.domain !== null && !canSetDomain) {
      receipt.domainsAlreadyTaken.push(`${company.name}: ${company.domain}`);
    }

    const groupAndCategory = {
      group: company.group,
      ...(company.category ? { category: company.category } : {}),
      ...(canSetDomain
        ? { domainName: { primaryLinkUrl: `https://${company.domain}` } }
        : {}),
    };

    if (existingId) {
      await graphql(
        `mutation($id: UUID!, $data: CompanyUpdateInput!) { updateCompany(id: $id, data: $data) { id } }`,
        { id: existingId, data: { ...groupAndCategory, ...(resolved?.rename ? { name: company.name } : {}) } },
      );
      companyIdByKey.set(company.key, existingId);
      receipt.updatedCompanyIds.push(existingId);
    } else {
      const { createCompany } = await graphql<{ createCompany: { id: string } }>(
        `mutation($data: CompanyCreateInput!) { createCompany(data: $data) { id } }`,
        { data: { name: company.name, ...groupAndCategory } },
      );
      companyIdByKey.set(company.key, createCompany.id);
      receipt.createdCompanyIds.push(createCompany.id);
    }

    save();
  }

  const personIdBySheetId = new Map<string, string>();

  for (const person of plan.people) {
    const companyId =
      person.companyKey === null
        ? null
        : companyIdByKey.get(person.companyKey) ?? fail(`No company for ${person.name}`);
    const data = personData(person, companyId, resolveOwnerId(person, live));
    const existing = live.findPerson(person);

    if (existing) {
      await graphql(
        `mutation($id: UUID!, $data: PersonUpdateInput!) { updatePerson(id: $id, data: $data) { id } }`,
        {
          id: existing.id,
          data: {
            ...data,
            emails: {
              primaryEmail: person.email ?? existing.emails.primaryEmail ?? '',
              additionalEmails: existing.emails.additionalEmails ?? [],
            },
          },
        },
      );
      personIdBySheetId.set(person.sheetId, existing.id);
      receipt.updatedPersonIds.push(existing.id);
    } else {
      const { createPerson } = await graphql<{ createPerson: { id: string } }>(
        `mutation($data: PersonCreateInput!) { createPerson(data: $data) { id } }`,
        { data },
      );
      personIdBySheetId.set(person.sheetId, createPerson.id);
      receipt.createdPersonIds.push(createPerson.id);
    }

    save();
  }

  const peopleWithTouches = plan.people.filter((person) => person.touches.length > 0);
  const existingTouches = await readAll<{
    personId: string;
    channel: string;
    direction: string;
    occurredOn: string;
  }>('touches', 'TouchFilterInput', 'personId channel direction occurredOn', {
    personId: { in: peopleWithTouches.map((person) => personIdBySheetId.get(person.sheetId)) },
  });
  const existingTouchKeys = new Set(
    existingTouches.map(
      (touch) => `${touch.personId}|${touch.channel}|${touch.direction}|${touch.occurredOn}`,
    ),
  );
  const touchesToCreate = peopleWithTouches.flatMap((person) => {
    const personId = personIdBySheetId.get(person.sheetId) as string;

    return person.touches
      .filter((touch) => {
        const isDuplicate = existingTouchKeys.has(
          `${personId}|${touch.channel}|${touch.direction}|${touch.occurredOn}`,
        );

        if (isDuplicate) {
          receipt.skippedDuplicateTouches++;
        }

        return !isDuplicate;
      })
      .map((touch) => touchData(person, personId, touch));
  });

  for (let index = 0; index < touchesToCreate.length; index += BATCH_SIZE) {
    const { createTouches } = await graphql<{ createTouches: { id: string }[] }>(
      `mutation($data: [TouchCreateInput!]!) { createTouches(data: $data) { id } }`,
      { data: touchesToCreate.slice(index, index + BATCH_SIZE) },
    );
    receipt.createdTouchIds.push(...createTouches.map(({ id }) => id));
    save();
  }

  const existingNoteTargets = await readAll<{
    targetPersonId: string;
    note: { title: string } | null;
  }>('noteTargets', 'NoteTargetFilterInput', 'targetPersonId note { title }', {
    targetPersonId: { in: [...personIdBySheetId.values()] },
  });
  const peopleWithSheetNote = new Set(
    existingNoteTargets
      .filter((noteTarget) => plan.people.some((person) => person.note.title === noteTarget.note?.title))
      .map((noteTarget) => noteTarget.targetPersonId),
  );

  for (const person of plan.people) {
    if (peopleWithSheetNote.has(personIdBySheetId.get(person.sheetId) as string)) {
      continue;
    }

    const { createNote } = await graphql<{ createNote: { id: string } }>(
      `mutation($data: NoteCreateInput!) { createNote(data: $data) { id } }`,
      { data: { title: person.note.title, bodyV2: { markdown: person.note.markdown } } },
    );
    await graphql(
      `mutation($data: NoteTargetCreateInput!) { createNoteTarget(data: $data) { id } }`,
      { data: { noteId: createNote.id, targetPersonId: personIdBySheetId.get(person.sheetId) } },
    );
    receipt.createdNoteIds.push(createNote.id);
    save();
  }

  // The cadence may move a stage forward after each touch, and Twenty's "Create
  // company when adding new person" workflow may relink the company, so the
  // Sheet's values are set again once both have settled.
  console.log('Waiting 90 s for the cadence and workflows to settle...');
  await sleep(90_000);

  for (const person of plan.people) {
    await graphql(
      `mutation($id: UUID!, $data: PersonUpdateInput!) { updatePerson(id: $id, data: $data) { id } }`,
      {
        id: personIdBySheetId.get(person.sheetId),
        data: {
          companyId: person.companyKey === null ? null : companyIdByKey.get(person.companyKey),
          cadenceStage: person.stage,
          cadenceHealth: person.health,
          ...(person.nextActionDate ? { nextActionDate: person.nextActionDate } : {}),
        },
      },
    );
  }

  for (const person of plan.people) {
    await recomputePerson(personIdBySheetId.get(person.sheetId) as string);
  }

  // Only companies that workflow made during this import and that are now empty
  const workflowCompanies = await readAll<{
    id: string;
    name: string;
    people: { edges: unknown[] };
  }>('companies', 'CompanyFilterInput', 'id name people(first: 1) { edges { node { id } } }', {
    createdBy: { source: { eq: 'WORKFLOW' } },
    createdAt: { gte: option('--cleanup-since') ?? startedAt },
  });

  for (const company of workflowCompanies.filter((candidate) => candidate.people.edges.length === 0)) {
    await graphql(`mutation($id: UUID!) { deleteCompany(id: $id) { id } }`, { id: company.id });
    receipt.deletedWorkflowCompanies.push(company.name);
    save();
  }

  const leftEmptyIds = (plan.crmCompaniesLeftEmpty ?? []).map((company) => company.id);
  const leftEmpty = leftEmptyIds.length === 0
    ? []
    : await readAll<{ id: string; name: string; people: { edges: unknown[] } }>(
        'companies',
        'CompanyFilterInput',
        'id name people(first: 1) { edges { node { id } } }',
        { id: { in: leftEmptyIds } },
      );

  for (const company of leftEmpty.filter((candidate) => candidate.people.edges.length === 0)) {
    await graphql(`mutation($id: UUID!) { deleteCompany(id: $id) { id } }`, { id: company.id });
    receipt.deletedEmptyCompanies.push(company.name);
    save();
  }

  console.log(`Receipt: ${receiptPath}`);
  console.log(
    `Companies ${receipt.createdCompanyIds.length} created / ${receipt.updatedCompanyIds.length} updated; ` +
      `people ${receipt.createdPersonIds.length} created / ${receipt.updatedPersonIds.length} updated; ` +
      `touches ${receipt.createdTouchIds.length} created (${receipt.skippedDuplicateTouches} duplicates skipped); ` +
      `notes ${receipt.createdNoteIds.length}; empty workflow companies removed ${receipt.deletedWorkflowCompanies.length}; emptied companies moved to the bin ${receipt.deletedEmptyCompanies.length}.`,
  );
};

const run = async () => {
  if (mode === 'dry-run') {
    const dryRun = buildDryRun(await readLiveState());

    console.log(JSON.stringify(dryRun, null, 2));
    console.log(`Fingerprint: ${fingerprint(dryRun)}`);
    return;
  }

  if (mode === 'apply') {
    await apply();
    return;
  }

  if (mode === 'recompute') {
    const live = await readLiveState();
    const statuses = new Map<string, number>();

    for (const person of plan.people) {
      const existing = live.findPerson(person) ?? fail(`${person.name} not found`);
      const status = await recomputePerson(existing.id);

      statuses.set(status, (statuses.get(status) ?? 0) + 1);
    }

    console.log(`Recomputed ${plan.people.length}: ${JSON.stringify(Object.fromEntries(statuses))}`);
    return;
  }

  fail('Mode must be dry-run, apply or recompute.');
};

run().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
