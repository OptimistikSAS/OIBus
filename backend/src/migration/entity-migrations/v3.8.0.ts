import { Knex } from 'knex';
import { generateRandomId } from '../../service/utils';
import { Timezone } from '../../../shared/model/types';
import { DateTime } from 'luxon';

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
const ENGINES_TABLE = 'engines';
const COMMANDS_TABLE = 'commands';
const MESSAGES_TABLE = 'oianalytics_messages';
const MIGRATION_HINTS_TABLE = '_migration_v380_file_connector_hints';

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

interface CustomTransformer {
  id: string;
  type: 'custom';
  inputType: 'any' | 'time-values' | 'setpoint' | 'any-content';
  outputType: 'any' | 'time-values' | 'opcua' | 'mqtt' | 'modbus' | 'oianalytics';
  name: string;
  description: string;
  customCode: string;
  language: 'javascript' | 'typescript';
  customManifest: unknown;
  timeout: number;
}

export async function up(knex: Knex): Promise<void> {
  await makeSouthItemScanModeIdNullable(knex);
  await createFileCacheMigrationHints(knex);
  await addCreatedByAndUpdatedBy(knex);
  await updateRegistrationSettings(knex);
  await updateOIACommandTable(knex);
  await updateTransformersTable(knex);
  await updateNorthRestConnectors(knex);
  await createDefaultTransformers(knex);
  const allOldSubscriptions: Array<{
    north_connector_id: string;
    south_connector_id: string;
  }> = await knex(SUBSCRIPTION_TABLE).select('north_connector_id', 'south_connector_id');
  await createSouthItemGroupsTable(knex);
  await migrateSubscriptionsToTransformers(knex);
  await createGroupItemsTable(knex);
  await addTransformersItems(knex);
  await updateFileConnectorItems(knex);
  await migrateSouthMQTTItems(knex, allOldSubscriptions);

  await addItemHistorianFields(knex);
  await populateItemHistorianFields(knex);
  await removeThrottlingFieldsInConnectorSettings(knex);
  await migrateCsvTransformerOptions(knex);
}

async function addCreatedByAndUpdatedBy(knex: Knex): Promise<void> {
  await knex.schema.alterTable(SCAN_MODES_TABLE, t => {
    t.datetime('created_at');
    t.datetime('updated_at');
  });
  const user = await knex(USERS_TABLE).select('id', 'login').where('login', 'admin').first();
  const now = DateTime.now().toUTC().toISO()!;
  const tables = [
    SOUTH_CONNECTORS_TABLE,
    SOUTH_ITEMS_TABLE,
    NORTH_CONNECTORS_TABLE,
    HISTORY_QUERIES_TABLE,
    HISTORY_ITEMS_TABLE,
    TRANSFORMERS_TABLE,
    SCAN_MODES_TABLE,
    IP_FILTERS_TABLE,
    CERTIFICATES_TABLE,
    ENGINES_TABLE,
    USERS_TABLE,
    REGISTRATIONS_TABLE,
    COMMANDS_TABLE,
    MESSAGES_TABLE
  ];
  for (const table of tables) {
    await knex.schema.alterTable(table, t => {
      t.string('created_by');
      t.string('updated_by');
    });
    // Merge 3 update queries into exactly 1 using COALESCE
    const updatePayload: Record<string, string | Knex.Raw> = {
      created_at: knex.raw('COALESCE(created_at, ?)', [now]),
      updated_at: knex.raw('COALESCE(updated_at, ?)', [now])
    };

    if (user) {
      updatePayload.created_by = user.id;
      updatePayload.updated_by = user.id;
    }

    await knex(table).update(updatePayload);
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
    table.boolean('command_create_custom_transformer');
    table.boolean('command_update_custom_transformer');
    table.boolean('command_delete_custom_transformer');
    table.boolean('command_test_custom_transformer');
  });
  await knex(REGISTRATIONS_TABLE).update({
    command_search_history_cache_content: true,
    command_get_history_cache_file_content: true,
    command_update_history_cache_content: true,
    command_search_north_cache_content: true,
    command_get_north_cache_file_content: true,
    command_update_north_cache_content: true,
    command_create_custom_transformer: true,
    command_update_custom_transformer: true,
    command_delete_custom_transformer: true,
    command_test_custom_transformer: true
  });
}

async function updateOIACommandTable(knex: Knex): Promise<void> {
  await knex.schema.alterTable(COMMANDS_TABLE, table => {
    table.string('transformer_id');
  });
}

