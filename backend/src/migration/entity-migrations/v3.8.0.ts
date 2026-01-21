import { Knex } from 'knex';
import { generateRandomId } from '../../service/utils';

const TRANSFORMERS_TABLE = 'transformers';
const NORTH_CONNECTORS_TABLE = 'north_connectors';
const HISTORY_QUERIES_TABLE = 'history_queries';
const NORTH_TRANSFORMERS_TABLE = 'north_transformers';
const NORTH_TRANSFORMERS_ITEMS_TABLE = 'north_transformers_items';
const HISTORY_QUERY_TRANSFORMERS_TABLE = 'history_query_transformers';
const HISTORY_QUERY_TRANSFORMERS_ITEMS_TABLE = 'history_query_transformers_items';
const SOUTH_CONNECTORS_TABLE = 'south_connectors';
const SUBSCRIPTION_TABLE = 'subscription';
const REGISTRATIONS_TABLE = 'registrations';
const SOUTH_ITEMS_TABLE = 'south_items';
const HISTORY_ITEMS_TABLE = 'history_items';

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
  await updateRegistrationSettings(knex);
  await updateTransformersTable(knex);
  await updateNorthRestConnectors(knex);
  await createDefaultTransformers(knex);
  await migrateSubscriptionsToTransformers(knex);
  await addTransformersItems(knex);
}

