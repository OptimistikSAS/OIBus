import path from 'node:path';

import Database from 'better-sqlite3';
import knex from 'knex';

import type { NorthSettings } from '../../../shared/model/connector/north-settings.model';
import type { SouthItemSettings, SouthSettings } from '../../../shared/model/connector/south-settings.model';
import type {
  CryptoSettings,
  EngineMetrics,
  HistoryQueryMetrics,
  NorthConnectorMetrics,
  SouthConnectorMetrics
} from '../../../shared/model/domain/engine.model';

import { migrateCrypto, migrateEntities, migrateLogs, migrateMetrics, migrateSouthCache } from '../../migration/migration-service';
import type { Certificate } from '../../model/certificate.model';
import type { EngineSettings } from '../../model/engine.model';
import type { HistoryQueryEntity, HistoryQueryItemEntity } from '../../model/histor-query.model';
import type { IPFilter } from '../../model/ip-filter.model';
import type { NorthConnectorEntity } from '../../model/north-connector.model';
import type {
  OIBusCommand,
  OIBusUpdateEngineGeneralCommand,
  OIBusUpdateNorthConnectorCommand,
  OIBusUpdateScanModeCommand,
  OIBusUpdateSouthConnectorCommand
} from '../../model/oianalytics-command.model';
import type { OIAnalyticsMessage } from '../../model/oianalytics-message.model';
import type { OIAnalyticsRegistration } from '../../model/oianalytics-registration.model';
import type { ScanMode } from '../../model/scan-mode.model';
import type { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import type { Transformer, TransformerSource } from '../../model/transformer.model';
import type { User } from '../../model/user.model';
import testData from './test-data';

const CONFIG_TEST_DATABASE = path.resolve('src', 'tests', 'test-config.db');
const CRYPTO_TEST_DATABASE = path.resolve('src', 'tests', 'test-crypto.db');
const LOGS_TEST_DATABASE = path.resolve('src', 'tests', 'test-logs.db');
const METRICS_TEST_DATABASE = path.resolve('src', 'tests', 'test-metrics.db');
const CACHE_TEST_DATABASE = path.resolve('src', 'tests', 'test-cache.db');

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
      last_content_sent: northMetrics.lastContentSent
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
      last_north_run_duration: historyQueryMetrics.north.lastRunDuration
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
      name: engineSettings.general.name,
      port: engineSettings.webServer.port,
      auth_token_duration: engineSettings.webServer.authTokenDuration,
      https_enabled: +engineSettings.webServer.https.enabled,
      https_certificate_source: engineSettings.webServer.https.certificateSource,
      https_certificate_id: engineSettings.webServer.https.certificateId,
      https_certificate_path: engineSettings.webServer.https.certificatePath,
      https_private_key_path: engineSettings.webServer.https.privateKeyPath,
      log_console_level: engineSettings.logger.console.level,
      log_file_level: engineSettings.logger.file.level,
      log_file_max_file_size: engineSettings.logger.file.maxFileSize,
      log_file_number_of_files: engineSettings.logger.file.numberOfFiles,
      log_database_level: engineSettings.logger.database.level,
      log_database_max_number_of_logs: engineSettings.logger.database.maxNumberOfLogs,
      log_loki_level: engineSettings.logger.loki.level,
      log_loki_interval: engineSettings.logger.loki.interval,
      log_loki_address: engineSettings.logger.loki.address,
      log_loki_username: engineSettings.logger.loki.username,
      log_loki_password: engineSettings.logger.loki.password,
      log_oia_level: engineSettings.logger.oia.level,
      log_oia_interval: engineSettings.logger.oia.interval,
      log_syslog_level: engineSettings.logger.syslog.level,
      log_syslog_host: engineSettings.logger.syslog.host,
      log_syslog_port: engineSettings.logger.syslog.port,
      log_syslog_protocol: engineSettings.logger.syslog.protocol,
      proxy_enabled: engineSettings.proxyServer.enabled,
      proxy_port: engineSettings.proxyServer.port,
      forward_proxy_enabled: engineSettings.proxyServer.forward.enabled,
      forward_proxy_url: engineSettings.proxyServer.forward.url,
      forward_proxy_username: engineSettings.proxyServer.forward.username,
      forward_proxy_password: engineSettings.proxyServer.forward.password,
      proxy_username: engineSettings.proxyServer.username,
      proxy_password: engineSettings.proxyServer.password,
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
      command_import_configuration: registration.commandPermissions.importConfiguration,
      command_dump_memory: registration.commandPermissions.dumpMemory,
      command_retrieve_logs_database: registration.commandPermissions.retrieveLogsDatabase,
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
        'update-engine-general',
        'update-engine-web-server',
        'update-engine-proxy',
        'update-engine-logger',
        'update-registration-settings',
        'create-or-update-south-items-from-csv',
        'create-scan-mode',
        'update-scan-mode',
        'create-south',
        'update-south',
        'create-north',
        'update-north'
      ].includes(command.type)
        ? (command as OIBusUpdateEngineGeneralCommand).commandContent
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

export const createNorth = async (database: knex.Knex, north: NorthConnectorEntity<NorthSettings>) => {
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

export const createSouth = async (database: knex.Knex, south: SouthConnectorEntity<SouthSettings, SouthItemSettings>) => {
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
      settings: JSON.stringify(item.settings),
      sync_with_group: item.syncWithGroup,
      max_read_interval: item.maxReadInterval,
      read_delay: item.readDelay,
      start_time_offset: item.startTimeOffset,
      end_time_offset: item.endTimeOffset,
      recovery_strategy: item.recoveryStrategy
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

export const createHistoryQuery = async (
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
