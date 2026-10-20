// One-off switch from the standard single task assignee to the app's
// multi-assignee field. Read-only unless `apply`/`rollback` is given the exact
// fingerprint `plan` printed, so nothing changes between review and write.
//
//   TWENTY_API_TOKEN=... node scripts/task-assignees-switch-over.mjs plan --url <server>
//   TWENTY_API_TOKEN=... node scripts/task-assignees-switch-over.mjs apply --url <server> --confirm <fingerprint>
//   TWENTY_API_TOKEN=... node scripts/task-assignees-switch-over.mjs rollback --url <server> --receipt <file> --confirm <fingerprint>
//
// Production (crm.airpal.co.uk) also needs --production.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TASK_OBJECT = '20202020-1ba1-48ba-bc83-ef7e5990ed10';
const LEGACY_ASSIGNEE_FIELD = '20202020-065a-4f42-a906-e20422c1753f';
const ASSIGNED_TO_ME_VIEW = '20202020-a007-4a07-8a07-ba5ca551aaed';
const ASSIGNEES_FIELD = '31b48499-1599-4847-9d91-b769c7954c7d';
const TASK_ASSIGNEE_OBJECT = 'cc557cee-d03c-44a0-9404-f0a54c84cee3';
const TASK_ASSIGNEE_MEMBER_FIELD = '8bc63e10-c7f3-48a4-8dc5-2f631670844c';
const ASSIGNED_TO_ME_VALUE = JSON.stringify({
  isCurrentWorkspaceMemberSelected: true,
  selectedRecordIds: [],
});
const PAGE_SIZE = 100;

const args = process.argv.slice(2);
const mode = args[0];
const option = (flag) =>
  args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined;
const fail = (message) => {
  throw new Error(message);
};
const fingerprint = (value) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);

const serverUrl = option('--url')?.replace(/\/+$/, '') ?? fail('Pass --url.');
const token = process.env.TWENTY_API_TOKEN ?? fail('Set TWENTY_API_TOKEN.');

if (/crm\.airpal\.co\.uk/.test(serverUrl) && !args.includes('--production')) {
  fail('Refusing to touch production without --production.');
}

const receiptsDirectory = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../node_modules/.cache/task-assignees-switch-over',
);

const request = async (endpoint, query, variables = {}) => {
  const response = await fetch(`${serverUrl}${endpoint}`, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(60_000),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) fail(`${endpoint} returned HTTP ${response.status}.`);

  const body = await response.json();

  if (body.errors) {
    fail(`${endpoint}: ${body.errors.map((error) => error.message).join('; ')}`);
  }

  return body.data;
};

const metadata = (query, variables) => request('/metadata', query, variables);
const core = (query, variables) => request('/graphql', query, variables);

const readAllRecords = async (pluralName, selection, filter) => {
  const records = [];
  let after;

  for (;;) {
    const data = await core(
      `query($after: String, $filter: ${filter.type}) {
        ${pluralName}(first: ${PAGE_SIZE}, after: $after, filter: $filter) {
          edges { node { ${selection} } }
          pageInfo { hasNextPage endCursor }
        }
      }`,
      { after, filter: filter.value },
    );
    const page = data[pluralName];

    records.push(...page.edges.map(({ node }) => node));

    if (!page.pageInfo.hasNextPage) return records;

    after = page.pageInfo.endCursor;
  }
};