async function updateRegistrationSettings(knex: Knex): Promise<void> {
  await knex.schema.alterTable(REGISTRATIONS_TABLE, table => {
    table.boolean('command_search_history_cache_content');
    table.boolean('command_get_history_cache_file_content');
    table.boolean('command_remove_history_cache_content');
    table.boolean('command_move_history_cache_content');
    table.boolean('command_search_north_cache_content');
    table.boolean('command_get_north_cache_file_content');
    table.boolean('command_remove_north_cache_content');
    table.boolean('command_move_north_cache_content');
  });
  await knex(REGISTRATIONS_TABLE).update({
    command_search_history_cache_content: true,
    command_get_history_cache_file_content: true,
    command_remove_history_cache_content: true,
    command_move_history_cache_content: true,
    command_search_north_cache_content: true,
    command_get_north_cache_file_content: true,
    command_remove_north_cache_content: true,
    command_move_north_cache_content: true
  });
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

async function createDefaultTransformers(knex: Knex): Promise<void> {
  if (!knex.select('id').where({ function_name: 'csv-to-mqtt' })) {
    knex.insert({ id: generateRandomId(6), type: 'standard', input_type: 'any', output_type: 'mqtt', function_name: 'csv-to-mqtt' });
  }
  if (!knex.select('id').where({ function_name: 'csv-to-time-values' })) {
    knex.insert({
      id: generateRandomId(6),
      type: 'standard',
      input_type: 'any',
      output_type: 'time-values',
      function_name: 'csv-to-time-values'
    });
  }
  if (!knex.select('id').where({ function_name: 'ignore' })) {
    knex.insert({
      id: generateRandomId(6),
      type: 'standard',
      input_type: 'any',
      output_type: 'any',
      function_name: 'ignore'
    });
  }
  if (!knex.select('id').where({ function_name: 'iso' })) {
    knex.insert({
      id: generateRandomId(6),
      type: 'standard',
      input_type: 'any',
      output_type: 'any',
      function_name: 'iso'
    });
  }
  if (!knex.select('id').where({ function_name: 'json-to-csv' })) {
    knex.insert({
      id: generateRandomId(6),
      type: 'standard',
      input_type: 'any',
      output_type: 'any',
      function_name: 'json-to-csv'
    });
  }
  if (!knex.select('id').where({ function_name: 'json-to-mqtt' })) {
    knex.insert({
      id: generateRandomId(6),
      type: 'standard',
      input_type: 'any',
      output_type: 'mqtt',
      function_name: 'json-to-mqtt'
    });
  }
  if (!knex.select('id').where({ function_name: 'json-to-time-values' })) {
    knex.insert({
      id: generateRandomId(6),
      type: 'standard',
      input_type: 'any',
      output_type: 'time-values',
      function_name: 'json-to-time-values'
    });
  }
  if (!knex.select('id').where({ function_name: 'time-values-to-csv' })) {
    knex.insert({
      id: generateRandomId(6),
      type: 'standard',
      input_type: 'time-values',
      output_type: 'any',
      function_name: 'time-values-to-csv'
    });
  }
  if (!knex.select('id').where({ function_name: 'time-values-to-json' })) {
    knex.insert({
      id: generateRandomId(6),
      type: 'standard',
      input_type: 'time-values',
      output_type: 'any',
      function_name: 'time-values-to-json'
    });
  }
  if (!knex.select('id').where({ function_name: 'time-values-to-modbus' })) {
    knex.insert({
      id: generateRandomId(6),
      type: 'standard',
      input_type: 'time-values',
      output_type: 'modbus',
      function_name: 'time-values-to-modbus'
    });
  }
  if (!knex.select('id').where({ function_name: 'time-values-to-mqtt' })) {
    knex.insert({
      id: generateRandomId(6),
      type: 'standard',
      input_type: 'time-values',
      output_type: 'mqtt',
      function_name: 'time-values-to-mqtt'
    });
  }
  if (!knex.select('id').where({ function_name: 'time-values-to-oianalytics' })) {
    knex.insert({
      id: generateRandomId(6),
      type: 'standard',
      input_type: 'time-values',
      output_type: 'oianalytics',
      function_name: 'time-values-to-oianalytics'
    });
  }
  if (!knex.select('id').where({ function_name: 'time-values-to-opcua' })) {
    knex.insert({
      id: generateRandomId(6),
      type: 'standard',
      input_type: 'time-values',
      output_type: 'opcua',
      function_name: 'time-values-to-opcua'
    });
  }
  if (!knex.select('id').where({ function_name: 'setpoint-to-modbus' })) {
    knex.insert({
      id: generateRandomId(6),
      type: 'standard',
      input_type: 'setpoint',
      output_type: 'modbus',
      function_name: 'setpoint-to-modbus'
    });
  }
  if (!knex.select('id').where({ function_name: 'setpoint-to-mqtt' })) {
    knex.insert({
      id: generateRandomId(6),
      type: 'standard',
      input_type: 'setpoint',
      output_type: 'mqtt',
      function_name: 'setpoint-to-mqtt'
    });
  }
  if (!knex.select('id').where({ function_name: 'setpoint-to-opcua' })) {
    knex.insert({
      id: generateRandomId(6),
      type: 'standard',
      input_type: 'setpoint',
      output_type: 'opcua',
      function_name: 'setpoint-to-opcua'
    });
  }
}

async function migrateSubscriptionsToTransformers(knex: Knex): Promise<void> {
  const subscriptions: Array<{
    north_connector_id: string;
    south_connector_id: string;
  }> = await knex(SUBSCRIPTION_TABLE).select('north_connector_id', 'south_connector_id');

  const northConnectors: Array<{
    id: string;
    type: string;
  }> = await knex(NORTH_CONNECTORS_TABLE).select('id', 'type');

  const transformers: Array<{
    id: string;
    type: string;
    input_type: string;
    output_type: string;
    function_name: string;
  }> = await knex(TRANSFORMERS_TABLE).select('id', 'type', 'input_type', 'output_type', 'function_name');

  const northTransformers: Array<{
    north_id: string;
    transformer_id: string;
    options: string;
    input_type: string;
  }> = await knex(NORTH_TRANSFORMERS_TABLE).select('north_id', 'transformer_id', 'options', 'input_type');

  const southConnectors: Array<{
    id: string;
    type: string;
  }> = await knex(SOUTH_CONNECTORS_TABLE).select('id', 'type');

  await knex.schema.alterTable(NORTH_TRANSFORMERS_TABLE, table => {
    table.uuid('id');
    table.string('south_id').nullable().references('id').inTable(SOUTH_CONNECTORS_TABLE).onDelete('SET NULL');
  });
  const northRows = await knex(NORTH_TRANSFORMERS_TABLE).select(knex.raw('rowid as rid'));
  // Update rows one by one (or use Promise.all for parallel batches)
  for (const row of northRows) {
    await knex(NORTH_TRANSFORMERS_TABLE)
      .where('rowid', row.rid)
      .update({ id: generateRandomId(6) });
  }
  await knex.schema.alterTable(NORTH_TRANSFORMERS_TABLE, table => {
    table.uuid('id').notNullable().primary().alter();
  });

  await knex.schema.alterTable(HISTORY_QUERY_TRANSFORMERS_TABLE, table => {
    table.uuid('id');
  });
  const historyRows = await knex(HISTORY_QUERY_TRANSFORMERS_TABLE).select(knex.raw('rowid as rid'));
  // Update rows one by one (or use Promise.all for parallel batches)
  for (const row of historyRows) {
    await knex(HISTORY_QUERY_TRANSFORMERS_TABLE)
      .where('rowid', row.rid)
      .update({ id: generateRandomId(6) });
  }
  await knex.schema.alterTable(HISTORY_QUERY_TRANSFORMERS_TABLE, table => {
    table.uuid('id').notNullable().primary().alter();
  });

  // const ignoreTransformer = transformers.find(transformer => transformer.function_name === 'ignore')!;
  const isoTransformer = transformers.find(transformer => transformer.function_name === 'iso')!;
  for (const subscription of subscriptions) {
    const north = northConnectors.find(connector => connector.id === subscription.north_connector_id);
    const south = southConnectors.find(connector => connector.id === subscription.south_connector_id);
    if (south && north) {
      const inputType = ['ads', 'modbus', 'mqtt', 'oianalytics', 'opc', 'opcua', 'osisoft-pi'].includes(south.type) ? 'time-values' : 'any';
      const transformer = northTransformers.find(transformer => transformer.north_id === north.id && transformer.input_type === inputType);
      // In this case, the north is subscribed to the south. We need to check if there is already transformers depending on the connector type
      if (!transformer) {
        // The north is subscribed so we need to create a transformer for this specific case ("iso" standard transformer)
        await knex(NORTH_TRANSFORMERS_TABLE).insert({
          id: generateRandomId(6),
          north_id: north.id,
          south_id: south.id,
          transformer_id: isoTransformer.id
        });
      } else {
        await knex(NORTH_TRANSFORMERS_TABLE)
          .delete()
          .where({ north_id: north.id, south_id: '', transformer_id: isoTransformer.id, input_type: inputType });
        await knex(NORTH_TRANSFORMERS_TABLE).insert({
          id: generateRandomId(6),
          north_id: north.id,
          south_id: south.id,
          transformer_id: transformer.transformer_id,
          options: transformer.options,
          input_type: inputType
        });
      }
    }
  }

  await knex.schema.dropTableIfExists(SUBSCRIPTION_TABLE);
}

async function addTransformersItems(knex: Knex): Promise<void> {
  await knex.schema.createTable(NORTH_TRANSFORMERS_ITEMS_TABLE, table => {
    table.uuid('id').references('id').inTable(NORTH_TRANSFORMERS_TABLE);
    table.string('item_id').references('id').inTable(SOUTH_ITEMS_TABLE);
    table.unique(['id', 'item_id']);
  });

  await knex.schema.createTable(HISTORY_QUERY_TRANSFORMERS_ITEMS_TABLE, table => {
    table.uuid('id').references('id').inTable(HISTORY_QUERY_TRANSFORMERS_TABLE);
    table.string('item_id').references('id').inTable(HISTORY_ITEMS_TABLE);
    table.unique(['id', 'item_id']);
  });
}

export async function down(_knex: Knex): Promise<void> {
  return;
}