async function updateTransformersTable(knex: Knex): Promise<void> {
  await knex.schema.alterTable(TRANSFORMERS_TABLE, table => {
    table.string('language');
    table.integer('timeout');
  });

  await knex(TRANSFORMERS_TABLE).update({ language: 'javascript' }).where('type', 'custom');
}

function convertNorthRestSettings(oldSettings: OldNorthRESTSettings): NewNorthRESTSettings {
  return {
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
}

async function updateNorthRestConnectors(knex: Knex): Promise<void> {
  const oldNorth: Array<{
    id: string;
    type: string;
    settings: string;
  }> = await knex(NORTH_CONNECTORS_TABLE).select('id', 'type', 'settings').where('type', 'rest');

  for (const connector of oldNorth) {
    const newSettings = convertNorthRestSettings(JSON.parse(connector.settings) as OldNorthRESTSettings);
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
    const newSettings = convertNorthRestSettings(JSON.parse(history.north_settings) as OldNorthRESTSettings);
    await knex(HISTORY_QUERIES_TABLE)
      .update({ north_settings: JSON.stringify(newSettings) })
      .where('id', history.id);
  }
}

async function createDefaultTransformers(knex: Knex): Promise<void> {
  const defaults = [
    { function_name: 'csv-to-mqtt', output_type: 'mqtt', input_type: 'any' },
    { function_name: 'csv-to-time-values', output_type: 'time-values', input_type: 'any' },
    { function_name: 'ignore', output_type: 'any', input_type: 'any' },
    { function_name: 'iso', output_type: 'any', input_type: 'any' },
    { function_name: 'json-to-csv', output_type: 'any', input_type: 'any' },
    { function_name: 'time-values-to-csv', output_type: 'any', input_type: 'time-values' },
    { function_name: 'time-values-to-json', output_type: 'any', input_type: 'time-values' },
    { function_name: 'time-values-to-modbus', output_type: 'modbus', input_type: 'time-values' },
    { function_name: 'time-values-to-mqtt', output_type: 'mqtt', input_type: 'time-values' },
    { function_name: 'time-values-to-oianalytics', output_type: 'oianalytics', input_type: 'time-values' },
    { function_name: 'time-values-to-opcua', output_type: 'opcua', input_type: 'time-values' },
    { function_name: 'setpoint-to-modbus', output_type: 'modbus', input_type: 'setpoint' },
    { function_name: 'setpoint-to-mqtt', output_type: 'mqtt', input_type: 'setpoint' },
    { function_name: 'setpoint-to-opcua', output_type: 'opcua', input_type: 'setpoint' }
  ];

  const existing = await knex(TRANSFORMERS_TABLE).select('function_name');
  const existingNames = new Set(existing.map(t => t.function_name));
  const now = DateTime.now().toUTC().toISO()!;
  const toInsert = defaults
    .filter(t => !existingNames.has(t.function_name))
    .map(t => ({
      id: generateRandomId(6),
      type: 'standard',
      created_by: 'system',
      updated_by: 'system',
      created_at: now,
      updated_at: now,
      ...t
    }));

  if (toInsert.length > 0) {
    await knex.batchInsert(TRANSFORMERS_TABLE, toInsert);
  }
}

async function migrateSubscriptionsToTransformers(knex: Knex): Promise<void> {
  await knex.transaction(async trx => {
    // 1. Fetch all old data into memory
    const subscriptions = await trx(SUBSCRIPTION_TABLE).select('*');
    const southConnectors = await trx(SOUTH_CONNECTORS_TABLE).select('id', 'type');
    const oldNorthTransformers = await trx(NORTH_TRANSFORMERS_TABLE).select('*');
    const oldHistoryTransformers = await trx(HISTORY_QUERY_TRANSFORMERS_TABLE).select('*');
    const isoTransformer = await trx(TRANSFORMERS_TABLE).where('function_name', 'iso').first();

    if (!isoTransformer) {
      throw new Error('ISO transformer not found in database.');
    }

    // 2. Map History Transformers (Simply generate new IDs for existing rows)
    const newHistoryTransformers = oldHistoryTransformers.map(ht => ({
      id: generateRandomId(6),
      history_id: ht.history_id,
      transformer_id: ht.transformer_id,
      options: ht.options
    }));

    // 3. Map North Transformers strictly based on Subscriptions
    const newNorthTransformers = [];
    for (const sub of subscriptions) {
      const south = southConnectors.find(c => c.id === sub.south_connector_id);
      if (!south) continue; // Ignore orphaned subscriptions

      // Determine the expected input type for this south connector
      const inputType = ['ads', 'modbus', 'mqtt', 'oianalytics', 'opc', 'opcua', 'osisoft-pi'].includes(south.type) ? 'time-values' : 'any';

      // Check if the north connector already had a specific transformation rule for this input type
      const existingConfig = oldNorthTransformers.find(t => t.north_id === sub.north_connector_id && t.input_type === inputType);

      // Create the new mapped row linking the North to the South source
      newNorthTransformers.push({
        id: generateRandomId(6),
        north_id: sub.north_connector_id,
        transformer_id: existingConfig ? existingConfig.transformer_id : isoTransformer.id,
        options: existingConfig ? existingConfig.options : null,
        source_type: 'south',
        source_api_data_source_id: null,
        source_south_south_id: south.id,
        source_south_group_id: null
      });
    }

    // 4. Drop the old tables (This instantly removes old schemas, data, and constraints safely)
    await trx.schema.dropTableIfExists(NORTH_TRANSFORMERS_TABLE);
    await trx.schema.dropTableIfExists(HISTORY_QUERY_TRANSFORMERS_TABLE);
    await trx.schema.dropTableIfExists(SUBSCRIPTION_TABLE);

    // 5. Recreate History Transformers table with the new schema
    await trx.schema.createTable(HISTORY_QUERY_TRANSFORMERS_TABLE, table => {
      table.uuid('id').primary().notNullable();
      table.uuid('history_id').notNullable().references('id').inTable('history_queries').onDelete('CASCADE');
      table.uuid('transformer_id').notNullable().references('id').inTable(TRANSFORMERS_TABLE).onDelete('CASCADE');
      table.string('options');
    });

    // 6. Recreate North Transformers table with the new schema (input_type is naturally gone)
    await trx.schema.createTable(NORTH_TRANSFORMERS_TABLE, table => {
      table.uuid('id').primary().notNullable();
      table.uuid('north_id').notNullable().references('id').inTable(NORTH_CONNECTORS_TABLE).onDelete('CASCADE');
      table.uuid('transformer_id').notNullable().references('id').inTable(TRANSFORMERS_TABLE).onDelete('CASCADE');
      table.string('source_type');
      table.string('source_api_data_source_id');
      table.string('source_south_south_id').nullable().references('id').inTable(SOUTH_CONNECTORS_TABLE).onDelete('SET NULL');
      table.string('source_south_group_id').nullable().references('id').inTable(SOUTH_ITEM_GROUPS_TABLE).onDelete('SET NULL');
      table.string('options');
    });

    // 7. Batch insert the clean, mapped data
    if (newHistoryTransformers.length > 0) {
      await trx.batchInsert(HISTORY_QUERY_TRANSFORMERS_TABLE, newHistoryTransformers, 100);
    }

    if (newNorthTransformers.length > 0) {
      await trx.batchInsert(NORTH_TRANSFORMERS_TABLE, newNorthTransformers, 100);
    }
  });
}

async function addTransformersItems(knex: Knex): Promise<void> {
  await knex.schema.createTable(NORTH_TRANSFORMERS_ITEMS_TABLE, table => {
    table.uuid('id').references('id').inTable(NORTH_TRANSFORMERS_TABLE);
    table.string('item_id').references('id').inTable(SOUTH_ITEMS_TABLE);
    table.string('group_id').nullable().references('id').inTable(SOUTH_ITEM_GROUPS_TABLE).onDelete('SET NULL');
    table.unique(['id', 'item_id', 'group_id']);
  });

  await knex.schema.createTable(HISTORY_QUERY_TRANSFORMERS_ITEMS_TABLE, table => {
    table.uuid('id').references('id').inTable(HISTORY_QUERY_TRANSFORMERS_TABLE);
    table.string('item_id').references('id').inTable(HISTORY_ITEMS_TABLE);
    table.unique(['id', 'item_id']);
  });
}

async function updateFileConnectorItems(knex: Knex): Promise<void> {
  await knex.transaction(async trx => {
    const oldSouth = await trx(SOUTH_CONNECTORS_TABLE).select('id').whereIn('type', ['folder-scanner', 'sftp', 'ftp']);

    if (oldSouth.length === 0) return;

    // Use whereIn instead of a nested loop
    const southIds = oldSouth.map(c => c.id);
    const oldItems = await trx(SOUTH_ITEMS_TABLE).select('id', 'settings').whereIn('connector_id', southIds);

    for (const item of oldItems) {
      const settings = JSON.parse(item.settings);
      settings.recursive = false;
      settings.maxFiles = 0;
      settings.maxSize = 0;

      await trx(SOUTH_ITEMS_TABLE)
        .where('id', item.id)
        .update({ settings: JSON.stringify(settings) });
    }
  });
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
    settings: string;
  }> = await knex(NORTH_CONNECTORS_TABLE).select('id', 'type', 'settings');
  const oldSouth: Array<{
    id: string;
    type: string;
    settings: string;
  }> = await knex(SOUTH_CONNECTORS_TABLE).select('id', 'type', 'settings').where('type', 'mqtt');
  if (oldSouth.length === 0) return;

  // 2. Create Custom Transformer
  const customTransformer = createCustomTransformer();
  const now = DateTime.now().toUTC().toISO()!;
  await knex(TRANSFORMERS_TABLE).insert({
    id: customTransformer.id,
    created_by: 'system',
    updated_by: 'system',
    created_at: now,
    updated_at: now,
    type: customTransformer.type,
    name: customTransformer.name,
    input_type: customTransformer.inputType,
    output_type: customTransformer.outputType,
    description: customTransformer.description,
    custom_code: customTransformer.customCode,
    language: customTransformer.language,
    timeout: 2000,
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
          source_type: 'south',
          source_south_south_id: southId,
          transformer_id: customTransformer.id,
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

async function createSouthItemGroupsTable(knex: Knex): Promise<void> {
  await knex.schema.createTable(SOUTH_ITEM_GROUPS_TABLE, table => {
    table.string('id', 36).primary();
    table.datetime('created_at').notNullable();
    table.datetime('updated_at').notNullable();
    table.string('created_by');
    table.string('updated_by');
    table.string('name').notNullable();
    table.string('south_id', 36).notNullable().references('id').inTable(SOUTH_CONNECTORS_TABLE).onDelete('CASCADE');
    table.string('scan_mode_id', 36).notNullable().references('id').inTable(SCAN_MODES_TABLE);
    table.integer('max_read_interval');
    table.integer('read_delay');
    table.integer('overlap');
    table.unique(['name', 'south_id']);
  });
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
  await knex.transaction(async trx => {
    // Get all items with their connector information
    const items = await trx
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

      // Non-historian items get NULL values; grouping and sync_with_group flag are set later in groupItems()
      await trx(SOUTH_ITEMS_TABLE).where('id', item.item_id).update({
        max_read_interval: maxReadInterval,
        read_delay: readDelay,
        overlap: overlap,
        sync_with_group: 0
      });
    }
  });
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
    if (historyQuery.south_type === 'opcua') {
      delete newSettings.sharedConnection;
    }
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
      const now = DateTime.now().toUTC().toISO()!;
      await trx(SOUTH_ITEM_GROUPS_TABLE).insert({
        id: groupId,
        name: groupName,
        south_id: group[0].connector_id,
        scan_mode_id: group[0].scan_mode_id,
        max_read_interval: group[0].max_read_interval,
        read_delay: group[0].read_delay,
        overlap: group[0].overlap,
        created_at: now,
        updated_at: now,
        updated_by: 'system',
        created_by: 'system'
      });

      const groupItemsToInsert = group.map(item => ({
        group_id: groupId,
        item_id: item.item_id
      }));
      const itemIdsToUpdate = group.map(item => item.item_id);

      // Bulk Insert mapping rows
      await trx(GROUP_ITEMS_TABLE).insert(groupItemsToInsert);

      // Bulk Update all associated items in a single query
      await trx(SOUTH_ITEMS_TABLE).update({ sync_with_group: 1 }).whereIn('id', itemIdsToUpdate);
    }
  });
}

