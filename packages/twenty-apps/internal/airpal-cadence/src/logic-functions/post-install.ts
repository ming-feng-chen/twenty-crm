import {
  definePostInstallLogicFunction,
  type InstallPayload,
} from 'twenty-sdk/define';

import { POST_INSTALL_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { withErrorLogging } from 'src/data/log-errors';
import { createAppClient } from 'src/data/api';
import { recomputeEveryone } from 'src/data/recompute';
import { reconcileRules, seedDefaultCadence } from 'src/data/rules';
import { loadSharedContext } from 'src/data/store';

// Install and every upgrade: seed the default cadence if there is none
// (idempotent), apply the stored rules if they are not applied yet, and
// recompute everyone, since a new app version may compute differently.
const handler = async (payload: InstallPayload) => {
  const client = createAppClient();
  const seed = await seedDefaultCadence(client);
  const rules =
    seed.status === 'exists'
      ? await reconcileRules({
          client,
          changedByWorkspaceMemberId: null,
          reason: `App installed (${payload?.previousVersion ?? 'new'} → ${payload?.newVersion ?? 'unknown'})`,
        })
      : seed.apply;
  const stats = await recomputeEveryone(client, await loadSharedContext(client));
  const result = {
    seed: seed.status,
    rules: rules.status,
    contactsRecomputed: stats.contactsRecomputed,
    contactsWritten: stats.contactsWritten,
    failures: stats.failures,
  };

  console.log(JSON.stringify({ trigger: 'postInstall', ...result }));

  return result;
};

export default definePostInstallLogicFunction({
  universalIdentifier: POST_INSTALL_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'post-install',
  description:
    'Seeds the default cadence if none exists, applies the stored rules and recomputes every contact.',
  timeoutSeconds: 900,
  handler: withErrorLogging('post-install', handler),
});
