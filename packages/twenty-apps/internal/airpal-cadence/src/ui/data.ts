import { type CoreApiClient, type CoreSchema } from 'twenty-client-sdk/core';

import {
  type TouchChannelOption,
} from 'src/utils/touch-channels';
import { metadataQuery } from 'src/ui/api';
import { getRulesRoute } from 'src/ui/routes';
import { DEFAULT_TIME_ZONE } from 'src/ui/dates';
import {
  type MemberSummary,
  type OwnerFilter,
  type PersonNode,
  personName,
} from 'src/ui/my-day';

// Reads and plain field writes through the core API, as the viewer.

export type Member = MemberSummary & { userId: string | null };

export const loadMembers = async (client: CoreApiClient): Promise<Member[]> => {
  const { workspaceMembers } = await client.query({
    workspaceMembers: {
      __args: { first: 200 },
      edges: {
        node: {
          id: true,
          userId: true,
          userEmail: true,
          name: { firstName: true, lastName: true },
        },
      },
    },
  });

  return (workspaceMembers?.edges ?? [])
    .map(({ node }) => {
      const name = personName(node.name);

      return {
        id: node.id,
        userId: node.userId ?? null,
        displayName:
          name === 'Unnamed person' ? (node.userEmail ?? 'Unnamed member') : name,
      };
    })
    .sort((first, second) =>
      first.displayName.localeCompare(second.displayName, 'en-GB'),
    );
};

// Who is looking: the workspace member behind the component's token. The
// metadata API answers directly; failing that, the SDK's user id is matched
// to a member. Null means unknown, and the page says so.
export const loadViewerMemberId = async (
  members: readonly Member[],
  userId: string | null,
): Promise<string | null> => {
  try {
    const data = await metadataQuery<{
      currentUser?: { workspaceMember?: { id?: string | null } | null } | null;
    }>('{ currentUser { workspaceMember { id } } }');
    const id = data.currentUser?.workspaceMember?.id;

    if (typeof id === 'string' && id.length > 0) {
      return id;
    }
  } catch {
    // Fall through to the user id match.
  }

  return members.find((member) => member.userId === userId)?.id ?? null;
};

export const loadTouchChannelOptions = async (): Promise<TouchChannelOption[]> => {
  const answer = await getRulesRoute();
  if (answer.touchChannels === null) throw new Error(answer.touchChannelsError ?? 'The channel list could not be loaded.');
  return answer.touchChannels;
};

export type RulesPermission = 'canEdit' | 'readOnly' | 'unknown';

type PermissionData = {
  objects?: { edges?: { node: { id: string; nameSingular: string } }[] };
  currentUser?: {
    currentUserWorkspace?: {
      objectsPermissions?: {
        objectMetadataId: string;
        canUpdateObjectRecords?: boolean | null;
        canSoftDeleteObjectRecords?: boolean | null;
      }[];
    } | null;
  } | null;
};

// Admin detection: saving rules writes the cadence and its steps (create,
// update, delete) with the viewer's own permissions, so "can edit" means the
// viewer's role may update `cadence` and update and delete `cadenceStep`.
// The save route's 403 has the last word (the editor turns read-only then).
export const loadRulesPermission = async (): Promise<RulesPermission> => {
  try {
    const data = await metadataQuery<PermissionData>(`{
      objects(paging: { first: 500 }) { edges { node { id nameSingular } } }
      currentUser { currentUserWorkspace { objectsPermissions {
        objectMetadataId canUpdateObjectRecords canSoftDeleteObjectRecords
      } } }
    }`);
    const idOf = (name: string) =>
      data.objects?.edges?.find((edge) => edge.node.nameSingular === name)?.node.id;
    const permissions =
      data.currentUser?.currentUserWorkspace?.objectsPermissions ?? [];
    const permissionOf = (name: string) =>
      permissions.find((entry) => entry.objectMetadataId === idOf(name));
    const cadence = permissionOf('cadence');
    const step = permissionOf('cadenceStep');

    if (cadence === undefined || step === undefined) {
      return 'unknown';
    }

    return cadence.canUpdateObjectRecords === true &&
      step.canUpdateObjectRecords === true &&
      step.canSoftDeleteObjectRecords === true
      ? 'canEdit'
      : 'readOnly';
  } catch {
    return 'unknown';
  }
};