const readState = async () => {
  const { objects } = await metadata(`query {
    objects(paging: { first: 500 }) {
      edges { node { id universalIdentifier fieldsList { id name universalIdentifier isActive } } }
    }
  }`);
  const objectByIdentifier = (identifier) =>
    objects.edges.map(({ node }) => node).find(
      (object) => object.universalIdentifier === identifier,
    ) ?? fail(`Object ${identifier} is missing; deploy the app first.`);
  const fieldByIdentifier = (object, identifier) =>
    object.fieldsList.find((field) => field.universalIdentifier === identifier) ??
    fail(`Field ${identifier} is missing; deploy the app first.`);

  const taskObject = objectByIdentifier(TASK_OBJECT);
  const legacyAssigneeField = fieldByIdentifier(taskObject, LEGACY_ASSIGNEE_FIELD);
  const assigneesField = fieldByIdentifier(taskObject, ASSIGNEES_FIELD);
  const memberField = fieldByIdentifier(
    objectByIdentifier(TASK_ASSIGNEE_OBJECT),
    TASK_ASSIGNEE_MEMBER_FIELD,
  );

  const { getViews } = await metadata(
    `query($objectMetadataId: String!) {
      getViews(objectMetadataId: $objectMetadataId) {
        id universalIdentifier name
        viewFields { id fieldMetadataId position size isVisible aggregateOperation viewFieldGroupId }
        viewFilters { id fieldMetadataId operand value relationTargetFieldMetadataId viewFilterGroupId positionInViewFilterGroup subFieldName }
      }
    }`,
    { objectMetadataId: taskObject.id },
  );
  const assignedToMeView =
    getViews.find((view) => view.universalIdentifier === ASSIGNED_TO_ME_VIEW) ??
    fail('The standard "Assigned to Me" view is missing.');

  const assignedTasks = await readAllRecords('tasks', 'id assigneeId', {
    type: 'TaskFilterInput',
    value: { assigneeId: { is: 'NOT_NULL' } },
  });
  const taskAssignees = await readAllRecords(
    'taskAssignees',
    'id taskId workspaceMemberId',
    { type: 'TaskAssigneeFilterInput', value: {} },
  );

  return {
    legacyAssigneeField,
    assigneesField,
    memberField,
    assignedToMeView,
    legacyFieldViewEntries: getViews.map((view) => ({
      viewId: view.id,
      viewName: view.name,
      hasAssigneesViewField: view.viewFields.some(
        (viewField) => viewField.fieldMetadataId === assigneesField.id,
      ),
      hasAssigneesViewFilter: view.viewFilters.some(
        (viewFilter) => viewFilter.fieldMetadataId === assigneesField.id,
      ),
      viewFields: view.viewFields.filter(
        (viewField) => viewField.fieldMetadataId === legacyAssigneeField.id,
      ),
      viewFilters: view.viewFilters.filter(
        (viewFilter) => viewFilter.fieldMetadataId === legacyAssigneeField.id,
      ),
    })),
    assignedTasks,
    taskAssignees,
  };
};

const buildPlan = (state) => {
  const existingPairs = new Set(
    state.taskAssignees.map(({ taskId, workspaceMemberId }) =>
      `${taskId}:${workspaceMemberId}`,
    ),
  );

  return {
    server: new URL(serverUrl).host,
    legacyAssigneeFieldId: state.legacyAssigneeField.id,
    legacyAssigneeFieldIsActive: state.legacyAssigneeField.isActive,
    assigneesFieldId: state.assigneesField.id,
    memberFieldId: state.memberField.id,
    assignedToMeViewId: state.assignedToMeView.id,
    assignedToMeHasAssigneesFilter: state.assignedToMeView.viewFilters.some(
      (viewFilter) => viewFilter.fieldMetadataId === state.assigneesField.id,
    ),
    tasksWithLegacyAssignee: state.assignedTasks.length,
    rowsToCreate: state.assignedTasks
      .filter(({ id, assigneeId }) => !existingPairs.has(`${id}:${assigneeId}`))
      .map(({ id, assigneeId }) => ({ taskId: id, workspaceMemberId: assigneeId }))
      .sort((first, second) => first.taskId.localeCompare(second.taskId)),
    legacyFieldViewEntries: state.legacyFieldViewEntries
      .filter(
        (entry) => entry.viewFields.length > 0 || entry.viewFilters.length > 0,
      )
      .map(
        ({
          hasAssigneesViewField: _hasAssigneesViewField,
          hasAssigneesViewFilter: _hasAssigneesViewFilter,
          ...entry
        }) => entry,
      ),
    // Views the app cannot target (e.g. copies of All Tasks) get the new
    // column where the old one sat.
    assigneesViewFieldsToCreate: state.legacyFieldViewEntries
      .filter((entry) => !entry.hasAssigneesViewField)
      .flatMap((entry) =>
        entry.viewFields.slice(0, 1).map((viewField) => ({
          viewId: entry.viewId,
          viewName: entry.viewName,
          position: viewField.position,
          size: viewField.size,
          isVisible: viewField.isVisible,
        })),
      ),
    // Every filter on the old field (e.g. "Assignee is me" on By Status) is
    // recreated on the new one, since deactivation deletes it.
    assigneesViewFiltersToCreate: [
      ...state.legacyFieldViewEntries
        .filter((entry) => !entry.hasAssigneesViewFilter)
        .flatMap((entry) =>
          entry.viewFilters.map((viewFilter) => ({
            viewId: entry.viewId,
            viewName: entry.viewName,
            operand: viewFilter.operand,
            value: viewFilter.value,
            viewFilterGroupId: viewFilter.viewFilterGroupId ?? null,
            positionInViewFilterGroup: viewFilter.positionInViewFilterGroup ?? null,
          })),
        ),
      ...(state.assignedToMeView.viewFilters.some(
        (viewFilter) =>
          viewFilter.fieldMetadataId === state.assigneesField.id ||
          viewFilter.fieldMetadataId === state.legacyAssigneeField.id,
      )
        ? []
        : [
            {
              viewId: state.assignedToMeView.id,
              viewName: state.assignedToMeView.name,
              operand: 'IS',
              value: ASSIGNED_TO_ME_VALUE,
              viewFilterGroupId: null,
              positionInViewFilterGroup: null,
            },
          ]),
    ],
  };
};

