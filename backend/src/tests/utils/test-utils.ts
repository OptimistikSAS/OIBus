import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import type pino from 'pino';
import type LoggerMock from '../__mocks__/service/logger/logger.mock';
import { setImmediate } from 'node:timers';
import { migrateCrypto, migrateEntities, migrateLogs, migrateMetrics, migrateSouthCache } from '../../migration/migration-service';
import path from 'node:path';
import knex from 'knex';
import testData from './test-data';
import { ScanMode } from '../../model/scan-mode.model';
import { IPFilter } from '../../model/ip-filter.model';
import { OIAnalyticsRegistration } from '../../model/oianalytics-registration.model';
import { EngineSettings } from '../../model/engine.model';
import {
  OIBusCommand,
  OIBusUpdateEngineSettingsCommand,
  OIBusUpdateNorthConnectorCommand,
  OIBusUpdateScanModeCommand,
  OIBusUpdateSouthConnectorCommand
} from '../../model/oianalytics-command.model';
import { OIAnalyticsMessage } from '../../model/oianalytics-message.model';
import { Certificate } from '../../model/certificate.model';
import { User } from '../../model/user.model';
import { HistoryQueryEntity, HistoryQueryItemEntity } from '../../model/histor-query.model';
import { SouthItemSettings, SouthSettings } from '../../../shared/model/south-settings.model';
import { NorthSettings } from '../../../shared/model/north-settings.model';
import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import {
  CryptoSettings,
  EngineMetrics,
  HistoryQueryMetrics,
  NorthConnectorMetrics,
  SouthConnectorMetrics
} from '../../../shared/model/engine.model';
import { BaseFolders } from 'src/model/types';
import { Transformer, TransformerSource } from '../../model/transformer.model';
import { OIBusNorthType } from '../../../shared/model/north-connector.model';
import { OIBusSouthType } from '../../../shared/model/south-connector.model';

const CONFIG_TEST_DATABASE = path.resolve('src', 'tests', 'test-config.db');
const CRYPTO_TEST_DATABASE = path.resolve('src', 'tests', 'test-crypto.db');
const LOGS_TEST_DATABASE = path.resolve('src', 'tests', 'test-logs.db');
const METRICS_TEST_DATABASE = path.resolve('src', 'tests', 'test-metrics.db');
const CACHE_TEST_DATABASE = path.resolve('src', 'tests', 'test-cache.db');

export const flushPromises = () => new Promise(setImmediate);

/** Single escape hatch for the logger mock at constructor boundaries. */
export function asLogger(mock: LoggerMock): pino.Logger {
  return mock as unknown as pino.Logger;
}

/**
 * Injects exports into the require cache for a module.
 * The module is loaded first (if not already cached) to ensure it has a cache entry.
 * Use before reloadModule() to set up mocks for dependencies of the module under test.
 *
 * IMPORTANT: tsx compiles `import { fn } from './mod'` as namespace access (`import_mod.fn()`),
 * so the SUT holds a reference to the exports OBJECT, not individual bindings.
 * This means replacing the cache entry works only when the SUT is loaded AFTER this call.
 * To update mocks between tests, mutate the object returned by this function in-place
 * rather than calling mockModule() again.
 */
export function mockModule(req: NodeJS.Require, modulePath: string, exports: unknown): Record<string, unknown> {
  try {
    req(modulePath);
  } catch {
    // ensure the module has a cache entry before we replace its exports
  }
  const resolved = req.resolve(modulePath);
  req.cache[resolved]!.exports = exports;
  return exports as Record<string, unknown>;
}

/**
 * Deletes a module from the require cache and reloads it.
 * Call after all mockModule() calls to load the SUT with mocked dependencies applied.
 */
export function reloadModule<T>(req: NodeJS.Require, modulePath: string): T {
  const resolved = req.resolve(modulePath);
  delete req.cache[resolved];
  return req(modulePath) as T;
}