export const loadCadenceTimeZone = async (
  client: CoreApiClient,
): Promise<string> => {
  const { cadences } = await client.query({
    cadences: {
      __args: { first: 1, filter: { isDefault: { eq: true } } },
      edges: { node: { id: true, timeZone: true } },
    },
  });
  const timeZone = cadences?.edges?.[0]?.node.timeZone;

  return typeof timeZone === 'string' && timeZone.length > 0
    ? timeZone
    : DEFAULT_TIME_ZONE;
};

const PERSON_SELECTION = {
  id: true,
  name: { firstName: true, lastName: true },
  company: { name: true },
  emails: { primaryEmail: true, additionalEmails: true },
  cadenceStage: true,
  cadenceStep: true,
  cadenceState: true,
  cadenceHealth: true,
  nextActionDate: true,
  cadenceOwnerId: true,
  snoozeUntil: true,
  revisitDate: true,
  optedOut: true,
  optOutReason: true,
  cadenceDue: true,
  cadenceActions: true,
} as const;

const PAGE_SIZE = 200;
// A runaway list would be a bug; stop and say so rather than load for ever.
const MAX_PEOPLE = 2000;

export type DuePeople = { people: PersonNode[]; isTruncated: boolean };

// My Day rows: cadenceDue = true and the chosen owner (or any owner).
export const loadDuePeople = async (
  client: CoreApiClient,
  owner: OwnerFilter,
): Promise<DuePeople> => {
  const people: PersonNode[] = [];
  let after: string | undefined;

  for (;;) {
    const { people: page } = await client.query({
      people: {
        __args: {
          first: PAGE_SIZE,
          ...(after === undefined ? {} : { after }),
          filter: {
            cadenceDue: { eq: true },
            ...('ownerId' in owner
              ? { cadenceOwnerId: { eq: owner.ownerId } }
              : { cadenceOwnerId: { is: 'NOT_NULL' } }),
          } as CoreSchema.PersonFilterInput,
          orderBy: [{ nextActionDate: 'AscNullsLast' }],
        },
        pageInfo: { hasNextPage: true, endCursor: true },
        edges: { node: PERSON_SELECTION },
      },
    });

    for (const edge of page?.edges ?? []) {
      people.push(edge.node as PersonNode);
    }

    const hasNextPage = page?.pageInfo?.hasNextPage === true;
    const endCursor = page?.pageInfo?.endCursor ?? undefined;

    if (!hasNextPage || endCursor === undefined || endCursor === null) {
      return { people, isTruncated: false };
    }

    if (people.length >= MAX_PEOPLE) {
      return { people, isTruncated: true };
    }

    after = endCursor;
  }
};

export const loadPerson = async (
  client: CoreApiClient,
  personId: string,
): Promise<PersonNode | null> => {
  const { person } = await client.query({
    person: {
      __args: { filter: { id: { eq: personId } } },
      ...PERSON_SELECTION,
    },
  });

  return (person as PersonNode | null | undefined) ?? null;
};

// A plain field edit on the person (Snooze, Hold, Dead, Opt out, email). The
// person.updated trigger does the rest; the caller then asks the recompute
// route for the result.
export const updatePersonFields = async (
  client: CoreApiClient,
  personId: string,
  data: Record<string, unknown>,
): Promise<void> => {
  const { updatePerson } = await client.mutation({
    updatePerson: {
      __args: { id: personId, data: data as CoreSchema.PersonUpdateInput },
      id: true,
    },
  });

  if (updatePerson === null || updatePerson === undefined) {
    throw new Error('The person was not updated (no record came back).');
  }
};

export type CadenceChangeRow = {
  id: string;
  summary: string | null;
  changedAt: string | null;
  changedByName: string | null;
  contactsRecomputed: number | null;
  contactsWhoseDateChanged: number | null;
};

export const loadCadenceChanges = async (
  client: CoreApiClient,
): Promise<CadenceChangeRow[]> => {
  const { cadenceChanges } = await client.query({
    cadenceChanges: {
      __args: { first: 25, orderBy: [{ changedAt: 'DescNullsLast' }] },
      edges: {
        node: {
          id: true,
          summary: true,
          changedAt: true,
          contactsRecomputed: true,
          contactsWhoseDateChanged: true,
          changedBy: { name: { firstName: true, lastName: true } },
        },
      },
    },
  });

  return (cadenceChanges?.edges ?? []).map(({ node }) => ({
    id: node.id,
    summary: node.summary ?? null,
    changedAt: node.changedAt ?? null,
    changedByName:
      node.changedBy === null || node.changedBy === undefined
        ? null
        : personName(node.changedBy.name),
    contactsRecomputed: node.contactsRecomputed ?? null,
    contactsWhoseDateChanged: node.contactsWhoseDateChanged ?? null,
  }));
};