const printPlan = (plan) => {
  console.log(`Server: ${plan.server}`);
  console.log(`Tasks with a single assignee: ${plan.tasksWithLegacyAssignee}`);
  console.log(`Assignee rows to copy: ${plan.rowsToCreate.length}`);
  console.log(
    `"Assigned to Me" already filters on the new field: ${plan.assignedToMeHasAssigneesFilter}`,
  );
  console.log(`Old single assignee field active: ${plan.legacyAssigneeFieldIsActive}`);
  for (const viewField of plan.assigneesViewFieldsToCreate) {
    console.log(`  view "${viewField.viewName}": new Assignee column to add`);
  }
  for (const viewFilter of plan.assigneesViewFiltersToCreate) {
    console.log(
      `  view "${viewFilter.viewName}": filter "Assignee ${viewFilter.operand}" to recreate on the new field`,
    );
  }
  for (const entry of plan.legacyFieldViewEntries) {
    console.log(
      `  view "${entry.viewName}": ${entry.viewFields.length} column(s), ${entry.viewFilters.length} filter(s) on the old field (removed on deactivation, kept in the receipt)`,
    );
  }
  console.log(`Fingerprint: ${fingerprint(plan)}`);
};

const verify = async () => {
  const state = await readState();
  const plan = buildPlan(state);
  const problems = [
    ...(plan.rowsToCreate.length > 0
      ? [`${plan.rowsToCreate.length} assignee row(s) still missing`]
      : []),
    ...(plan.assignedToMeHasAssigneesFilter ? [] : ['"Assigned to Me" has no new filter']),
    ...(plan.legacyAssigneeFieldIsActive ? ['old assignee field still active'] : []),
  ];

  return { plan, problems };
};