async function makeSouthItemScanModeIdNullable(knex: Knex): Promise<void> {
  await knex.transaction(async trx => {
    await trx.raw('PRAGMA foreign_keys = OFF;');

    await trx.schema.raw(`CREATE TABLE ${SOUTH_ITEMS_TABLE}_dg_tmp (
      id char(36) PRIMARY KEY,
      created_at datetime DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      updated_at datetime DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      connector_id char(36) NOT NULL,
      scan_mode_id char(36),
      name varchar(255) NOT NULL,
      enabled boolean NOT NULL,
      settings json NOT NULL,
      FOREIGN KEY (connector_id) REFERENCES ${SOUTH_CONNECTORS_TABLE}(id),
      FOREIGN KEY (scan_mode_id) REFERENCES ${SCAN_MODES_TABLE}(id)
    );`);

    await trx.schema.raw(`INSERT INTO ${SOUTH_ITEMS_TABLE}_dg_tmp
      SELECT id, created_at, updated_at, connector_id, scan_mode_id, name, enabled, settings
      FROM ${SOUTH_ITEMS_TABLE};`);

    await trx.schema.raw(`DROP TABLE ${SOUTH_ITEMS_TABLE};`);

    await trx.schema.raw(`ALTER TABLE ${SOUTH_ITEMS_TABLE}_dg_tmp RENAME TO ${SOUTH_ITEMS_TABLE};`);

    await trx.schema.raw(`CREATE UNIQUE INDEX ${SOUTH_ITEMS_TABLE}_connector_id_name_unique ON ${SOUTH_ITEMS_TABLE} (connector_id, name);`);

    await trx.raw('PRAGMA foreign_keys = ON;');
  });
}