/**
 * Creates a FIFO sequential mock implementation for node:test.
 * node:test's mockImplementationOnce overwrites prior "once" impls, so this helper
 * provides Jest-compatible sequential behaviour with multiple staged return values.
 */
export function seq<T>(...impls: Array<() => T>): () => T {
  let i = 0;
  return () => (i < impls.length ? impls[i++]() : (undefined as unknown as T));
}

/**
 * Asserts that `actual` contains all properties from `expected` (partial match).
 * Equivalent to Jest's expect(actual).toEqual(expect.objectContaining(expected)).
 */
export function assertContains(actual: unknown, expected: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(expected)) {
    assert.deepStrictEqual((actual as Record<string, unknown>)[key], value, `Property '${key}' mismatch`);
  }
}

export function stripAuditFields<T>(obj: T): T {
  if (Array.isArray(obj)) {
    return obj.map(stripAuditFields) as T;
  }
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (['createdBy', 'updatedBy', 'createdAt', 'updatedAt'].includes(key)) continue;
      result[key] = stripAuditFields(value);
    }
    return result as T;
  }
  return obj;
}

export const initDatabase = async (database: 'config' | 'crypto' | 'cache' | 'logs' | 'metrics', populate = true, dbPath?: string) => {
  switch (database) {
    case 'crypto': {
      const resolvedPath = dbPath ?? CRYPTO_TEST_DATABASE;
      await emptyDatabase('crypto', resolvedPath);
      await migrateCrypto(resolvedPath);
      if (populate) await populateCryptoDatabase(resolvedPath);
      return new Database(resolvedPath);
    }
    case 'cache': {
      const resolvedPath = dbPath ?? CACHE_TEST_DATABASE;
      await emptyDatabase('cache', resolvedPath);
      await migrateSouthCache(resolvedPath);
      return new Database(resolvedPath);
    }
    case 'config': {
      const resolvedPath = dbPath ?? CONFIG_TEST_DATABASE;
      await emptyDatabase('config', resolvedPath);
      await migrateEntities(resolvedPath);
      if (populate) await populateConfigDatabase(resolvedPath);
      return new Database(resolvedPath);
    }
    case 'logs': {
      const resolvedPath = dbPath ?? LOGS_TEST_DATABASE;
      await emptyDatabase('logs', resolvedPath);
      await migrateLogs(resolvedPath);
      return new Database(resolvedPath);
    }
    case 'metrics': {
      const resolvedPath = dbPath ?? METRICS_TEST_DATABASE;
      await emptyDatabase('metrics', resolvedPath);
      await migrateMetrics(resolvedPath);
      if (populate) await populateMetricsDatabase(resolvedPath);
      return new Database(resolvedPath);
    }
  }
};

