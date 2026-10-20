import { type CoreApiClient } from 'twenty-client-sdk/core';

import { type SharedContext } from 'src/data/store';
import {
  missingSuppressions,
  personIdentity,
} from 'src/utils/normalize-identity';
import {
  personDisplayName,
  type PersonRecord,
} from 'src/utils/person-cadence';

// Adds every email and LinkedIn URL on the person that the permanent list does
// not hold yet, one entry per identifier, and updates the shared index so the
// recompute that follows already treats the person as opted out.
export const ensureSuppressions = async ({
  client,
  person,
  shared,
  actorWorkspaceMemberId,
}: {
  client: CoreApiClient;
  person: PersonRecord;
  shared: SharedContext;
  actorWorkspaceMemberId: string | null;
}): Promise<string[]> => {
  const missing = missingSuppressions(
    personIdentity(person),
    shared.suppressionIndex,
  );
  const reason = `Asked us to stop: ${personDisplayName(person)} (person ${person.id}), set on ${shared.today}${
    actorWorkspaceMemberId === null
      ? ''
      : ` by workspace member ${actorWorkspaceMemberId}`
  }.`;
  const created: string[] = [];

  for (const email of missing.emails) {
    await client.mutation({
      createSuppression: {
        __args: { data: { name: email, email, reason } },
        id: true,
      },
    });
    shared.suppressionIndex.emails.add(email);
    created.push(email);
  }

  for (const linkedinUrl of missing.linkedinUrls) {
    await client.mutation({
      createSuppression: {
        __args: { data: { name: linkedinUrl, linkedinUrl, reason } },
        id: true,
      },
    });
    shared.suppressionIndex.linkedinUrls.add(linkedinUrl);
    created.push(linkedinUrl);
  }

  return created;
};
