import { t } from '@lingui/core/macro';
import { isNonEmptyString } from '@sniptt/guards';

import { type FastContactsTag } from '@/fast-contacts/types/FastContactsPerson';

// Members may not create tags directly (that would also let them rename
// them), so the Cadence app's create-tag route creates them with its own role.
export const createFastContactsTagThroughCadence = async ({
  routeUrl,
  name,
}: {
  routeUrl: string;
  name: string;
}): Promise<FastContactsTag> => {
  const response = await fetch(routeUrl, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  const body: { ok?: boolean; error?: unknown; tag?: FastContactsTag } | null =
    await response.json().catch(() => null);

  if (!response.ok || body?.ok === false || body?.tag === undefined) {
    const status = response.status;

    throw new Error(
      isNonEmptyString(body?.error)
        ? body.error
        : t`The tag could not be created (error ${status})`,
    );
  }

  return body.tag;
};