export const emptyDatabase = async (database: 'config' | 'crypto' | 'cache' | 'logs' | 'metrics', dbPath?: string) => {
  let databasePath = dbPath ?? '';
  if (!dbPath) {
    switch (database) {
      case 'crypto':
        databasePath = CRYPTO_TEST_DATABASE;
        break;
      case 'cache':
        databasePath = CACHE_TEST_DATABASE;
        break;
      case 'config':
        databasePath = CONFIG_TEST_DATABASE;
        break;
      case 'logs':
        databasePath = LOGS_TEST_DATABASE;
        break;
      case 'metrics':
        databasePath = METRICS_TEST_DATABASE;
        break;
    }
  }

  const testDatabase = knex({
    client: 'better-sqlite3',
    connection: {
      filename: databasePath
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

export const mockBaseFolders = (id: string): BaseFolders => ({
  archive: path.resolve('archive', id),
  cache: path.resolve('cache', id),
  error: path.resolve('error', id)
});

const populateMetricsDatabase = async (dbPath = METRICS_TEST_DATABASE) => {
  const testDatabase = knex({
    client: 'better-sqlite3',
    connection: {
      filename: dbPath
    },
    useNullAsDefault: true
  });

  await createEngineMetrics(testDatabase, testData.engine.settings.id, testData.engine.metrics);
  await createNorthMetrics(testDatabase, testData.north.list[0].id, testData.north.metrics);
  await createSouthMetrics(testDatabase, testData.south.list[0].id, testData.south.metrics);
  await createHistoryQueryMetrics(testDatabase, testData.historyQueries.list[0].id, testData.historyQueries.metrics);

  // Destroy the connection
  await testDatabase.destroy();
};

const createEngineMetrics = async (database: knex.Knex, oibusId: string, engineMetrics: EngineMetrics) => {
  await database
    .insert({
      engine_id: oibusId,
      metrics_start: engineMetrics.metricsStart,
      process_cpu_usage_instant: engineMetrics.processCpuUsageInstant,
      process_cpu_usage_average: engineMetrics.processCpuUsageAverage,
      process_uptime: engineMetrics.processUptime,
      free_memory: engineMetrics.freeMemory,
      total_memory: engineMetrics.totalMemory,
      min_rss: engineMetrics.minRss,
      current_rss: engineMetrics.currentRss,
      max_rss: engineMetrics.maxRss,
      min_heap_total: engineMetrics.minHeapTotal,
      current_heap_total: engineMetrics.currentHeapTotal,
      max_heap_total: engineMetrics.maxHeapTotal,
      min_heap_used: engineMetrics.minHeapUsed,
      current_heap_used: engineMetrics.currentHeapUsed,
      max_heap_used: engineMetrics.maxHeapUsed,
      min_external: engineMetrics.minExternal,
      current_external: engineMetrics.currentExternal,
      max_external: engineMetrics.maxExternal,
      min_array_buffers: engineMetrics.minArrayBuffers,
      current_array_buffers: engineMetrics.currentArrayBuffers,
      max_array_buffers: engineMetrics.maxArrayBuffers
    })
    .into('engine_metrics');
};

const createNorthMetrics = async (database: knex.Knex, northId: string, northMetrics: NorthConnectorMetrics) => {
  await database
    .insert({
      north_id: northId,
      metrics_start: northMetrics.metricsStart,
      last_connection: northMetrics.lastConnection,
      last_run_start: northMetrics.lastRunStart,
      last_run_duration: northMetrics.lastRunDuration,
      content_sent_size: northMetrics.contentSentSize,
      content_cached_size: northMetrics.contentCachedSize,
      content_errored_size: northMetrics.contentErroredSize,
      content_archived_size: northMetrics.contentArchivedSize,
      last_content_sent: northMetrics.lastContentSent,
      current_cache_size: northMetrics.currentCacheSize,
      current_error_size: northMetrics.currentErrorSize,
      current_archive_size: northMetrics.currentArchiveSize
    })
    .into('north_metrics');
};

const createSouthMetrics = async (database: knex.Knex, southId: string, southMetrics: SouthConnectorMetrics) => {
  await database
    .insert({
      south_id: southId,
      metrics_start: southMetrics.metricsStart,
      nb_values: southMetrics.numberOfValuesRetrieved,
      nb_files: southMetrics.numberOfFilesRetrieved,
      last_connection: southMetrics.lastConnection,
      last_run_start: southMetrics.lastRunStart,
      last_run_duration: southMetrics.lastRunDuration,
      last_value: southMetrics.lastValueRetrieved,
      last_file: southMetrics.lastFileRetrieved
    })
    .into('south_metrics');
};

const createHistoryQueryMetrics = async (database: knex.Knex, historyQueryId: string, historyQueryMetrics: HistoryQueryMetrics) => {
  await database
    .insert({
      history_query_id: historyQueryId,
      metrics_start: historyQueryMetrics.metricsStart,
      nb_values_retrieved: historyQueryMetrics.south.numberOfValuesRetrieved,
      nb_files_retrieved: historyQueryMetrics.south.numberOfFilesRetrieved,
      last_south_connection: historyQueryMetrics.south.lastConnection,
      last_south_run_start: historyQueryMetrics.south.lastRunStart,
      last_south_run_duration: historyQueryMetrics.south.lastRunDuration,
      last_value_retrieved: historyQueryMetrics.south.lastValueRetrieved,
      last_file_retrieved: historyQueryMetrics.south.lastFileRetrieved,
      content_sent_size: historyQueryMetrics.north.contentSentSize,
      content_cached_size: historyQueryMetrics.north.contentCachedSize,
      content_errored_size: historyQueryMetrics.north.contentErroredSize,
      content_archived_size: historyQueryMetrics.north.contentArchivedSize,
      last_content_sent: historyQueryMetrics.north.lastContentSent,
      last_north_connection: historyQueryMetrics.north.lastConnection,
      last_north_run_start: historyQueryMetrics.north.lastRunStart,
      last_north_run_duration: historyQueryMetrics.north.lastRunDuration,
      north_current_cache_size: historyQueryMetrics.north.currentCacheSize,
      north_current_error_size: historyQueryMetrics.north.currentErrorSize,
      north_current_archive_size: historyQueryMetrics.north.currentArchiveSize
    })
    .into('history_query_metrics');
};

const populateCryptoDatabase = async (dbPath = CRYPTO_TEST_DATABASE) => {
  const testDatabase = knex({
    client: 'better-sqlite3',
    connection: {
      filename: dbPath
    },
    useNullAsDefault: true
  });
  await createCryptoSettings(testDatabase, testData.engine.settings.id, testData.engine.crypto);

  // Destroy the connection
  await testDatabase.destroy();
};

const createCryptoSettings = async (database: knex.Knex, oibusId: string, cryptoSetting: CryptoSettings) => {
  await database
    .insert({
      id: oibusId,
      algorithm: cryptoSetting.algorithm,
      init_vector: cryptoSetting.initVector,
      security_key: cryptoSetting.securityKey
    })
    .into('crypto');
};

const populateConfigDatabase = async (dbPath = CONFIG_TEST_DATABASE) => {
  const testDatabase = knex({
    client: 'better-sqlite3',
    connection: {
      filename: dbPath
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
  for (const element of testData.transformers.list) {
    await createTransformer(testDatabase, element);
  }
  for (const element of testData.south.list) {
    await createSouth(testDatabase, element);
  }
  for (const element of testData.north.list) {
    await createNorth(testDatabase, element);
  }
  for (const element of testData.historyQueries.list) {
    await createHistoryQuery(testDatabase, element);
  }
  for (const element of testData.certificates.list) {
    await createCertificate(testDatabase, element);
  }
  for (const element of testData.users.list) {
    await createUser(testDatabase, element);
  }

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
      oibus_version: engineSettings.version,
      oibus_launcher_version: engineSettings.launcherVersion,
      created_by: engineSettings.createdBy,
      updated_by: engineSettings.updatedBy,
      created_at: engineSettings.createdAt,
      updated_at: engineSettings.updatedAt
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
      use_api_gateway: registration.useApiGateway,
      api_gateway_header_key: registration.apiGatewayHeaderKey,
      api_gateway_header_value: registration.apiGatewayHeaderValue,
      api_gateway_base_endpoint: registration.apiGatewayBaseEndpoint,
      accept_unauthorized: registration.acceptUnauthorized,
      public_key: registration.publicCipherKey,
      private_key: registration.privateCipherKey,
      command_refresh_interval: registration.commandRefreshInterval,
      command_retry_interval: registration.commandRetryInterval,
      message_retry_interval: registration.messageRetryInterval,
      command_update_version: registration.commandPermissions.updateVersion,
      command_restart_engine: registration.commandPermissions.restartEngine,
      command_regenerate_cipher_keys: registration.commandPermissions.regenerateCipherKeys,
      command_update_engine_settings: registration.commandPermissions.updateEngineSettings,
      command_update_registration_settings: registration.commandPermissions.updateRegistrationSettings,
      command_create_scan_mode: registration.commandPermissions.createScanMode,
      command_update_scan_mode: registration.commandPermissions.updateScanMode,
      command_delete_scan_mode: registration.commandPermissions.deleteScanMode,
      command_create_ip_filter: registration.commandPermissions.createIpFilter,
      command_update_ip_filter: registration.commandPermissions.updateIpFilter,
      command_delete_ip_filter: registration.commandPermissions.deleteIpFilter,
      command_create_certificate: registration.commandPermissions.createCertificate,
      command_update_certificate: registration.commandPermissions.updateCertificate,
      command_delete_certificate: registration.commandPermissions.deleteCertificate,
      command_create_history_query: registration.commandPermissions.createHistoryQuery,
      command_update_history_query: registration.commandPermissions.updateHistoryQuery,
      command_delete_history_query: registration.commandPermissions.deleteHistoryQuery,
      command_create_or_update_history_items_from_csv: registration.commandPermissions.createOrUpdateHistoryItemsFromCsv,
      command_test_history_south_connection: registration.commandPermissions.testHistorySouthConnection,
      command_test_history_north_connection: registration.commandPermissions.testHistoryNorthConnection,
      command_test_history_south_item: registration.commandPermissions.testHistorySouthItem,
      command_create_south: registration.commandPermissions.createSouth,
      command_update_south: registration.commandPermissions.updateSouth,
      command_delete_south: registration.commandPermissions.deleteSouth,
      command_create_or_update_south_items_from_csv: registration.commandPermissions.createOrUpdateSouthItemsFromCsv,
      command_test_south_connection: registration.commandPermissions.testSouthConnection,
      command_test_south_item: registration.commandPermissions.testSouthItem,
      command_create_north: registration.commandPermissions.createNorth,
      command_update_north: registration.commandPermissions.updateNorth,
      command_delete_north: registration.commandPermissions.deleteNorth,
      command_test_north_connection: registration.commandPermissions.testNorthConnection,
      command_setpoint: registration.commandPermissions.setpoint,
      command_search_history_cache_content: registration.commandPermissions.searchHistoryCacheContent,
      command_get_history_cache_file_content: registration.commandPermissions.getHistoryCacheFileContent,
      command_update_history_cache_content: registration.commandPermissions.updateHistoryCacheContent,
      command_search_north_cache_content: registration.commandPermissions.searchNorthCacheContent,
      command_get_north_cache_file_content: registration.commandPermissions.getNorthCacheFileContent,
      command_update_north_cache_content: registration.commandPermissions.updateNorthCacheContent,
      command_create_custom_transformer: registration.commandPermissions.createCustomTransformer,
      command_update_custom_transformer: registration.commandPermissions.updateCustomTransformer,
      command_delete_custom_transformer: registration.commandPermissions.deleteCustomTransformer,
      command_test_custom_transformer: registration.commandPermissions.testCustomTransformer,
      created_by: registration.createdBy,
      updated_by: registration.updatedBy,
      created_at: registration.createdAt,
      updated_at: registration.updatedAt
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
      target_version: command.targetVersion,
      retrieved_date: command.retrievedDate,
      completed_date: command.completedDate,
      result: command.result,
      command_content: [
        'update-version',
        'update-engine-settings',
        'update-registration-settings',
        'create-or-update-south-items-from-csv',
        'create-scan-mode',
        'update-scan-mode',
        'create-south',
        'update-south',
        'create-north',
        'update-north'
      ].includes(command.type)
        ? (command as OIBusUpdateEngineSettingsCommand).commandContent
        : null,
      scan_mode_id: ['update-scan-mode', 'delete-scan-mode'].includes(command.type)
        ? (command as OIBusUpdateScanModeCommand).scanModeId
        : null,
      south_connector_id: ['create-south', 'update-south', 'delete-south', 'create-or-update-south-items-from-csv'].includes(command.type)
        ? (command as OIBusUpdateSouthConnectorCommand).southConnectorId
        : null,
      north_connector_id: ['create-north', 'update-north', 'delete-north'].includes(command.type)
        ? (command as OIBusUpdateNorthConnectorCommand).northConnectorId
        : null,
      created_by: command.createdBy,
      updated_by: command.updatedBy,
      created_at: command.createdAt || testData.constants.dates.FAKE_NOW,
      updated_at: command.updatedAt || testData.constants.dates.FAKE_NOW
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
      error: command.error,
      created_by: 'system',
      updated_by: 'system',
      created_at: testData.constants.dates.FAKE_NOW,
      updated_at: testData.constants.dates.FAKE_NOW
    })
    .into('oianalytics_messages');
};

const createNorth = async (database: knex.Knex, north: NorthConnectorEntity<NorthSettings>) => {
  await database
    .insert({
      id: north.id,
      name: north.name,
      type: north.type,
      description: north.description,
      enabled: north.enabled,
      settings: JSON.stringify(north.settings),
      caching_trigger_schedule: north.caching.trigger.scanMode.id,
      caching_trigger_number_of_elements: north.caching.trigger.numberOfElements,
      caching_trigger_number_of_files: north.caching.trigger.numberOfFiles,
      caching_throttling_run_min_delay: north.caching.throttling.runMinDelay,
      caching_throttling_cache_max_size: north.caching.throttling.maxSize,
      caching_throttling_max_number_of_elements: north.caching.throttling.maxNumberOfElements,
      caching_error_retry_interval: north.caching.error.retryInterval,
      caching_error_retry_count: north.caching.error.retryCount,
      caching_error_retention_duration: north.caching.error.retentionDuration,
      caching_archive_enabled: north.caching.archive.enabled,
      caching_archive_retention_duration: north.caching.archive.retentionDuration
    })
    .into('north_connectors');

  for (const transformerWithOptions of north.transformers) {
    await createNorthTransformer(
      database,
      transformerWithOptions.id,
      north.id,
      transformerWithOptions.transformer.id,
      transformerWithOptions.options,
      transformerWithOptions.source
    );
  }
};

const createSouth = async (database: knex.Knex, south: SouthConnectorEntity<SouthSettings, SouthItemSettings>) => {
  await database
    .insert({
      id: south.id,
      name: south.name,
      type: south.type,
      description: south.description,
      enabled: south.enabled,
      settings: JSON.stringify(south.settings)
    })
    .into('south_connectors');

  for (const item of south.items) {
    await createSouthConnectorItem(database, south.id, item);
  }
};

const createSouthConnectorItem = async (
  database: knex.Knex,
  southConnectorId: string,
  item: SouthConnectorItemEntity<SouthItemSettings>
) => {
  await database
    .insert({
      id: item.id,
      connector_id: southConnectorId,
      scan_mode_id: item.scanMode?.id || null,
      name: item.name,
      enabled: item.enabled,
      settings: JSON.stringify(item.settings)
    })
    .into('south_items');
};

const createIpFilter = async (database: knex.Knex, ipFilter: IPFilter) => {
  await database
    .insert({
      id: ipFilter.id,
      description: ipFilter.description,
      address: ipFilter.address,
      created_by: ipFilter.createdBy,
      updated_by: ipFilter.updatedBy,
      created_at: ipFilter.createdAt,
      updated_at: ipFilter.updatedAt
    })
    .into('ip_filters');
};

const createScanMode = async (database: knex.Knex, scanMode: ScanMode) => {
  await database
    .insert({
      id: scanMode.id,
      name: scanMode.name,
      description: scanMode.description,
      cron: scanMode.cron,
      created_by: scanMode.createdBy,
      updated_by: scanMode.updatedBy,
      created_at: scanMode.createdAt,
      updated_at: scanMode.updatedAt
    })
    .into('scan_modes');
};

const createCertificate = async (database: knex.Knex, certificate: Certificate) => {
  await database
    .insert({
      id: certificate.id,
      name: certificate.name,
      description: certificate.description,
      public_key: certificate.publicKey,
      private_key: certificate.privateKey,
      expiry: certificate.expiry,
      certificate: certificate.certificate,
      created_by: certificate.createdBy,
      updated_by: certificate.updatedBy,
      created_at: certificate.createdAt,
      updated_at: certificate.updatedAt
    })
    .into('certificates');
};

const createUser = async (database: knex.Knex, user: User) => {
  await database
    .insert({
      id: user.id,
      login: user.login,
      password: 'password',
      first_name: user.firstName,
      last_name: user.lastName,
      email: user.email,
      language: user.language,
      timezone: user.timezone,
      created_by: user.createdBy,
      updated_by: user.updatedBy,
      created_at: user.createdAt,
      updated_at: user.updatedAt
    })
    .into('users');
};

const createHistoryQuery = async (
  database: knex.Knex,
  historyQuery: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>
) => {
  await database
    .insert({
      id: historyQuery.id,
      status: historyQuery.status,
      name: historyQuery.name,
      description: historyQuery.description,
      start_time: historyQuery.queryTimeRange.startTime,
      end_time: historyQuery.queryTimeRange.endTime,
      throttling_max_read_interval: historyQuery.queryTimeRange.maxReadInterval,
      throttling_read_delay: historyQuery.queryTimeRange.readDelay,
      south_type: historyQuery.southType,
      north_type: historyQuery.northType,
      south_settings: JSON.stringify(historyQuery.southSettings),
      north_settings: JSON.stringify(historyQuery.northSettings),
      caching_trigger_schedule: historyQuery.caching.trigger.scanMode.id,
      caching_trigger_number_of_elements: historyQuery.caching.trigger.numberOfElements,
      caching_trigger_number_of_files: historyQuery.caching.trigger.numberOfFiles,
      caching_throttling_run_min_delay: historyQuery.caching.throttling.runMinDelay,
      caching_throttling_cache_max_size: historyQuery.caching.throttling.maxSize,
      caching_throttling_max_number_of_elements: historyQuery.caching.throttling.maxNumberOfElements,
      caching_error_retry_interval: historyQuery.caching.error.retryInterval,
      caching_error_retry_count: historyQuery.caching.error.retryCount,
      caching_error_retention_duration: historyQuery.caching.error.retentionDuration,
      caching_archive_enabled: historyQuery.caching.archive.enabled,
      caching_archive_retention_duration: historyQuery.caching.archive.retentionDuration
    })
    .into('history_queries');

  for (const item of historyQuery.items) {
    await createHistoryQueryItem(database, historyQuery.id, item);
  }

  for (const transformerWithOptions of historyQuery.northTransformers) {
    await createHistoryQueryTransformer(
      database,
      transformerWithOptions.id,
      historyQuery.id,
      transformerWithOptions.transformer.id,
      transformerWithOptions.options
    );
    for (const item of transformerWithOptions.items) {
      await createHistoryTransformerItem(database, transformerWithOptions.id, item.id);
    }
  }
};

const createHistoryQueryItem = async (database: knex.Knex, historyQueryId: string, item: HistoryQueryItemEntity<SouthItemSettings>) => {
  await database
    .insert({
      id: item.id,
      history_id: historyQueryId,
      name: item.name,
      enabled: item.enabled,
      settings: JSON.stringify(item.settings)
    })
    .into('history_items');
};

const createTransformer = async (database: knex.Knex, transformer: Transformer) => {
  switch (transformer.type) {
    case 'custom':
      await database
        .insert({
          id: transformer.id,
          type: transformer.type,
          input_type: transformer.inputType,
          output_type: transformer.outputType,
          name: transformer.name,
          description: transformer.description,
          custom_code: transformer.customCode,
          language: transformer.language,
          timeout: transformer.timeout,
          custom_manifest: JSON.stringify(transformer.customManifest)
        })
        .into('transformers');
      break;
    case 'standard':
      await database
        .insert({
          id: transformer.id,
          type: transformer.type,
          input_type: transformer.inputType,
          output_type: transformer.outputType,
          function_name: transformer.functionName
        })
        .into('transformers');
  }
};

const createNorthTransformer = async (
  database: knex.Knex,
  northTransformerId: string,
  northId: string,
  transformerId: string,
  options: object,
  source: TransformerSource
) => {
  await database
    .insert({
      id: northTransformerId,
      north_id: northId,
      transformer_id: transformerId,
      options: JSON.stringify(options),
      source_type: source.type,
      source_api_data_source_id: source.type === 'oibus-api' ? source.dataSourceId : undefined,
      source_south_south_id: source.type === 'south' ? source.south.id : undefined,
      source_south_group_id: source.type === 'south' ? (source.group?.id ?? undefined) : undefined
    })
    .into('north_transformers');

  if (source.type === 'south') {
    for (const item of source.items) {
      await createNorthTransformerItem(database, northTransformerId, item.id);
    }
  }
};

const createNorthTransformerItem = async (database: knex.Knex, northTransformerId: string, itemId: string) => {
  await database
    .insert({
      id: northTransformerId,
      item_id: itemId
    })
    .into('north_transformers_items');
};

const createHistoryTransformerItem = async (database: knex.Knex, historyTransformerId: string, itemId: string) => {
  await database
    .insert({
      id: historyTransformerId,
      item_id: itemId
    })
    .into('history_query_transformers_items');
};

const createHistoryQueryTransformer = async (
  database: knex.Knex,
  historyTransformerId: string,
  historyId: string,
  transformerId: string,
  options: object
) => {
  await database
    .insert({
      id: historyTransformerId,
      history_id: historyId,
      transformer_id: transformerId,
      options: JSON.stringify(options)
    })
    .into('history_query_transformers');
};

export const buildNorthEntity = <T extends NorthSettings>(type: OIBusNorthType, settings: T): NorthConnectorEntity<T> => ({
  id: 'northId',
  createdBy: 'system',
  updatedBy: 'system',
  createdAt: testData.constants.dates.DATE_1,
  updatedAt: testData.constants.dates.DATE_2,
  name: 'myNorth',
  description: 'desc',
  type: type,
  enabled: true,
  settings,
  caching: {
    trigger: {
      scanMode: testData.scanMode.list[0],
      numberOfElements: 250,
      numberOfFiles: 1
    },
    throttling: {
      runMinDelay: 200,
      maxSize: 30,
      maxNumberOfElements: 10_000
    },
    error: {
      retryInterval: 1_000,
      retryCount: 3,
      retentionDuration: 24
    },
    archive: {
      enabled: false,
      retentionDuration: 72
    }
  },
  transformers: []
});

export const buildSouthEntity = <T extends SouthSettings, I extends SouthItemSettings>(
  type: OIBusSouthType,
  settings: T,
  itemSettings: Array<I>
): SouthConnectorEntity<T, I> => {
  const index = 0;
  const items: Array<SouthConnectorItemEntity<I>> = [];
  for (const element of itemSettings) {
    items.push({
      id: `id${index}`,
      createdBy: 'system',
      updatedBy: 'system',
      createdAt: testData.constants.dates.DATE_1,
      updatedAt: testData.constants.dates.DATE_2,
      name: `item${index}`,
      enabled: true,
      settings: element,
      scanMode: testData.scanMode.list[0],
      group: null,
      syncWithGroup: false,
      maxReadInterval: 3600,
      readDelay: 200,
      overlap: 0
    });
  }
  return {
    id: 'southId',
    createdBy: 'system',
    updatedBy: 'system',
    createdAt: testData.constants.dates.DATE_1,
    updatedAt: testData.constants.dates.DATE_2,
    name: 'mySouth',
    description: 'desc',
    type,
    enabled: true,
    settings,
    items,
    groups: []
  };
};
