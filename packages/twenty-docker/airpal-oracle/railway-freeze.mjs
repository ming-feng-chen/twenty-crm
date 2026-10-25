// Stops or restarts the Railway production CRM services without removing or rebuilding them.
// Usage: node railway-freeze.mjs stop|start|status   (uses the Railway CLI login)
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';

const ENVIRONMENT_ID = 'e7b0408f-ba9c-4bd4-b098-5182d62b1943';
const SERVICES = {
  doorman: '59a3100f-1758-4fdc-ad89-e09243573fd8',
  server: '975d5865-51e4-4d4c-a45f-1140998c5ae7',
  worker: 'edf9d0ba-12a0-4ac9-9717-97b6cce264cf',
};
const STARTABLE_STATUSES = ['SUCCESS', 'SLEEPING', 'CRASHED', 'DEPLOYING', 'INITIALIZING'];

const config = JSON.parse(readFileSync(`${homedir()}/.railway/config.json`, 'utf8'));
const token = config.user.accessToken ?? config.user.token;

const request = async (query, variables) => {
  const response = await fetch('https://backboard.railway.com/graphql/v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query, variables }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.errors) {
    throw new Error(`Railway API ${response.status}: ${JSON.stringify(body.errors ?? body)}`);
  }
  return body.data;
};

const currentDeployment = async (serviceId) => {
  const data = await request(
    `query ($input: DeploymentListInput!) { deployments(first: 10, input: $input) { edges { node { id status deploymentStopped } } } }`,
    { input: { serviceId, environmentId: ENVIRONMENT_ID } },
  );
  return data.deployments.edges.map((edge) => edge.node).find((node) => STARTABLE_STATUSES.includes(node.status));
};

const action = process.argv[2] ?? 'status';
// Stop the public entry first; start the backend before letting traffic back in.
const order = action === 'start' ? ['server', 'worker', 'doorman'] : ['doorman', 'server', 'worker'];

for (const name of order) {
  const deployment = await currentDeployment(SERVICES[name]);
  if (action === 'stop' && !deployment.deploymentStopped) {
    await request('mutation ($id: String!) { deploymentStop(id: $id) }', { id: deployment.id });
  }
  if (action === 'start' && deployment.deploymentStopped) {
    await request('mutation ($id: String!) { deploymentRestart(id: $id) }', { id: deployment.id });
  }
  const after = await currentDeployment(SERVICES[name]);
  console.log(`${name}: ${after.status}${after.deploymentStopped ? ' (stopped)' : ''} ${after.id}`);
}