async function createFileCacheMigrationHints(knex: Knex): Promise<void> {
  // Snapshot file-connector item settings before any transformation for the cache migration to consume
  await knex.schema.createTable(MIGRATION_HINTS_TABLE, table => {
    table.string('connector_id').notNullable();
    table.string('item_id').notNullable();
    table.integer('preserve_files').notNullable();
    table.string('regex').notNullable();
  });

  const fileConnectors: Array<{ id: string }> = await knex(SOUTH_CONNECTORS_TABLE)
    .select('id')
    .whereIn('type', ['folder-scanner', 'sftp', 'ftp']);

  const hints: Array<{ connector_id: string; item_id: string; preserve_files: number; regex: string }> = [];
  for (const connector of fileConnectors) {
    const items: Array<{ id: string; settings: string }> = await knex(SOUTH_ITEMS_TABLE)
      .select('id', 'settings')
      .where('connector_id', connector.id);

    for (const item of items) {
      const itemSettings: { preserveFiles?: boolean; regex?: string } = JSON.parse(item.settings);
      hints.push({
        connector_id: connector.id,
        item_id: item.id,
        preserve_files: itemSettings.preserveFiles ? 1 : 0,
        regex: itemSettings.regex ?? '.*'
      });
    }
  }

  if (hints.length > 0) {
    await knex.batchInsert(MIGRATION_HINTS_TABLE, hints);
  }
}

