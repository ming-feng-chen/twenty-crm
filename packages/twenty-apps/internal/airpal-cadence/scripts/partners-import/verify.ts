// Read-only: compares every planned contact with what the CRM now holds,
// including the cadence step and date the engine computed there.
//
//   TWENTY_API_TOKEN=... npx tsx scripts/partners-import/verify.ts --url <server> --plan <plan.json>
import { readFileSync } from 'node:fs';

import { type ImportPlan } from './types';

const args = process.argv.slice(2);
const option = (flag: string) =>
  args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined;
const serverUrl = (option('--url') ?? '').replace(/\/+$/, '');
const token = process.env.TWENTY_API_TOKEN ?? '';
const plan = JSON.parse(readFileSync(option('--plan') ?? '', 'utf8')) as ImportPlan;

const graphql = async <TData>(query: string, variables: Record<string, unknown>) => {
  const response = await fetch(`${serverUrl}/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query, variables }),
  });
  const body = (await response.json()) as { data: TData; errors?: { message: string }[] };

  if (body.errors) {
    throw new Error(body.errors.map((error) => error.message).join('; '));
  }

  return body.data;
};

type LivePerson = {
  id: string;
  name: { firstName: string; lastName: string };
  linkedinLink: { primaryLinkUrl: string | null };
  cadenceStage: string;
  cadenceHealth: string;
  cadenceStep: string | null;
  nextActionDate: string | null;
  optOutReason: string | null;
  linkedinConnectionNote: string | null;
  company: { name: string; group: string | null; category: string | null } | null;
  touches: { edges: unknown[] };
  noteTargets: { edges: unknown[] };
};

const run = async () => {
  const problems: string[] = [];
  const linkedinUrls = plan.people
    .map((person) => person.linkedinUrl)
    .filter((link): link is string => Boolean(link))
    .flatMap((link) => [link, link.replace(/\/+$/, '')]);
  const { people } = await graphql<{ people: { edges: { node: LivePerson }[] } }>(
    `query($filter: PersonFilterInput) {
      people(first: 200, filter: $filter) {
        edges { node {
          id name { firstName lastName } linkedinLink { primaryLinkUrl }
          cadenceStage cadenceHealth cadenceStep nextActionDate optOutReason linkedinConnectionNote
          company { name group category }
          touches(first: 50) { edges { node { id } } }
          noteTargets(first: 50) { edges { node { id } } }
        } }
      }
    }`,
    {
      filter: {
        or: [
          { linkedinLink: { primaryLinkUrl: { in: linkedinUrls } } },
          ...plan.people
            .filter((person) => !person.linkedinUrl)
            .map((person) => ({
              name: { firstName: { eq: person.firstName }, lastName: { eq: person.lastName } },
            })),
        ],
      },
    },
  );
  const live = people.edges.map(({ node }) => node);
  const companyByKey = new Map(plan.companies.map((company) => [company.key, company]));
  let stepMatches = 0;
  let dateMatches = 0;

  for (const person of plan.people) {
    // Twenty stores links without a trailing slash
    const trimLink = (link: string | null | undefined) =>
      (link ?? '').trim().toLowerCase().replace(/\/+$/, '');
    const match = live.find((candidate) =>
      person.linkedinUrl
        ? trimLink(candidate.linkedinLink?.primaryLinkUrl) === trimLink(person.linkedinUrl)
        : `${candidate.name.firstName} ${candidate.name.lastName}` === person.name,
    );

    if (match === undefined) {
      problems.push(`${person.name}: not found`);
      continue;
    }

    const company = companyByKey.get(person.companyKey);
    const checks: [string, unknown, unknown][] = [
      ['stage', match.cadenceStage, person.stage],
      ['health', match.cadenceHealth, person.health],
      ['opt-out reason', match.optOutReason, person.optOutReason],
      ['connection note', match.linkedinConnectionNote || null, person.connectionNote],
      ['company', match.company?.name, company?.name],
      ['group', match.company?.group, company?.group],
      ['category', match.company?.category ?? null, company?.category ?? null],
      ['touch count', match.touches.edges.length >= person.touches.length, true],
      ['note', match.noteTargets.edges.length >= 1, true],
    ];

    for (const [label, actual, expected] of checks) {
      if (actual !== expected) {
        problems.push(`${person.name}: ${label} is ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
      }
    }

    if (match.cadenceStep === person.engine.stepLabel) {
      stepMatches++;
    } else {
      problems.push(`${person.name}: step "${match.cadenceStep}", review said "${person.engine.stepLabel}"`);
    }

    if ((match.nextActionDate ?? null) === person.engine.nextActionDate) {
      dateMatches++;
    } else {
      problems.push(`${person.name}: next action date ${match.nextActionDate}, review said ${person.engine.nextActionDate}`);
    }
  }

  console.log(`Contacts found: ${live.length}/${plan.people.length}`);
  console.log(`Steps matching the review: ${stepMatches}/${plan.people.length}`);
  console.log(`Dates matching the review: ${dateMatches}/${plan.people.length}`);
  console.log(problems.length === 0 ? 'No differences.' : problems.join('\n'));
};

run().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