const apply = async () => {
  const plan = buildPlan(await readState());

  if (fingerprint(plan) !== option('--confirm')) {
    printPlan(plan);
    fail('State differs from the reviewed plan; review it again.');
  }

  mkdirSync(receiptsDirectory, { recursive: true });
  const receiptPath = path.join(
    receiptsDirectory,
    `${plan.server}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  );
  const receipt = {
    plan,
    createdTaskAssigneeIds: [],
    createdViewFieldIds: [],
    createdViewFilterIds: [],
  };
  const saveReceipt = () =>
    writeFileSync(receiptPath, JSON.stringify(receipt, null, 2));

  saveReceipt();

  for (let index = 0; index < plan.rowsToCreate.length; index += PAGE_SIZE) {
    const { createTaskAssignees } = await core(
      `mutation($data: [TaskAssigneeCreateInput!]!) { createTaskAssignees(data: $data) { id } }`,
      { data: plan.rowsToCreate.slice(index, index + PAGE_SIZE) },
    );

    receipt.createdTaskAssigneeIds.push(...createTaskAssignees.map(({ id }) => id));
    saveReceipt();
  }

  for (const viewField of plan.assigneesViewFieldsToCreate) {
    const { createViewField } = await metadata(
      `mutation($input: CreateViewFieldInput!) { createViewField(input: $input) { id } }`,
      {
        input: {
          viewId: viewField.viewId,
          fieldMetadataId: plan.assigneesFieldId,
          position: viewField.position,
          size: viewField.size,
          isVisible: viewField.isVisible,
        },
      },
    );

    receipt.createdViewFieldIds.push(createViewField.id);
    saveReceipt();
  }

  for (const viewFilter of plan.assigneesViewFiltersToCreate) {
    const { createViewFilter } = await metadata(
      `mutation($input: CreateViewFilterInput!) { createViewFilter(input: $input) { id } }`,
      {
        input: {
          viewId: viewFilter.viewId,
          fieldMetadataId: plan.assigneesFieldId,
          relationTargetFieldMetadataId: plan.memberFieldId,
          operand: viewFilter.operand,
          value: viewFilter.value,
          ...(viewFilter.viewFilterGroupId
            ? {
                viewFilterGroupId: viewFilter.viewFilterGroupId,
                positionInViewFilterGroup: viewFilter.positionInViewFilterGroup,
              }
            : {}),
        },
      },
    );

    receipt.createdViewFilterIds.push(createViewFilter.id);
    saveReceipt();
  }

  if (plan.legacyAssigneeFieldIsActive) {
    await metadata(
      `mutation($input: UpdateOneFieldMetadataInput!) { updateOneField(input: $input) { id isActive } }`,
      { input: { id: plan.legacyAssigneeFieldId, update: { isActive: false } } },
    );
  }

  const { problems } = await verify();

  console.log(`Receipt: ${receiptPath}`);
  console.log(`Receipt fingerprint (for rollback): ${fingerprint(receipt)}`);

  if (problems.length > 0) fail(`Applied, but verification failed: ${problems.join('; ')}`);

  console.log('Applied and verified.');
};

// Restores the old field and the columns/filters its deactivation removed. The
// copied assignee rows stay; they are harmless once the old field is back.
const rollback = async () => {
  const receipt = JSON.parse(
    readFileSync(option('--receipt') ?? fail('Pass --receipt.'), 'utf8'),
  );

  if (fingerprint(receipt) !== option('--confirm')) fail('Receipt fingerprint mismatch.');
  if (receipt.plan.server !== new URL(serverUrl).host) fail('Receipt is for another server.');

  await metadata(
    `mutation($input: UpdateOneFieldMetadataInput!) { updateOneField(input: $input) { id isActive } }`,
    { input: { id: receipt.plan.legacyAssigneeFieldId, update: { isActive: true } } },
  );

  const state = await readState();
  const currentEntries = new Map(
    state.legacyFieldViewEntries.map((entry) => [entry.viewId, entry]),
  );

  for (const entry of receipt.plan.legacyFieldViewEntries) {
    const current = currentEntries.get(entry.viewId);

    if (current?.viewFields.length === 0) {
      for (const viewField of entry.viewFields) {
        await metadata(
          `mutation($input: CreateViewFieldInput!) { createViewField(input: $input) { id } }`,
          {
            input: {
              viewId: entry.viewId,
              fieldMetadataId: viewField.fieldMetadataId,
              position: viewField.position,
              size: viewField.size,
              isVisible: viewField.isVisible,
              ...(viewField.aggregateOperation ? { aggregateOperation: viewField.aggregateOperation } : {}),
              ...(viewField.viewFieldGroupId ? { viewFieldGroupId: viewField.viewFieldGroupId } : {}),
            },
          },
        );
      }
    }

    if (current?.viewFilters.length === 0) {
      for (const viewFilter of entry.viewFilters) {
        await metadata(
          `mutation($input: CreateViewFilterInput!) { createViewFilter(input: $input) { id } }`,
          {
            input: {
              viewId: entry.viewId,
              fieldMetadataId: viewFilter.fieldMetadataId,
              operand: viewFilter.operand,
              value: viewFilter.value,
              ...(viewFilter.subFieldName ? { subFieldName: viewFilter.subFieldName } : {}),
            },
          },
        );
      }
    }
  }

  const createdViewFilterIds = [
    ...(receipt.createdViewFilterIds ?? []),
    ...(receipt.createdViewFilterId ? [receipt.createdViewFilterId] : []),
  ];

  for (const viewFilterId of createdViewFilterIds) {
    await metadata(
      `mutation($input: DestroyViewFilterInput!) { destroyViewFilter(input: $input) { id } }`,
      { input: { id: viewFilterId } },
    );
  }

  for (const viewFieldId of receipt.createdViewFieldIds ?? []) {
    await metadata(
      `mutation($input: DestroyViewFieldInput!) { destroyViewField(input: $input) { id } }`,
      { input: { id: viewFieldId } },
    );
  }

  console.log(
    'Rolled back: old assignee field, its columns and filters restored; added columns and filter removed.',
  );
};

const run = async () => {
  switch (mode) {
    case 'plan':
      printPlan(buildPlan(await readState()));
      return;
    case 'verify': {
      const { problems } = await verify();
      console.log(problems.length === 0 ? 'Switch-over complete.' : problems.join('\n'));
      return;
    }
    case 'apply':
      await apply();
      return;
    case 'rollback':
      await rollback();
      return;
    default:
      fail('Mode must be plan, verify, apply or rollback.');
  }
};

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
