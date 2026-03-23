import { Knex } from 'knex';
import { generateRandomId } from '../../service/utils';
import { Timezone } from '../../../shared/model/types';
import { CustomTransformer } from '../../model/transformer.model';

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
const SCAN_MODES_TABLE = 'scan_modes';
const IP_FILTERS_TABLE = 'ip_filters';
const CERTIFICATES_TABLE = 'certificates';
const USERS_TABLE = 'users';
const GROUP_ITEMS_TABLE = 'group_items';
const SOUTH_ITEM_GROUPS_TABLE = 'south_item_groups';

// Connector types that support historian capabilities
const HISTORIAN_CONNECTOR_TYPES = [
  'mssql',
  'mysql',
  'postgresql',
  'sqlite',
  'oracle',
  'odbc',
  'oledb',
  'opcua',
  'opc',
  'osisoft-pi',
  'rest',
  'oianalytics'
];

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

interface OldSouthFileItemSettings {
  remoteFolder: string;
  regex: string;
  minAge: number;
  preserveFiles: boolean;
  ignoreModifiedDate?: boolean;
}

interface NewSouthFileItemSettings {
  remoteFolder: string;
  regex: string;
  minAge: number;
  preserveFiles: boolean;
  ignoreModifiedDate?: boolean;
  maxFiles: number;
  maxSize: number;
  recursive: boolean;
}

interface OldSouthMQTTItemSettings {
  topic: string;
  valueType: 'number' | 'string' | 'json';
  jsonPayload?: {
    useArray: boolean;
    dataArrayPath?: string;
    valuePath: string;
    pointIdOrigin: 'oibus' | 'payload';
    pointIdPath?: string;
    timestampOrigin: 'oibus' | 'payload';
    timestampPayload?: {
      timestampPath: string;
      timestampType: 'string' | 'iso-string' | 'unix-epoch' | 'unix-epoch-ms';
      timestampFormat?: string;
      timezone?: Timezone;
    } | null;
    otherFields: Array<{
      name: string;
      path: string;
    }> | null;
  } | null;
}

interface NewSouthMQTTItemSettings {
  topic: string;
}

export async function up(knex: Knex): Promise<void> {
  await updateRegistrationSettings(knex);
  await updateTransformersTable(knex);
  await updateNorthRestConnectors(knex);
  await createDefaultTransformers(knex);
  const allOldSubscriptions: Array<{
    north_connector_id: string;
    south_connector_id: string;
  }> = await knex(SUBSCRIPTION_TABLE).select('north_connector_id', 'south_connector_id');
  await migrateSubscriptionsToTransformers(knex);
  await addTransformersItems(knex);
  await updateFileConnectorItems(knex);
  await migrateSouthMQTTItems(knex, allOldSubscriptions);
  await addCreatedByAndUpdatedBy(knex);
  await createSouthItemGroupsTable(knex);
  await createGroupItemsTable(knex);
  await addItemHistorianFields(knex);
  await populateItemHistorianFields(knex);
  await removeThrottlingFieldsInConnectorSettings(knex);
}

async function addCreatedByAndUpdatedBy(knex: Knex): Promise<void> {
  const user: {
    id: string;
    type: string;
  } = await knex(USERS_TABLE).select('id', 'login').where('login', 'admin').first();
  for (const table of [
    SOUTH_CONNECTORS_TABLE,
    SOUTH_ITEMS_TABLE,
    NORTH_CONNECTORS_TABLE,
    HISTORY_QUERIES_TABLE,
    HISTORY_ITEMS_TABLE,
    TRANSFORMERS_TABLE,
    SCAN_MODES_TABLE,
    IP_FILTERS_TABLE,
    CERTIFICATES_TABLE
  ]) {
    await knex.schema.alterTable(table, t => {
      t.string('created_by').nullable();
      t.string('updated_by').nullable();
    });
    if (user) {
      await knex(table).update({ created_by: user.id, updated_by: user.id });
    }
  }
}

async function updateRegistrationSettings(knex: Knex): Promise<void> {
  await knex.schema.alterTable(REGISTRATIONS_TABLE, table => {
    table.boolean('command_search_history_cache_content');
    table.boolean('command_get_history_cache_file_content');
    table.boolean('command_update_history_cache_content');
    table.boolean('command_search_north_cache_content');
    table.boolean('command_get_north_cache_file_content');
    table.boolean('command_update_north_cache_content');
  });
  await knex(REGISTRATIONS_TABLE).update({
    command_search_history_cache_content: true,
    command_get_history_cache_file_content: true,
    command_update_history_cache_content: true,
    command_search_north_cache_content: true,
    command_get_north_cache_file_content: true,
    command_update_north_cache_content: true
  });
}

