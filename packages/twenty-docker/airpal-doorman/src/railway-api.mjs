const RAILWAY_API_URL = 'https://backboard.railway.com/graphql/v2';

const STARTABLE_DEPLOYMENT_STATUSES = [
  'SUCCESS',
  'SLEEPING',
  'CRASHED',
  'DEPLOYING',
  'INITIALIZING',
];

export const createRailwayApi = ({ token, environmentId }) => {
  const request = async (query, variables) => {
    const response = await fetch(RAILWAY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Project-Access-Token': token,
      },
      body: JSON.stringify({ query, variables }),
    });
    const body = await response.json().catch(() => ({}));

    if (!response.ok || body.errors) {
      throw new Error(
        `Railway API ${response.status}: ${JSON.stringify(body.errors ?? body)}`,
      );
    }

    return body.data;
  };

  const getCurrentDeployment = async (serviceId) => {
    const data = await request(
      `query ($input: DeploymentListInput!) {
        deployments(first: 10, input: $input) {
          edges { node { id status deploymentStopped } }
        }
      }`,
      { input: { serviceId, environmentId } },
    );

    const deployment = data.deployments.edges
      .map((edge) => edge.node)
      .find((node) => STARTABLE_DEPLOYMENT_STATUSES.includes(node.status));

    if (!deployment) {
      throw new Error(`No startable deployment for service ${serviceId}`);
    }

    return deployment;
  };

  const startService = async (serviceId) => {
    const deployment = await getCurrentDeployment(serviceId);

    if (!deployment.deploymentStopped) {
      return;
    }

    await request(`mutation ($id: String!) { deploymentRestart(id: $id) }`, {
      id: deployment.id,
    });
  };

  const stopService = async (serviceId) => {
    const deployment = await getCurrentDeployment(serviceId);

    if (deployment.deploymentStopped) {
      return;
    }

    await request(`mutation ($id: String!) { deploymentStop(id: $id) }`, {
      id: deployment.id,
    });
  };

  const isServiceStopped = async (serviceId) =>
    (await getCurrentDeployment(serviceId)).deploymentStopped;

  return { startService, stopService, isServiceStopped };
};
