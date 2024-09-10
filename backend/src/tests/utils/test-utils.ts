import Database from 'better-sqlite3';
import { migrateEntities } from '../../db/migration-service';
import path from 'node:path';
import knex from 'knex';
import testData from './test-data';
import { NorthConnectorDTO } from '../../../../shared/model/north-connector.model';
import { SouthConnectorDTO } from '../../../../shared/model/south-connector.model';
import { ScanMode } from '../../model/scan-mode.model';
import { IPFilter } from '../../model/ip-filter.model';

export const TEST_DATABASE = path.resolve('src', 'tests', 'oibus-test.db');

export const initDatabase = async (populate = true) => {
  await emptyDatabase();
  await migrateEntities(TEST_DATABASE);
  if (populate) await populateDatabase();
  return new Database(TEST_DATABASE);
};

export const emptyDatabase = async () => {
  const testDatabase = knex({
    client: 'better-sqlite3',
    connection: {
      filename: TEST_DATABASE
    },
    useNullAsDefault: true
  });
  // Disable foreign key constraints
  await testDatabase.raw('PRAGMA foreign_keys = OFF');

  // Get all table names
  const tables = await testDatabase.raw(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';`);

  // Drop each table
  for (const table of tables) {
    await testDatabase.schema.dropTableIfExists(table.name);
  }

  // Re-enable foreign key constraints
  await testDatabase.raw('PRAGMA foreign_keys = ON');

  // Destroy the connection
  await testDatabase.destroy();
};

const populateDatabase = async () => {
  const testDatabase = knex({
    client: 'better-sqlite3',
    connection: {
      filename: TEST_DATABASE
    },
    useNullAsDefault: true
  });
  await createIpFilter(testDatabase, testData.ipFilters.list[0]);
  await createIpFilter(testDatabase, testData.ipFilters.list[1]);
  await createScanMode(testDatabase, testData.scanMode.list[0]);
  await createScanMode(testDatabase, testData.scanMode.list[1]);
  await createNorth(testDatabase, testData.north.list[0]);
  await createNorth(testDatabase, testData.north.list[1]);
  await createSouth(testDatabase, testData.south.list[0]);
  await createSouth(testDatabase, testData.south.list[1]);
  await createSubscription(testDatabase, testData.north.list[0], testData.south.list[0]);
  await createSubscription(testDatabase, testData.north.list[0], testData.south.list[1]);

  // Destroy the connection
  await testDatabase.destroy();
};

const createNorth = async (database: knex.Knex, north: NorthConnectorDTO) => {
  await database
    .insert({
      id: north.id,
      name: north.name,
      type: north.type,
      description: north.description,
      enabled: north.enabled,
      settings: JSON.stringify(north.settings),
      caching_scan_mode_id: north.caching.scanModeId,
      caching_group_count: north.caching.oibusTimeValues.groupCount,
      caching_retry_interval: north.caching.retryInterval,
      caching_retry_count: north.caching.retryCount,
      caching_max_send_count: north.caching.oibusTimeValues.maxSendCount,
      caching_send_file_immediately: north.caching.rawFiles.sendFileImmediately,
      caching_max_size: north.caching.maxSize,
      archive_enabled: north.caching.rawFiles.archive.enabled,
      archive_retention_duration: north.caching.rawFiles.archive.retentionDuration
    })
    .into('north_connectors');
};

const createSouth = async (database: knex.Knex, south: SouthConnectorDTO) => {
  await database
    .insert({
      id: south.id,
      name: south.name,
      type: south.type,
      description: south.description,
      enabled: south.enabled,
      settings: JSON.stringify(south.settings),
      history_max_instant_per_item: south.history.maxInstantPerItem,
      history_max_read_interval: south.history.maxReadInterval,
      history_read_delay: south.history.readDelay,
      history_read_overlap: south.history.overlap,
      shared_connection: south.sharedConnection
    })
    .into('south_connectors');
};

const createIpFilter = async (database: knex.Knex, ipFilter: IPFilter) => {
  await database
    .insert({
      id: ipFilter.id,
      description: ipFilter.description,
      address: ipFilter.address
    })
    .into('ip_filters');
};

const createScanMode = async (database: knex.Knex, scanMode: ScanMode) => {
  await database
    .insert({
      id: scanMode.id,
      name: scanMode.name,
      description: scanMode.description,
      cron: scanMode.cron
    })
    .into('scan_modes');
};

const createSubscription = async (database: knex.Knex, north: NorthConnectorDTO, south: SouthConnectorDTO) => {
  await database.insert({ north_connector_id: north.id, south_connector_id: south.id }).into('subscription');
};