async function migrateCsvTransformerOptions(knex: Knex): Promise<void> {
  const csvTransformers: Array<{ id: string; function_name: string }> = await knex(TRANSFORMERS_TABLE)
    .select('id', 'function_name')
    .whereIn('function_name', ['json-to-csv', 'time-values-to-csv']);

  if (csvTransformers.length === 0) return;

  // Lookup map: transformer id → function name, used to apply type-specific defaults.
  const transformerFunctionName = new Map(csvTransformers.map(t => [t.id, t.function_name]));
  const transformerIds = csvTransformers.map(t => t.id);

  const tables = [NORTH_TRANSFORMERS_TABLE, HISTORY_QUERY_TRANSFORMERS_TABLE];
  for (const table of tables) {
    const instances: Array<{ id: string; transformer_id: string; options: string | null }> = await knex(table)
      .select('id', 'transformer_id', 'options')
      .whereIn('transformer_id', transformerIds)
      .whereNotNull('options');

    for (const instance of instances) {
      const options = JSON.parse(instance.options!);

      // Generic CSV defaults (applied to both transformers)
      if (options.encoding === undefined) options.encoding = 'UTF_8';
      if (options.quoteChar === undefined) options.quoteChar = 'DOUBLE_QUOTE';
      if (options.escapeChar === undefined) options.escapeChar = 'DOUBLE_QUOTE';
      if (options.newline === undefined) options.newline = 'DEFAULT';
      if (options.header === undefined) options.header = true;

      const functionName = transformerFunctionName.get(instance.transformer_id);

      if (functionName === 'json-to-csv') {
        // Add fieldProcess: null to every field that does not have it yet
        if (Array.isArray(options.fields)) {
          options.fields = (options.fields as Array<Record<string, unknown>>).map(field => ({
            ...field,
            fieldProcess: field.fieldProcess !== undefined ? field.fieldProcess : null
          }));
        }
      } else if (functionName === 'time-values-to-csv') {
        if (options.pointIdProcess === undefined) options.pointIdProcess = null;
      }

      await knex(table)
        .where('id', instance.id)
        .update({ options: JSON.stringify(options) });
    }
  }
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
      translationKey: 'Options',
      attributes: [
        {
          type: 'string-select',
          key: 'valueType',
          translationKey: 'Value type',
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
          translationKey: 'JSON payload',
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
              translationKey: 'Payload in array?',
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
              translationKey: 'Array path',
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
              translationKey: 'Value path',
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
              translationKey: 'Point ID origin',
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
              translationKey: 'Point ID path',
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
              translationKey: 'Timestamp origin',
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
              translationKey: 'Timestamp',
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
                  translationKey: 'Timestamp path',
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
                  translationKey: 'Type',
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
                  translationKey: 'Timestamp format',
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
                  translationKey: 'Timezone',
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
