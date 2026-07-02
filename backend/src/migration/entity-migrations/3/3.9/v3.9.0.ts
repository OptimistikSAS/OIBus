import { Knex } from 'knex';

const ENGINES_TABLE = 'engines';
const SOUTH_CONNECTORS_TABLE = 'south_connectors';
const NORTH_CONNECTORS_TABLE = 'north_connectors';
const HISTORY_QUERIES_TABLE = 'history_queries';
const SOUTH_ITEM_GROUPS_TABLE = 'south_item_groups';
const SOUTH_ITEMS_TABLE = 'south_items';

// South connector types whose connectors support history queries (see each south's
// manifest.ts `modes.history`). start_time_offset / end_time_offset / recovery_strategy
// are only meaningful for items and groups belonging to these connectors.
const HISTORY_CAPABLE_SOUTH_TYPES = [
  'influxdb',
  'mssql',
  'mysql',
  'odbc',
  'oianalytics',
  'oledb',
  'opc',
  'opcua',
  'oracle',
  'osisoft-pi',
  'postgresql',
  'rest',
  'sqlite'
];

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(ENGINES_TABLE, t => {
    t.string('log_syslog_level');
    t.string('log_syslog_host');
    t.integer('log_syslog_port');
    t.string('log_syslog_protocol');
    t.string('forward_proxy_url').nullable();
    t.string('forward_proxy_username').nullable();
    t.string('forward_proxy_password').nullable();
    t.string('proxy_username').nullable();
    t.string('proxy_password').nullable();
  });
  await knex(ENGINES_TABLE).update({
    log_syslog_level: 'silent',
    log_syslog_host: '',
    log_syslog_port: 514,
    log_syslog_protocol: 'udp4'
  });

  await knex.schema.alterTable(SOUTH_ITEM_GROUPS_TABLE, t => {
    t.string('recovery_strategy').nullable();
    t.integer('start_time_offset').nullable();
    t.integer('end_time_offset').nullable();
  });
  await knex.schema.alterTable(SOUTH_ITEMS_TABLE, t => {
    t.string('recovery_strategy').nullable();
    t.integer('start_time_offset').nullable();
    t.integer('end_time_offset').nullable();
  });

  const historyCapableConnectorIds = knex(SOUTH_CONNECTORS_TABLE).select('id').whereIn('type', HISTORY_CAPABLE_SOUTH_TYPES);
  await knex(SOUTH_ITEM_GROUPS_TABLE)
    .whereIn('south_id', historyCapableConnectorIds)
    .update({ start_time_offset: 0, end_time_offset: 0, recovery_strategy: 'oldest' });
  await knex(SOUTH_ITEMS_TABLE)
    .whereIn('connector_id', historyCapableConnectorIds)
    .update({ start_time_offset: 0, end_time_offset: 0, recovery_strategy: 'oldest' });

  await knex.raw(`UPDATE ${SOUTH_ITEM_GROUPS_TABLE} SET start_time_offset = -overlap WHERE overlap IS NOT NULL`);
  await knex.raw(`UPDATE ${SOUTH_ITEMS_TABLE} SET start_time_offset = -overlap WHERE overlap IS NOT NULL`);

  await knex.schema.alterTable(SOUTH_ITEM_GROUPS_TABLE, t => {
    t.dropColumn('overlap');
  });
  await knex.schema.alterTable(SOUTH_ITEMS_TABLE, t => {
    t.dropColumn('overlap');
  });

  await addSmbAuthDefaults(knex);
}

// folder-scanner (south) and file-writer (north) settings gained optional SMB share
// authentication (username / password / domain) for network shares. Existing rows
// predate this and have none of these keys in their settings JSON; backfill them to
// null so the settings shape is consistent for every row of these types.
async function addSmbAuthDefaults(knex: Knex): Promise<void> {
  const withSmbDefaults = (settings: string): string => {
    const parsed = JSON.parse(settings) as Record<string, unknown>;
    return JSON.stringify({ username: null, password: null, domain: null, ...parsed });
  };

  const folderScannerConnectors: Array<{ id: string; settings: string }> = await knex(SOUTH_CONNECTORS_TABLE)
    .select('id', 'settings')
    .where('type', 'folder-scanner');
  for (const connector of folderScannerConnectors) {
    await knex(SOUTH_CONNECTORS_TABLE)
      .update({ settings: withSmbDefaults(connector.settings) })
      .where('id', connector.id);
  }

  const fileWriterConnectors: Array<{ id: string; settings: string }> = await knex(NORTH_CONNECTORS_TABLE)
    .select('id', 'settings')
    .where('type', 'file-writer');
  for (const connector of fileWriterConnectors) {
    await knex(NORTH_CONNECTORS_TABLE)
      .update({ settings: withSmbDefaults(connector.settings) })
      .where('id', connector.id);
  }

  const historyQueriesWithFolderScannerSouth: Array<{ id: string; south_settings: string }> = await knex(HISTORY_QUERIES_TABLE)
    .select('id', 'south_settings')
    .where('south_type', 'folder-scanner');
  for (const history of historyQueriesWithFolderScannerSouth) {
    await knex(HISTORY_QUERIES_TABLE)
      .update({ south_settings: withSmbDefaults(history.south_settings) })
      .where('id', history.id);
  }

  const historyQueriesWithFileWriterNorth: Array<{ id: string; north_settings: string }> = await knex(HISTORY_QUERIES_TABLE)
    .select('id', 'north_settings')
    .where('north_type', 'file-writer');
  for (const history of historyQueriesWithFileWriterNorth) {
    await knex(HISTORY_QUERIES_TABLE)
      .update({ north_settings: withSmbDefaults(history.north_settings) })
      .where('id', history.id);
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable(SOUTH_ITEM_GROUPS_TABLE, t => {
    t.integer('overlap').nullable().defaultTo(null);
  });
  await knex.schema.alterTable(SOUTH_ITEMS_TABLE, t => {
    t.integer('overlap').nullable().defaultTo(null);
  });
  await knex.raw(`UPDATE ${SOUTH_ITEM_GROUPS_TABLE} SET overlap = -start_time_offset WHERE start_time_offset IS NOT NULL`);
  await knex.raw(`UPDATE ${SOUTH_ITEMS_TABLE} SET overlap = -start_time_offset WHERE start_time_offset IS NOT NULL`);
  await knex.schema.alterTable(SOUTH_ITEM_GROUPS_TABLE, t => {
    t.dropColumn('start_time_offset');
    t.dropColumn('end_time_offset');
    t.dropColumn('recovery_strategy');
  });
  await knex.schema.alterTable(SOUTH_ITEMS_TABLE, t => {
    t.dropColumn('start_time_offset');
    t.dropColumn('end_time_offset');
    t.dropColumn('recovery_strategy');
  });
}
