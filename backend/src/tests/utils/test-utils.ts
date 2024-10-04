import Database from 'better-sqlite3';
import { migrateEntities } from '../../db/migration-service';
import path from 'node:path';
import knex from 'knex';
import testData from './test-data';
import { NorthConnectorDTO } from '../../../../shared/model/north-connector.model';
import { SouthConnectorDTO } from '../../../../shared/model/south-connector.model';
import { ScanMode } from '../../model/scan-mode.model';
import { IPFilter } from '../../model/ip-filter.model';
import { OIAnalyticsRegistration } from '../../model/oianalytics-registration.model';
import { EngineSettings } from '../../model/engine.model';
import {
  OIBusCommand,
  OIBusUpdateEngineSettingsCommand,
  OIBusUpdateNorthConnectorCommand,
  OIBusUpdateScanModeCommand,
  OIBusUpdateSouthConnectorCommand,
  OIBusUpdateVersionCommand
} from '../../model/oianalytics-command.model';
import { OIAnalyticsMessage } from '../../model/oianalytics-message.model';

export const TEST_DATABASE = path.resolve('src', 'tests', 'oibus-test.db');

export const flushPromises = () => new Promise(jest.requireActual('timers').setImmediate);

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
  await createEngineSettings(testDatabase, testData.engine.settings);
  await createOIAnalyticsRegistration(testDatabase, testData.oIAnalytics.registration.completed);
  for (const command of testData.oIAnalytics.commands.oIBusList) {
    await createOIAnalyticsCommand(testDatabase, command);
  }
  for (const message of testData.oIAnalytics.messages.oIBusList) {
    await createOIAnalyticsMessage(testDatabase, message);
  }
  for (const element of testData.ipFilters.list) {
    await createIpFilter(testDatabase, element);
  }
  for (const element of testData.scanMode.list) {
    await createScanMode(testDatabase, element);
  }
  for (const element of testData.north.list) {
    await createNorth(testDatabase, element);
  }
  for (const element of testData.south.list) {
    await createSouth(testDatabase, element);
  }
  await createSubscription(testDatabase, testData.north.list[0], testData.south.list[0]);
  await createSubscription(testDatabase, testData.north.list[0], testData.south.list[1]);

  // Destroy the connection
  await testDatabase.destroy();
};

const createEngineSettings = async (database: knex.Knex, engineSettings: EngineSettings) => {
  await database
    .insert({
      id: engineSettings.id,
      name: engineSettings.name,
      port: engineSettings.port,
      log_console_level: engineSettings.logParameters.console.level,
      log_file_level: engineSettings.logParameters.file.level,
      log_file_max_file_size: engineSettings.logParameters.file.maxFileSize,
      log_file_number_of_files: engineSettings.logParameters.file.numberOfFiles,
      log_database_level: engineSettings.logParameters.database.level,
      log_database_max_number_of_logs: engineSettings.logParameters.database.maxNumberOfLogs,
      log_loki_level: engineSettings.logParameters.loki.level,
      log_loki_interval: engineSettings.logParameters.loki.interval,
      log_loki_address: engineSettings.logParameters.loki.address,
      log_loki_username: engineSettings.logParameters.loki.username,
      log_loki_password: engineSettings.logParameters.loki.password,
      log_oia_level: engineSettings.logParameters.oia.level,
      log_oia_interval: engineSettings.logParameters.oia.interval,
      proxy_enabled: engineSettings.proxyEnabled,
      proxy_port: engineSettings.proxyPort,
      oibus_version: '3.5.0'
    })
    .into('engines');
};

const createOIAnalyticsRegistration = async (database: knex.Knex, registration: OIAnalyticsRegistration) => {
  await database
    .insert({
      id: registration.id,
      host: registration.host,
      activation_code: registration.activationCode,
      token: registration.token,
      status: registration.status,
      activation_date: registration.activationDate,
      activation_expiration_date: registration.activationExpirationDate,
      check_url: registration.checkUrl,
      use_proxy: registration.useProxy,
      proxy_url: registration.proxyUrl,
      proxy_username: registration.proxyUsername,
      proxy_password: registration.proxyPassword,
      accept_unauthorized: registration.acceptUnauthorized
    })
    .into('registrations');
};

const createOIAnalyticsCommand = async (database: knex.Knex, command: OIBusCommand) => {
  await database
    .insert({
      id: command.id,
      type: command.type,
      status: command.status,
      ack: command.ack,
      retrieved_date: command.retrievedDate,
      completed_date: command.completedDate,
      result: command.result,
      upgrade_version: ['update-version'].includes(command.type) ? (command as OIBusUpdateVersionCommand).version : null,
      upgrade_asset_id: ['update-version'].includes(command.type) ? (command as OIBusUpdateVersionCommand).assetId : null,
      command_content: [
        'update-engine-settings',
        'create-scan-mode',
        'update-scan-mode',
        'create-south',
        'update-south',
        'create-north',
        'update-north'
      ].includes(command.type)
        ? (command as OIBusUpdateEngineSettingsCommand).commandContent
        : null,
      target_version: [
        'update-engine-settings',
        'create-scan-mode',
        'update-scan-mode',
        'delete-scan-mode',
        'create-south',
        'update-south',
        'delete-south',
        'create-north',
        'update-north',
        'delete-north'
      ].includes(command.type)
        ? (command as OIBusUpdateEngineSettingsCommand).targetVersion
        : null,
      scan_mode_id: ['update-scan-mode', 'delete-scan-mode'].includes(command.type)
        ? (command as OIBusUpdateScanModeCommand).scanModeId
        : null,
      south_connector_id: ['update-south', 'delete-south'].includes(command.type)
        ? (command as OIBusUpdateSouthConnectorCommand).southConnectorId
        : null,
      north_connector_id: ['update-north', 'delete-north'].includes(command.type)
        ? (command as OIBusUpdateNorthConnectorCommand).northConnectorId
        : null
    })
    .into('commands');
};

const createOIAnalyticsMessage = async (database: knex.Knex, command: OIAnalyticsMessage) => {
  await database
    .insert({
      id: command.id,
      type: command.type,
      status: command.status,
      completed_date: command.completedDate,
      error: command.error
    })
    .into('oianalytics_messages');
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
