import { type ImportPlan, type PlannedPerson, type PlannedTouch } from './types';

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const TOUCH_LABELS: Record<string, string> = {
  'LINKEDIN_CONNECTION|OUTBOUND': 'Connection request sent',
  'LINKEDIN_CONNECTION|INBOUND': 'Connection accepted',
  'LINKEDIN_MESSAGE|OUTBOUND': 'LinkedIn message sent',
  'LINKEDIN_MESSAGE|INBOUND': 'Reply received',
};

const describeTouch = (touch: PlannedTouch) =>
  `${TOUCH_LABELS[`${touch.channel}|${touch.direction}`] ?? `${touch.channel} ${touch.direction}`} (${touch.occurredOn})`;

// Whether the step the CRM will show agrees with the Sheet's next action, for
// the next actions that name a step.
export const compareWithSheet = (person: PlannedPerson): 'agrees' | 'differs' | 'unchecked' => {
  const nextAction = person.sheet.nextAction.toLowerCase();
  const crmStep = `${person.engine.stepLabel} ${person.engine.positionLabel}`.toLowerCase();
  const expectations: [RegExp, (step: string) => boolean][] = [
    [/^(send linkedin connection request|linkedin connect)/, (step) => step.includes('connection request') && !step.includes('not accepted')],
    [/^check acceptance/, (step) => step.includes('not accepted')],
    [/linkedin message 1/, (step) => step.includes('linkedin message 1')],
    [/linkedin message 2/, (step) => step.includes('linkedin message 2')],
    [/email 1/, (step) => step.includes('email 1')],
  ];
  const expectation = expectations.find(([pattern]) => pattern.test(nextAction));

  if (expectation === undefined) {
    return 'unchecked';
  }

  return expectation[1](crmStep) ? 'agrees' : 'differs';
};

const crmShows = (person: PlannedPerson) =>
  `${escapeHtml(person.engine.stepLabel)}${person.engine.nextActionDate ? ` <span class="muted">· ${escapeHtml(person.engine.nextActionDate)}</span>` : ''}`;

