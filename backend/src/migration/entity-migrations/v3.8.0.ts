import { Knex } from 'knex';

const TRANSFORMERS_TABLE = 'transformers';
const NORTH_CONNECTORS_TABLE = 'north_connectors';
const HISTORY_QUERIES_TABLE = 'history_queries';

interface OldNorthRESTSettings {
  host: string;
  acceptUnauthorized: boolean;
  endpoint: string;
  testPath: string;
  timeout: number;
  authType: 'basic' | 'bearer';
  bearerAuthToken?: string | null;
  basicAuthUsername?: string;
  basicAuthPassword?: string | null;
  queryParams: Array<{
    key: string;
    value: string;
  }> | null;
  useProxy: boolean;
  proxyUrl?: string;
  proxyUsername?: string | null;
  proxyPassword?: string | null;
}

interface NewNorthRESTSettings {
  host: string;
  acceptUnauthorized: boolean;
  method: 'POST' | 'PUT' | 'PATCH';
  endpoint: string;
  timeout: number;
  sendAs: 'body' | 'file';
  successCode: number;
  authentication: {
    type: 'none' | 'basic' | 'bearer' | 'api-key';
    username?: string;
    password?: string | null;
    token?: string | null;
    addTo?: 'header' | 'query-params';
    apiKey?: string;
    apiValue?: string | null;
  };
  queryParams: Array<{
    key: string;
    value: string;
  }>;
  headers: Array<{
    key: string;
    value: string;
  }>;
  proxy: {
    useProxy: boolean;
    proxyUrl?: string;
    proxyUsername?: string | null;
    proxyPassword?: string | null;
  };
  test: {
    testMethod: 'GET' | 'POST' | 'PUT';
    testEndpoint: string;
    body?: string | null;
    testSuccessCode: number;
  };
}
export async function up(knex: Knex): Promise<void> {
  await updateTransformersTable(knex);
  await updateNorthRestConnectors(knex);
}

async function updateTransformersTable(knex: Knex): Promise<void> {
  await knex.schema.alterTable(TRANSFORMERS_TABLE, table => {
    table.string('language');
  });

  await knex(TRANSFORMERS_TABLE).update({ language: 'javascript' }).where('type', 'custom');
}

async function updateNorthRestConnectors(knex: Knex): Promise<void> {
  const oldNorth: Array<{
    id: string;
    type: string;
    settings: string;
  }> = await knex(NORTH_CONNECTORS_TABLE).select('id', 'type', 'settings').where('type', 'rest');

  for (const connector of oldNorth) {
    const oldSettings = JSON.parse(connector.settings) as OldNorthRESTSettings;
    const newSettings: NewNorthRESTSettings = {
      host: oldSettings.host,
      acceptUnauthorized: oldSettings.acceptUnauthorized,
      method: 'POST',
      endpoint: oldSettings.endpoint,
      timeout: oldSettings.timeout,
      sendAs: 'file',
      successCode: 201,
      authentication: {
        type: oldSettings.authType,
        username: oldSettings.basicAuthUsername,
        password: oldSettings.basicAuthPassword,
        token: oldSettings.bearerAuthToken,
        addTo: undefined,
        apiKey: undefined,
        apiValue: undefined
      },
      queryParams: oldSettings.queryParams || [],
      headers: [],
      proxy: {
        useProxy: oldSettings.useProxy,
        proxyUrl: oldSettings.proxyUrl,
        proxyUsername: oldSettings.proxyUsername,
        proxyPassword: oldSettings.proxyPassword
      },
      test: {
        testMethod: 'GET',
        testEndpoint: oldSettings.testPath,
        body: undefined,
        testSuccessCode: 200
      }
    };
    await knex(NORTH_CONNECTORS_TABLE)
      .update({ settings: JSON.stringify(newSettings) })
      .where('id', connector.id);
  }

  const oldHistories: Array<{
    id: string;
    north_type: string;
    north_settings: string;
  }> = await knex(HISTORY_QUERIES_TABLE).select('id', 'north_type', 'north_settings').where('north_type', 'rest');

  for (const history of oldHistories) {
    const oldSettings = JSON.parse(history.north_settings) as OldNorthRESTSettings;
    const newSettings: NewNorthRESTSettings = {
      host: oldSettings.host,
      acceptUnauthorized: oldSettings.acceptUnauthorized,
      method: 'POST',
      endpoint: oldSettings.endpoint,
      timeout: oldSettings.timeout,
      sendAs: 'file',
      successCode: 201,
      authentication: {
        type: oldSettings.authType,
        username: oldSettings.basicAuthUsername,
        password: oldSettings.basicAuthPassword,
        token: oldSettings.bearerAuthToken,
        addTo: undefined,
        apiKey: undefined,
        apiValue: undefined
      },
      queryParams: oldSettings.queryParams || [],
      headers: [],
      proxy: {
        useProxy: oldSettings.useProxy,
        proxyUrl: oldSettings.proxyUrl,
        proxyUsername: oldSettings.proxyUsername,
        proxyPassword: oldSettings.proxyPassword
      },
      test: {
        testMethod: 'GET',
        testEndpoint: oldSettings.testPath,
        body: undefined,
        testSuccessCode: 200
      }
    };
    await knex(HISTORY_QUERIES_TABLE)
      .update({ north_settings: JSON.stringify(newSettings) })
      .where('id', history.id);
  }
}

export async function down(_knex: Knex): Promise<void> {
  return;
}
