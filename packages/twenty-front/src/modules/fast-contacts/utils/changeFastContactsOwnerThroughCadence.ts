import { t } from '@lingui/core/macro';
import { isNonEmptyString } from '@sniptt/guards';

import { type FastContactsOwnerChangeMode } from '@/fast-contacts/types/FastContactsCellWrite';

// The Cadence app's Change owner route (as My Day uses it) applies the
// handover rules, so the grid never writes the owner fields itself.
export const changeFastContactsOwnerThroughCadence = async ({
  routeUrl,
  personId,
  ownerId,
  mode,
}: {
  routeUrl: string;
  personId: string;
  ownerId: string | null;
  mode: FastContactsOwnerChangeMode;
}): Promise<void> => {
  const response = await fetch(routeUrl, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ personId, ownerId, mode }),
  });
  const body: { ok?: boolean; error?: unknown } | null = await response
    .json()
    .catch(() => null);

  if (!response.ok || body?.ok === false) {
    const status = response.status;

    throw new Error(
      isNonEmptyString(body?.error)
        ? body.error
        : t`The owner could not be changed (error ${status})`,
    );
  }
};