const table = (headers: string[], rows: string[][]) =>
  rows.length === 0
    ? '<p class="muted">None.</p>'
    : `<table><thead><tr>${headers.map((header) => `<th>${header}</th>`).join('')}</tr></thead><tbody>${rows
        .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`)
        .join('')}</tbody></table>`;

export const renderReview = (plan: ImportPlan) => {
  const companyName = new Map(plan.companies.map((company) => [company.key, company.name]));
  const people = [...plan.people].sort((first, second) =>
    first.name.localeCompare(second.name),
  );
  const withRebuilt = people.filter((person) =>
    person.touches.some((touch) => touch.origin === 'rebuilt'),
  );
  const flagged = people.filter((person) => person.flags.length > 0);
  const differing = people.filter((person) => compareWithSheet(person) === 'differs');
  const matched = people.filter((person) => person.existingPersonId !== null);
  const datedByRule = people.flatMap((person) =>
    person.touches
      .filter((touch) => touch.origin === 'sheet-event' && !touch.reason.startsWith('From the Sheet'))
      .map((touch) => [escapeHtml(person.name), escapeHtml(describeTouch(touch)), escapeHtml(touch.reason)]),
  );
  const touchCount = people.reduce((sum, person) => sum + person.touches.length, 0);
  const rebuiltCount = people.reduce(
    (sum, person) => sum + person.touches.filter((touch) => touch.origin === 'rebuilt').length,
    0,
  );

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Partners import review</title>
<style>
:root{--bg:#fff;--fg:#1f2328;--muted:#656d76;--line:#d0d7de;--warn:#9a6700;--bad:#cf222e;--ok:#1a7f37;--head:#f6f8fa}
@media (prefers-color-scheme:dark){:root{--bg:#0d1117;--fg:#e6edf3;--muted:#8d96a0;--line:#30363d;--warn:#d29922;--bad:#f85149;--ok:#3fb950;--head:#161b22}}
body{background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,sans-serif;margin:0 auto;max-width:1200px;padding:24px 16px}
h1{font-size:22px}h2{font-size:17px;margin-top:32px;border-bottom:1px solid var(--line);padding-bottom:4px}
table{border-collapse:collapse;width:100%;margin:8px 0}th,td{border:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}
th{background:var(--head)}.muted{color:var(--muted)}.warn{color:var(--warn)}.bad{color:var(--bad)}.ok{color:var(--ok)}
ul{margin:0;padding-left:18px}.wrap{overflow-x:auto}
</style></head><body>
<h1>Partners import review</h1>
<p>Built ${escapeHtml(plan.generatedAt.slice(0, 10))} from <code>${escapeHtml(plan.sources.partners.file)}</code> and the reconciliation pack, checked against the CRM export. Nothing has been imported yet.</p>
<ul>
<li><b>${plan.companies.length}</b> organisations (${plan.companies.filter((company) => company.existingId).length} already in the CRM, ${plan.companies.filter((company) => company.group === 'AIRPORT').length} tagged Airport)</li>
<li><b>${people.length}</b> contacts (${matched.length} already in the CRM, updated rather than duplicated)</li>
<li><b>${touchCount}</b> touches: ${touchCount - rebuiltCount} recorded events, <b>${rebuiltCount} rebuilt</b></li>
<li><b>${flagged.length}</b> contacts flagged · <b>${differing.length}</b> where the CRM step differs from the Sheet's next action</li>
</ul>

<h2>1. Rebuilt touches: please check</h2>
<p class="muted">Touches the Sheet's next action proves but no event recorded. Each is dated on the Sheet's last-touch day.</p>
<div class="wrap">${table(
    ['Contact', 'Owner', 'Sheet next action', 'Rebuilt touches', 'CRM will show'],
    withRebuilt.map((person) => [
      `${escapeHtml(person.name)}<br><span class="muted">${escapeHtml(companyName.get(person.companyKey) ?? '')}</span>`,
      escapeHtml(person.ownerName ?? 'unowned'),
      escapeHtml(person.sheet.nextAction || '(none)'),
      `<ul>${person.touches
        .filter((touch) => touch.origin === 'rebuilt')
        .map((touch) => `<li>${escapeHtml(describeTouch(touch))}</li>`)
        .join('')}</ul>`,
      crmShows(person),
    ]),
  )}</div>

<h2>2. Flagged: nothing rebuilt, your call</h2>
<div class="wrap">${table(
    ['Contact', 'Sheet stage / next action', 'Issue', 'CRM will show'],
    flagged.map((person) => [
      `${escapeHtml(person.name)}<br><span class="muted">${escapeHtml(companyName.get(person.companyKey) ?? '')}</span>`,
      `${escapeHtml(person.sheet.stage)}<br><span class="muted">${escapeHtml(person.sheet.nextAction || '(none)')}</span>`,
      `<ul>${person.flags.map((flag) => `<li class="warn">${escapeHtml(flag)}</li>`).join('')}</ul>`,
      crmShows(person),
    ]),
  )}</div>

<h2>3. CRM step differs from the Sheet</h2>
<div class="wrap">${table(
    ['Contact', 'Sheet next action', 'CRM will show'],
    differing.map((person) => [
      escapeHtml(person.name),
      escapeHtml(person.sheet.nextAction),
      `<span class="bad">${crmShows(person)}</span>`,
    ]),
  )}</div>

<h2>4. Recorded events dated by rule</h2>
<div class="wrap">${table(['Contact', 'Touch', 'Why this date'], datedByRule)}</div>

<h2>5. Already in the CRM (updated, not duplicated)</h2>
<div class="wrap">${table(
    ['Sheet contact', 'Existing CRM record', 'Matched on'],
    matched.map((person) => [
      escapeHtml(person.name),
      escapeHtml(person.existingPersonName ?? ''),
      escapeHtml(person.matchedBy ?? ''),
    ]),
  )}</div>

<h2>6. Every contact</h2>
<div class="wrap">${table(
    ['Contact', 'Organisation', 'Owner', 'Stage', 'Sheet next action', 'Touches', 'CRM will show', 'Check'],
    people.map((person) => {
      const comparison = compareWithSheet(person);

      return [
        escapeHtml(person.name),
        escapeHtml(companyName.get(person.companyKey) ?? ''),
        escapeHtml(person.ownerName ?? 'unowned'),
        escapeHtml(person.stage),
        `${escapeHtml(person.sheet.nextAction || '(none)')}${person.sheet.nextActionDate ? ` <span class="muted">· ${escapeHtml(person.sheet.nextActionDate)}</span>` : ''}`,
        String(person.touches.length),
        crmShows(person),
        comparison === 'agrees'
          ? '<span class="ok">matches</span>'
          : comparison === 'differs'
            ? '<span class="bad">differs</span>'
            : '<span class="muted">n/a</span>',
      ];
    }),
  )}</div>
</body></html>`;
};