async function updateTransformersTable(knex: Knex): Promise<void> {
  await knex.schema.alterTable(TRANSFORMERS_TABLE, table => {
    table.string('language');
    table.integer('timeout');
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
  if (!knex(TRANSFORMERS_TABLE).select('id').where({ function_name: 'csv-to-mqtt' })) {
    knex(TRANSFORMERS_TABLE).insert({
      id: generateRandomId(6),
      type: 'standard',
      input_type: 'any',
      output_type: 'mqtt',
      function_name: 'csv-to-mqtt'
    });
  }
  if (!knex(TRANSFORMERS_TABLE).select('id').where({ function_name: 'csv-to-time-values' })) {
    knex(TRANSFORMERS_TABLE).insert({
      id: generateRandomId(6),
      type: 'standard',
      input_type: 'any',
      output_type: 'time-values',
      function_name: 'csv-to-time-values'
    });
  }
  if (!knex(TRANSFORMERS_TABLE).select('id').where({ function_name: 'ignore' })) {
    knex(TRANSFORMERS_TABLE).insert({
      id: generateRandomId(6),
      type: 'standard',
      input_type: 'any',
      output_type: 'any',
      function_name: 'ignore'
    });
  }
  if (!knex(TRANSFORMERS_TABLE).select('id').where({ function_name: 'iso' })) {
    knex(TRANSFORMERS_TABLE).insert({
      id: generateRandomId(6),
      type: 'standard',
      input_type: 'any',
      output_type: 'any',
      function_name: 'iso'
    });
  }
  if (!knex(TRANSFORMERS_TABLE).select('id').where({ function_name: 'json-to-csv' })) {
    knex(TRANSFORMERS_TABLE).insert({
      id: generateRandomId(6),
      type: 'standard',
      input_type: 'any',
      output_type: 'any',
      function_name: 'json-to-csv'
    });
  }
  if (!knex(TRANSFORMERS_TABLE).select('id').where({ function_name: 'time-values-to-csv' })) {
    knex(TRANSFORMERS_TABLE).insert({
      id: generateRandomId(6),
      type: 'standard',
      input_type: 'time-values',
      output_type: 'any',
      function_name: 'time-values-to-csv'
    });
  }
  if (!knex(TRANSFORMERS_TABLE).select('id').where({ function_name: 'time-values-to-json' })) {
    knex(TRANSFORMERS_TABLE).insert({
      id: generateRandomId(6),
      type: 'standard',
      input_type: 'time-values',
      output_type: 'any',
      function_name: 'time-values-to-json'
    });
  }
  if (!knex(TRANSFORMERS_TABLE).select('id').where({ function_name: 'time-values-to-modbus' })) {
    knex(TRANSFORMERS_TABLE).insert({
      id: generateRandomId(6),
      type: 'standard',
      input_type: 'time-values',
      output_type: 'modbus',
      function_name: 'time-values-to-modbus'
    });
  }
  if (!knex(TRANSFORMERS_TABLE).select('id').where({ function_name: 'time-values-to-mqtt' })) {
    knex(TRANSFORMERS_TABLE).insert({
      id: generateRandomId(6),
      type: 'standard',
      input_type: 'time-values',
      output_type: 'mqtt',
      function_name: 'time-values-to-mqtt'
    });
  }
  if (!knex(TRANSFORMERS_TABLE).select('id').where({ function_name: 'time-values-to-oianalytics' })) {
    knex(TRANSFORMERS_TABLE).insert({
      id: generateRandomId(6),
      type: 'standard',
      input_type: 'time-values',
      output_type: 'oianalytics',
      function_name: 'time-values-to-oianalytics'
    });
  }
  if (!knex(TRANSFORMERS_TABLE).select('id').where({ function_name: 'time-values-to-opcua' })) {
    knex(TRANSFORMERS_TABLE).insert({
      id: generateRandomId(6),
      type: 'standard',
      input_type: 'time-values',
      output_type: 'opcua',
      function_name: 'time-values-to-opcua'
    });
  }
  if (!knex(TRANSFORMERS_TABLE).select('id').where({ function_name: 'setpoint-to-modbus' })) {
    knex(TRANSFORMERS_TABLE).insert({
      id: generateRandomId(6),
      type: 'standard',
      input_type: 'setpoint',
      output_type: 'modbus',
      function_name: 'setpoint-to-modbus'
    });
  }
  if (!knex(TRANSFORMERS_TABLE).select('id').where({ function_name: 'setpoint-to-mqtt' })) {
    knex(TRANSFORMERS_TABLE).insert({
      id: generateRandomId(6),
      type: 'standard',
      input_type: 'setpoint',
      output_type: 'mqtt',
      function_name: 'setpoint-to-mqtt'
    });
  }
  if (!knex(TRANSFORMERS_TABLE).select('id').where({ function_name: 'setpoint-to-opcua' })) {
    knex(TRANSFORMERS_TABLE).insert({
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
  const northRows = (await knex(NORTH_TRANSFORMERS_TABLE).select(knex.raw('rowid as rid'))) as Array<{ rid: string }>;
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
  const historyRows = (await knex(HISTORY_QUERY_TRANSFORMERS_TABLE).select(knex.raw('rowid as rid'))) as Array<{ rid: string }>;
  // Update rows one by one (or use Promise.all for parallel batches)
  for (const row of historyRows) {
    await knex(HISTORY_QUERY_TRANSFORMERS_TABLE)
      .where('rowid', row.rid)
      .update({ id: generateRandomId(6) });
  }
  await knex.schema.alterTable(HISTORY_QUERY_TRANSFORMERS_TABLE, table => {
    table.uuid('id').notNullable().primary().alter();
  });

  await dropUniqueConstraints(knex);

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

async function updateFileConnectorItems(knex: Knex): Promise<void> {
  const oldSouth: Array<{
    id: string;
    type: string;
  }> = await knex(SOUTH_CONNECTORS_TABLE).select('id', 'type', 'settings').whereIn('type', ['folder-scanner', 'sftp', 'ftp']);
  for (const connector of oldSouth) {
    const oldItems: Array<{
      id: string;
      settings: string;
    }> = await knex(SOUTH_ITEMS_TABLE).select('id', 'settings').where('connector_id', connector.id);
    for (const item of oldItems) {
      const oldSettings = JSON.parse(item.settings) as OldSouthFileItemSettings;

      const newSettings: NewSouthFileItemSettings = {
        ...oldSettings,
        recursive: false,
        maxFiles: 0,
        maxSize: 0
      };
      await knex(SOUTH_ITEMS_TABLE)
        .update({ settings: JSON.stringify(newSettings) })
        .where('id', item.id);
    }
  }
}

async function migrateSouthMQTTItems(
  knex: Knex,
  oldSubscriptions: Array<{
    north_connector_id: string;
    south_connector_id: string;
  }>
): Promise<void> {
  // 1. Fetch North Connectors and South MQTT Connectors
  const allNorth: Array<{
    id: string;
    type: string;
  }> = await knex(NORTH_CONNECTORS_TABLE).select('id', 'type', 'settings');
  const oldSouth: Array<{
    id: string;
    type: string;
  }> = await knex(SOUTH_CONNECTORS_TABLE).select('id', 'type', 'settings').where('type', 'mqtt');
  if (oldSouth.length === 0) return;

  // 2. Create Custom Transformer
  const customTransformer = createCustomTransformer();
  await knex(TRANSFORMERS_TABLE).insert({
    id: customTransformer.id,
    type: customTransformer.type,
    name: customTransformer.name,
    input_type: customTransformer.inputType,
    output_type: customTransformer.outputType,
    description: customTransformer.description,
    custom_code: customTransformer.customCode,
    language: customTransformer.language,
    custom_manifest: JSON.stringify(customTransformer.customManifest)
  });

  // 3. Build a list of (North -> South) relationships
  const northToSouthMap = new Map<string, Set<string>>();
  // Explicit Subscriptions
  for (const sub of oldSubscriptions) {
    if (oldSouth.find(s => s.id === sub.south_connector_id)) {
      if (!northToSouthMap.has(sub.north_connector_id)) {
        northToSouthMap.set(sub.north_connector_id, new Set());
      }
      northToSouthMap.get(sub.north_connector_id)!.add(sub.south_connector_id);
    }
  }
  // Implicit Subscriptions (Norths with NO subscriptions digest ALL Souths)
  for (const north of allNorth) {
    if (!oldSubscriptions.find(s => s.north_connector_id === north.id)) {
      // This north subscribes to EVERYTHING
      const allSouthIds = new Set(oldSouth.map(s => s.id));
      northToSouthMap.set(north.id, allSouthIds);
    }
  }

  // 4. Iterate and Create Transformers
  for (const [northId, southIds] of northToSouthMap) {
    // For each South connected to this North
    for (const southId of southIds) {
      // Get groups of items with identical settings WITHIN this specific South
      const itemGroups = await retrieveItemsWithSameSettings(knex, southId);

      for (const group of itemGroups) {
        // Create a new North Transformer Instance for this group
        const northTransformerInstanceId = generateRandomId(6);

        const migratedSettings: OldSouthMQTTItemSettings = JSON.parse(JSON.stringify(group.settings));
        if (migratedSettings.jsonPayload) {
          const jp = migratedSettings.jsonPayload;

          if (jp.dataArrayPath) jp.dataArrayPath = convertObjectPathToJsonPath(jp.dataArrayPath);
          if (jp.valuePath) jp.valuePath = convertObjectPathToJsonPath(jp.valuePath)!;
          if (jp.pointIdPath) jp.pointIdPath = convertObjectPathToJsonPath(jp.pointIdPath);

          if (jp.timestampPayload?.timestampPath) {
            jp.timestampPayload.timestampPath = convertObjectPathToJsonPath(jp.timestampPayload.timestampPath)!;
          }

          if (Array.isArray(jp.otherFields)) {
            jp.otherFields = jp.otherFields.map(f => ({
              ...f,
              path: convertObjectPathToJsonPath(f.path)!
            }));
          }
        }

        // A. Insert into north_transformers
        await knex(NORTH_TRANSFORMERS_TABLE).insert({
          id: northTransformerInstanceId,
          north_id: northId,
          south_id: southId,
          transformer_id: customTransformer.id,
          input_type: customTransformer.inputType,
          options: JSON.stringify(group.settings) // Old settings become options
        });

        // B. Insert into north_transformers_items (Link items to the transformer instance)
        const itemLinks = Array.from(group.itemIds).map(itemId => ({
          id: northTransformerInstanceId, // This column links back to north_transformers.id
          item_id: itemId
        }));

        if (itemLinks.length > 0) {
          await knex(NORTH_TRANSFORMERS_ITEMS_TABLE).insert(itemLinks);
        }
      }
    }
  }

  // 5. Clean up South Items (remove settings that were moved to the transformer)
  for (const connector of oldSouth) {
    const oldItems: Array<{
      id: string;
      settings: string;
    }> = await knex(SOUTH_ITEMS_TABLE).select('id', 'settings').where('connector_id', connector.id);
    for (const item of oldItems) {
      const oldSettings = JSON.parse(item.settings) as OldSouthMQTTItemSettings;

      const newSettings: NewSouthMQTTItemSettings = {
        topic: oldSettings.topic
      };
      await knex(SOUTH_ITEMS_TABLE)
        .update({ settings: JSON.stringify(newSettings) })
        .where('id', item.id);
    }
  }
}

/**
 * Helper to drop unique constraints in SQLite by recreating the tables.
 * SQLite cannot drop constraints defined in CREATE TABLE without table recreation.
 */
async function dropUniqueConstraints(knex: Knex): Promise<void> {
  const northTempName = `${NORTH_TRANSFORMERS_TABLE}_old`;
  if (await knex.schema.hasTable(NORTH_TRANSFORMERS_TABLE)) {
    // A. Rename existing
    await knex.schema.renameTable(NORTH_TRANSFORMERS_TABLE, northTempName);

    // B. Recreate without UNIQUE constraint
    await knex.schema.createTable(NORTH_TRANSFORMERS_TABLE, table => {
      table.uuid('id').primary().notNullable();
      table.uuid('north_id').notNullable().references('id').inTable(NORTH_CONNECTORS_TABLE).onDelete('CASCADE');
      table.uuid('transformer_id').notNullable().references('id').inTable(TRANSFORMERS_TABLE).onDelete('CASCADE');
      table.string('south_id');
      table.string('input_type');
      table.string('options');
    });

    // C. Copy Data
    await knex.raw(`
      INSERT INTO ${NORTH_TRANSFORMERS_TABLE} (id, north_id, transformer_id, south_id, input_type, options)
      SELECT id, north_id, transformer_id, south_id, input_type, options
      FROM ${northTempName}
    `);

    // D. Drop Temp
    await knex.schema.dropTable(northTempName);
  }

  const historyTempName = `${HISTORY_QUERY_TRANSFORMERS_TABLE}_old`;
  if (await knex.schema.hasTable(HISTORY_QUERY_TRANSFORMERS_TABLE)) {
    // A. Rename existing
    await knex.schema.renameTable(HISTORY_QUERY_TRANSFORMERS_TABLE, historyTempName);

    // B. Recreate without UNIQUE constraint
    await knex.schema.createTable(HISTORY_QUERY_TRANSFORMERS_TABLE, table => {
      table.uuid('id').primary().notNullable();
      table.uuid('history_id').notNullable().references('id').inTable('history_queries').onDelete('CASCADE');
      table.uuid('transformer_id').notNullable().references('id').inTable(TRANSFORMERS_TABLE).onDelete('CASCADE');
      table.string('input_type');
      table.string('options');
    });

    // C. Copy Data
    await knex.raw(`
      INSERT INTO ${HISTORY_QUERY_TRANSFORMERS_TABLE} (id, history_id, transformer_id, input_type, options)
      SELECT id, history_id, transformer_id, input_type, options
      FROM ${historyTempName}
    `);

    // D. Drop Temp
    await knex.schema.dropTable(historyTempName);
  }
}

async function createSouthItemGroupsTable(knex: Knex): Promise<void> {
  await knex.schema.raw(`CREATE TABLE ${SOUTH_ITEM_GROUPS_TABLE} (
    id char(36) PRIMARY KEY,
    created_at datetime DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    updated_at datetime DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    name varchar(255) NOT NULL,
    south_id char(36) NOT NULL,
    scan_mode_id char(36) NOT NULL,
    max_read_interval integer,
    read_delay integer,
    overlap integer,
    UNIQUE (name, south_id),
    FOREIGN KEY (south_id) REFERENCES ${SOUTH_CONNECTORS_TABLE}(id) ON DELETE CASCADE,
    FOREIGN KEY (scan_mode_id) REFERENCES ${SCAN_MODES_TABLE}(id)
  );`);
}

async function createGroupItemsTable(knex: Knex): Promise<void> {
  await knex.schema.createTable(GROUP_ITEMS_TABLE, table => {
    table.uuid('group_id').notNullable();
    table.foreign('group_id').references('id').inTable(SOUTH_ITEM_GROUPS_TABLE).onDelete('CASCADE');
    table.uuid('item_id').notNullable();
    table.foreign('item_id').references('id').inTable(SOUTH_ITEMS_TABLE).onDelete('CASCADE');
    table.primary(['group_id', 'item_id']);
  });
}

async function addItemHistorianFields(knex: Knex): Promise<void> {
  const hasMaxReadInterval = await knex.schema.hasColumn(SOUTH_ITEMS_TABLE, 'max_read_interval');
  const hasReadDelay = await knex.schema.hasColumn(SOUTH_ITEMS_TABLE, 'read_delay');
  const hasOverlap = await knex.schema.hasColumn(SOUTH_ITEMS_TABLE, 'overlap');
  const hasSyncWithGroup = await knex.schema.hasColumn(SOUTH_ITEMS_TABLE, 'sync_with_group');

  if (!hasMaxReadInterval) {
    await knex.schema.alterTable(SOUTH_ITEMS_TABLE, table => {
      table.integer('max_read_interval');
    });
  }

  if (!hasReadDelay) {
    await knex.schema.alterTable(SOUTH_ITEMS_TABLE, table => {
      table.integer('read_delay');
    });
  }

  if (!hasOverlap) {
    await knex.schema.alterTable(SOUTH_ITEMS_TABLE, table => {
      table.integer('overlap');
    });
  }

  if (!hasSyncWithGroup) {
    await knex.schema.alterTable(SOUTH_ITEMS_TABLE, table => {
      table.integer('sync_with_group').notNullable().defaultTo(0);
    });
  }
}

async function populateItemHistorianFields(knex: Knex): Promise<void> {
  // Get all items with their connector information
  const items = await knex
    .select('si.id as item_id', 'sc.type as connector_type', 'sc.settings as connector_settings')
    .from(`${SOUTH_ITEMS_TABLE} as si`)
    .join(`${SOUTH_CONNECTORS_TABLE} as sc`, 'si.connector_id', 'sc.id');

  for (const item of items) {
    const isHistorian = HISTORIAN_CONNECTOR_TYPES.includes(item.connector_type);

    let maxReadInterval = null;
    let readDelay = null;
    let overlap = null;

    // Only populate historian fields for items NOT in a group
    if (isHistorian) {
      try {
        const settings = JSON.parse(item.connector_settings);

        if (settings.throttling) {
          maxReadInterval = settings.throttling.maxReadInterval;
          readDelay = settings.throttling.readDelay;
          overlap = settings.throttling.overlap;
        }
      } catch (error) {
        // If parsing fails, use default values
        console.warn(`Failed to parse settings for item ${item.item_id}:`, error);
      }
    }

    // Items in groups get NULL values to inherit from group and sync_with_group = 1
    await knex(SOUTH_ITEMS_TABLE).where('id', item.item_id).update({
      max_read_interval: maxReadInterval,
      read_delay: readDelay,
      overlap: overlap,
      sync_with_group: 0
    });
  }
}

async function removeThrottlingFieldsInConnectorSettings(knex: Knex): Promise<void> {
  const oldSouth: Array<{
    id: string;
    type: string;
    settings: string;
  }> = await knex(SOUTH_CONNECTORS_TABLE).select('id', 'type', 'settings');

  for (const south of oldSouth) {
    const isHistorian = HISTORIAN_CONNECTOR_TYPES.includes(south.type);
    if (isHistorian) {
      const newSettings = JSON.parse(south.settings);
      delete newSettings.throttling;
      if (south.type === 'opcua') {
        delete newSettings.sharedConnection;
      }
      await knex(SOUTH_CONNECTORS_TABLE)
        .update({ settings: JSON.stringify(newSettings) })
        .where('id', south.id);
    }
    if (['opc', 'pi', 'opcua', 'modbus', 'ads'].includes(south.type)) {
      await groupItems(knex, south.id);
    }
  }

  await knex.schema.alterTable(HISTORY_QUERIES_TABLE, table => {
    table.integer('throttling_max_read_interval');
    table.integer('throttling_read_delay');
  });

  const oldHistoryQueries: Array<{
    id: string;
    south_type: string;
    south_settings: string;
  }> = await knex(HISTORY_QUERIES_TABLE).select('id', 'south_type', 'south_settings');

  for (const historyQuery of oldHistoryQueries) {
    const newSettings = JSON.parse(historyQuery.south_settings);
    const throttling = {
      maxReadInterval: newSettings.throttling.maxReadInterval,
      readDelay: newSettings.throttling.readDelay
    };
    delete newSettings.throttling;
    await knex(HISTORY_QUERIES_TABLE)
      .update({
        south_settings: JSON.stringify(newSettings),
        throttling_max_read_interval: throttling.maxReadInterval,
        throttling_read_delay: throttling.readDelay
      })
      .where('id', historyQuery.id);
  }
}

async function groupItems(knex: Knex, id: string): Promise<void> {
  await knex.transaction(async trx => {
    const items: Array<{
      item_id: string;
      connector_id: string;
      connector_name: string;
      connector_type: string;
      scan_mode_id: string;
      max_read_interval: string;
      read_delay: string;
      overlap: string;
      sync_with_group: string;
    }> = await trx
      .select(
        'si.id as item_id',
        'sc.id as connector_id',
        'sc.name as connector_name',
        'sc.type as connector_type',
        'si.scan_mode_id as scan_mode_id',
        'si.max_read_interval as max_read_interval',
        'si.read_delay as read_delay',
        'si.overlap as overlap',
        'si.sync_with_group as sync_with_group'
      )
      .from(`${SOUTH_ITEMS_TABLE} as si`)
      .join(`${SOUTH_CONNECTORS_TABLE} as sc`, 'si.connector_id', 'sc.id')
      .where('connector_id', id);

    // 1. Group the items into a dictionary object using a composite key
    const groupedMap = items.reduce(
      (acc, item) => {
        // Create a unique key combining the 5 fields
        const key = `${item.scan_mode_id}_${item.max_read_interval}_${item.read_delay}_${item.overlap}_${item.sync_with_group}`;

        if (!acc[key]) {
          acc[key] = [];
        }

        acc[key].push(item);
        return acc;
      },
      {} as Record<string, typeof items>
    );

    // 2. Extract the grouped arrays if you just want an array of groups
    const groupedItemsArray = Object.values(groupedMap);

    let groupIndex = 1;
    for (const group of groupedItemsArray) {
      const groupId = generateRandomId(6);
      const baseName = group[0].connector_name;

      const groupName = groupedItemsArray.length > 1 ? `${baseName} ${groupIndex}` : baseName;
      groupIndex++;
      await trx(SOUTH_ITEM_GROUPS_TABLE).insert({
        id: groupId,
        name: groupName,
        south_id: group[0].connector_id,
        scan_mode_id: group[0].scan_mode_id,
        max_read_interval: group[0].max_read_interval,
        read_delay: group[0].read_delay,
        overlap: group[0].overlap
      });

      const groupItemsToInsert = group.map(item => ({
        group_id: groupId,
        item_id: item.item_id
      }));
      const itemIdsToUpdate = group.map(item => item.item_id);

      // Bulk Insert mapping rows
      await trx(GROUP_ITEMS_TABLE).insert(groupItemsToInsert);

      // Bulk Update all associated items in a single query
      await trx(SOUTH_ITEMS_TABLE).update({ sync_with_group: true }).whereIn('id', itemIdsToUpdate);
    }
  });
}

export async function down(_knex: Knex): Promise<void> {
  return;
}

// One south can have different settings for topics, so it will create several entry and gather items with the same settings
async function retrieveItemsWithSameSettings(
  knex: Knex,
  southId: string
): Promise<Array<{ southId: string; itemIds: Set<string>; settings: OldSouthMQTTItemSettings }>> {
  // 1. Fetch items (ID and Settings) for the specific connector
  const items: Array<{
    id: string;
    settings: string;
  }> = await knex(SOUTH_ITEMS_TABLE).select('id', 'settings').where('connector_id', southId);

  // 2. Use a Map to group items by their unique configuration
  const groups = new Map<string, { southId: string; itemIds: Set<string>; settings: OldSouthMQTTItemSettings }>();
  for (const item of items) {
    const parsedSettings = JSON.parse(item.settings);
    if (parsedSettings.topic) {
      delete parsedSettings.topic;
    }
    if (parsedSettings.jsonPayload && parsedSettings.jsonPayload.otherFields) {
      delete parsedSettings.jsonPayload.otherFields;
    }

    // 3. Generate a deterministic key for comparison
    // We sort the object keys to ensure {a:1, b:2} produces the same key as {b:2, a:1}
    const stableKey = JSON.stringify(parsedSettings, Object.keys(parsedSettings).sort());

    if (!groups.has(stableKey)) {
      // Initialize the group if this setting configuration is seen for the first time
      groups.set(stableKey, {
        southId,
        itemIds: new Set<string>(), // Using Set ensures uniqueness of IDs
        settings: parsedSettings
      });
    }

    // 4. Add the current item's ID to the correct group
    groups.get(stableKey)!.itemIds.add(item.id);
  }

  // 5. Convert Map values to Array
  return Array.from(groups.values());
}

function createCustomTransformer(): CustomTransformer {
  const customCode = /* typescript */ `
import { DateTime } from 'luxon';
import { JSONPath } from 'jsonpath-plus';

// --- Entry Point ---------------------------------------------------------- //

export default async (content: string, options: any, source: any, filename: string): Promise<{ data: any; filename?: string; numberOfElements?: number }> => {
  const list = JSON.parse(content);
  let timeValues: any[] = [];
  for (const element of list) {
    const { timestamp, message, item } = element;

    // Note: Migration places settings inside 'options'
    const settings = options || {};

    // -- Scenario A: Simple Types (Number / String) --
    if (settings.valueType !== 'json') {
      timeValues.push({
        pointId: item.name,
        timestamp,
        data: { value: message }
      });
      continue;
    }

    // -- Scenario B: JSON Payload --
    let payload: any;
    try {
      payload = JSON.parse(message);
    } catch (e) {
      throw new Error(\`Failed to parse JSON on topic "\${item.topic}": \${e.message}\`);
    }

    const jsonConfig = settings.jsonPayload || {};

    // 1. Normalize to Array
    if (jsonConfig.useArray && jsonConfig.dataArrayPath) {
      const safeArrayPath = jsonConfig.dataArrayPath.startsWith('$') ? jsonConfig.dataArrayPath : (jsonConfig.dataArrayPath.startsWith('[') ? \`$\${jsonConfig.dataArrayPath}\` : \`$.\${jsonConfig.dataArrayPath}\`);
      const extractedArray = JSONPath({ json: payload, path: safeArrayPath });

      // JSONPath returns an array of matches. If targeting an array, it's often inside the first element.
      const actualArray = extractedArray && Array.isArray(extractedArray[0]) ? extractedArray[0] : extractedArray;
      if (Array.isArray(actualArray)) {
        for(const element of actualArray) {
          timeValues.push(extractDataPoint(
            element,
            jsonConfig,
            { pointId: item.name, timestamp }
          ));
        }
      } else {
        throw new Error(\`Expected array at path "\${jsonConfig.dataArrayPath}" but found \${typeof actualArray}\`);
      }
    } else {
      timeValues.push(extractDataPoint(
        payload,
        jsonConfig,
        { pointId: item.name, timestamp }
      ));
    }
  }
  return { data: timeValues, numberOfElements: timeValues.length, filename };
};

// --- Utils ---------------------------------------------------------------- //

/**
 * Extract Single Data Point
 * Processes a single JSON object into an OIBusTimeValue
 */
const extractDataPoint = (
  data: any,
  config: any,
  defaults: { pointId: string; timestamp: string }
) => {
  // 1. Resolve Point ID
  let pointId = defaults.pointId;
  if (config.pointIdOrigin !== 'oibus' && config.pointIdPath) {
    const extractedId = jpGet(data, config.pointIdPath);
    if (extractedId && typeof extractedId === 'string') {
      pointId = extractedId;
    } else {
      console.warn(\`Point ID not found at "\${config.pointIdPath}". Using default "\${defaults.pointId}".\`);
    }
  }

  // 2. Resolve Timestamp
  let timestamp = defaults.timestamp;
  if (config.timestampOrigin !== 'oibus' && config.timestampPayload?.timestampPath) {
    const rawTime = jpGet(data, config.timestampPayload.timestampPath);
    try {
      const parsed = parseTime(rawTime, config.timestampPayload);
      if (parsed) timestamp = parsed;
      else console.warn(\`Timestamp at "\${config.timestampPayload.timestampPath}" could not be parsed. Using ingestion time.\`);
    } catch (e) {
      console.warn(\`Error parsing timestamp: \${e.message}. Using ingestion time.\`);
    }
  }

  // 3. Extract Main Value
  const values: Record<string, any> = {
    value: jpGet(data, config.valuePath)
  };

  return { pointId, timestamp, data: values };
};

/**
 * Robust Timestamp Parser
 * Converts various input formats (Epoch, ISO, Custom Format) to an ISO String
 */
const parseTime = (value: any, opts: any): string | null => {
  if (!value) return null;
  const { timestampType, timezone, timestampFormat, locale } = opts || {};

  try {
    switch (timestampType) {
      case 'unix-epoch':
        return DateTime.fromMillis(Number(value) * 1000).toUTC().toISO();

      case 'unix-epoch-ms':
        return DateTime.fromMillis(Number(value)).toUTC().toISO();

      case 'string':
        if (!timestampFormat || !timezone) throw new Error('Missing format or timezone config');
        return DateTime.fromFormat(String(value), timestampFormat, { zone: timezone, locale }).toUTC().toISO();

      case 'iso-string':
      default:
        // Default to ISO parsing, tolerant of standard strings
        const dt = DateTime.fromISO(String(value));
        return dt.isValid ? dt.toUTC().toISO() : null;
    }
  } catch (e) {
    throw new Error(\`Time parsing failed: \${e.message}\`);
  }
};

/**
 * Safe JSONPath Getter
 * Ensures the path starts with '$' and returns the first match
 */
const jpGet = (obj: any, path: string) => {
  if (!path) return undefined;
  // Ensure the path is a valid JSONPath expression
  const safePath = path.startsWith('$') ? path : (path.startsWith('[') ? \`$\${path}\` : \`$.\${path}\`);

  // Execute query using jsonpath-plus
  const result = JSONPath({ json: obj, path: safePath });
  return result && result.length > 0 ? result[0] : undefined;
};
`;

  return {
    id: generateRandomId(6),
    inputType: 'any-content',
    outputType: 'time-values',
    type: 'custom',
    name: 'mqtt-transformer',
    description: 'Custom transformer for MQTT payloads with support for complex JSON, custom timestamps, and Point IDs.',
    customCode: customCode,
    language: 'typescript',
    timeout: 2000,
    customManifest: {
      type: 'object',
      key: 'options',
      translationKey: 'configuration.oibus.manifest.transformers.options',
      attributes: [
        {
          type: 'string-select',
          key: 'valueType',
          translationKey: 'configuration.oibus.manifest.south.items.mqtt.value-type',
          defaultValue: 'number',
          selectableValues: ['number', 'string', 'json'],
          validators: [
            {
              type: 'REQUIRED',
              arguments: []
            }
          ],
          displayProperties: {
            row: 0,
            columns: 4,
            displayInViewMode: true
          }
        },
        {
          type: 'object',
          key: 'jsonPayload',
          translationKey: 'configuration.oibus.manifest.south.items.mqtt.json-payload.title',
          displayProperties: {
            visible: true,
            wrapInBox: true
          },
          enablingConditions: [
            {
              referralPathFromRoot: 'useArray',
              targetPathFromRoot: 'dataArrayPath',
              values: [true]
            },
            {
              referralPathFromRoot: 'pointIdOrigin',
              targetPathFromRoot: 'pointIdPath',
              values: ['payload']
            },
            {
              referralPathFromRoot: 'timestampOrigin',
              targetPathFromRoot: 'timestampPayload',
              values: ['payload']
            }
          ],
          validators: [],
          attributes: [
            {
              type: 'boolean',
              key: 'useArray',
              translationKey: 'configuration.oibus.manifest.south.items.mqtt.json-payload.use-array',
              defaultValue: false,
              validators: [
                {
                  type: 'REQUIRED',
                  arguments: []
                }
              ],
              displayProperties: {
                row: 0,
                columns: 4,
                displayInViewMode: false
              }
            },
            {
              type: 'string',
              key: 'dataArrayPath',
              translationKey: 'configuration.oibus.manifest.south.items.mqtt.json-payload.data-array-path',
              defaultValue: null,
              validators: [
                {
                  type: 'REQUIRED',
                  arguments: []
                }
              ],
              displayProperties: {
                row: 0,
                columns: 4,
                displayInViewMode: false
              }
            },
            {
              type: 'string',
              key: 'valuePath',
              translationKey: 'configuration.oibus.manifest.south.items.mqtt.json-payload.value-path',
              defaultValue: null,
              validators: [
                {
                  type: 'REQUIRED',
                  arguments: []
                }
              ],
              displayProperties: {
                row: 1,
                columns: 4,
                displayInViewMode: false
              }
            },
            {
              type: 'string-select',
              key: 'pointIdOrigin',
              translationKey: 'configuration.oibus.manifest.south.items.mqtt.json-payload.point-id-origin',
              defaultValue: 'oibus',
              selectableValues: ['oibus', 'payload'],
              validators: [
                {
                  type: 'REQUIRED',
                  arguments: []
                }
              ],
              displayProperties: {
                row: 2,
                columns: 4,
                displayInViewMode: false
              }
            },
            {
              type: 'string',
              key: 'pointIdPath',
              translationKey: 'configuration.oibus.manifest.south.items.mqtt.json-payload.point-id-path',
              defaultValue: null,
              validators: [
                {
                  type: 'REQUIRED',
                  arguments: []
                }
              ],
              displayProperties: {
                row: 2,
                columns: 4,
                displayInViewMode: false
              }
            },
            {
              type: 'string-select',
              key: 'timestampOrigin',
              translationKey: 'configuration.oibus.manifest.south.items.mqtt.json-payload.timestamp-origin',
              defaultValue: 'oibus',
              selectableValues: ['oibus', 'payload'],
              validators: [
                {
                  type: 'REQUIRED',
                  arguments: []
                }
              ],
              displayProperties: {
                row: 3,
                columns: 4,
                displayInViewMode: false
              }
            },
            {
              type: 'object',
              key: 'timestampPayload',
              translationKey: 'configuration.oibus.manifest.south.items.mqtt.json-payload.timestamp-payload.title',
              displayProperties: {
                visible: true,
                wrapInBox: false
              },
              enablingConditions: [
                {
                  referralPathFromRoot: 'timestampType',
                  targetPathFromRoot: 'timestampFormat',
                  values: ['string']
                },
                {
                  referralPathFromRoot: 'timestampType',
                  targetPathFromRoot: 'timezone',
                  values: ['string']
                }
              ],
              validators: [],
              attributes: [
                {
                  type: 'string',
                  key: 'timestampPath',
                  translationKey: 'configuration.oibus.manifest.south.items.mqtt.json-payload.timestamp-payload.timestamp-path',
                  defaultValue: null,
                  validators: [
                    {
                      type: 'REQUIRED',
                      arguments: []
                    }
                  ],
                  displayProperties: {
                    row: 0,
                    columns: 4,
                    displayInViewMode: false
                  }
                },
                {
                  type: 'string-select',
                  key: 'timestampType',
                  translationKey: 'configuration.oibus.manifest.south.items.mqtt.json-payload.timestamp-payload.timestamp-type',
                  defaultValue: 'string',
                  selectableValues: ['string', 'iso-string', 'unix-epoch', 'unix-epoch-ms'],
                  validators: [
                    {
                      type: 'REQUIRED',
                      arguments: []
                    }
                  ],
                  displayProperties: {
                    row: 0,
                    columns: 4,
                    displayInViewMode: false
                  }
                },
                {
                  type: 'string',
                  key: 'timestampFormat',
                  translationKey: 'configuration.oibus.manifest.south.items.mqtt.json-payload.timestamp-payload.timestamp-format',
                  defaultValue: 'yyyy-MM-dd HH:mm:ss.SSS',
                  validators: [
                    {
                      type: 'REQUIRED',
                      arguments: []
                    }
                  ],
                  displayProperties: {
                    row: 1,
                    columns: 4,
                    displayInViewMode: false
                  }
                },
                {
                  type: 'timezone',
                  key: 'timezone',
                  translationKey: 'configuration.oibus.manifest.south.items.mqtt.json-payload.timestamp-payload.timezone',
                  defaultValue: 'UTC',
                  validators: [
                    {
                      type: 'REQUIRED',
                      arguments: []
                    }
                  ],
                  displayProperties: {
                    row: 1,
                    columns: 4,
                    displayInViewMode: false
                  }
                }
              ]
            }
          ]
        }
      ],
      enablingConditions: [
        {
          referralPathFromRoot: 'valueType',
          targetPathFromRoot: 'jsonPayload',
          values: ['json']
        }
      ],
      validators: [],
      displayProperties: {
        visible: true,
        wrapInBox: false
      }
    }
  };
}

// Helper to migrate legacy object-path syntax to standard JSONPath syntax
function convertObjectPathToJsonPath(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('$')) return path; // Already a JSONPath string

  const parts = path.split('.');
  let jsonPath = '$';

  for (const part of parts) {
    // If the part is entirely numerical, convert to array bracket notation (e.g. .0. -> [0])
    if (/^\d+$/.test(part)) {
      jsonPath += `[${part}]`;
    } else {
      jsonPath += `.${part}`;
    }
  }

  return jsonPath;
}
