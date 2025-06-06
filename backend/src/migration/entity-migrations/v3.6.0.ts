import { Knex } from 'knex';
import {
  SouthMQTTSettingsAuthentication,
  SouthMQTTSettingsQos,
  SouthOPCSettingsMode,
  SouthOPCSettingsThrottling
} from '../../../shared/model/south-settings.model';

const OIANALYTICS_MESSAGE_TABLE = 'oianalytics_messages';
const COMMANDS_TABLE = 'commands';
const REGISTRATIONS_TABLE = 'registrations';
const NORTH_CONNECTORS_TABLE = 'north_connectors';
const HISTORY_QUERIES_TABLE = 'history_queries';
const HISTORY_ITEMS_TABLE = 'history_items';
const SOUTH_CONNECTORS_TABLE = 'south_connectors';
const SOUTH_ITEMS_TABLE = 'south_items';
const SUBSCRIPTION_TABLE = 'subscription';

interface OldSouthMQTTSettings {
  url: string;
  qos: SouthMQTTSettingsQos;
  persistent?: boolean;
  authentication: SouthMQTTSettingsAuthentication;
  rejectUnauthorized: boolean;
  reconnectPeriod: number;
  connectTimeout: number;
}

interface NewSouthMQTTSettings {
  url: string;
  qos: SouthMQTTSettingsQos;
  persistent?: boolean;
  authentication: SouthMQTTSettingsAuthentication;
  rejectUnauthorized: boolean;
  reconnectPeriod: number;
  connectTimeout: number;
  maxNumberOfMessages: number;
  flushMessageTimeout: number;
}

interface OldSouthOPCSettings {
  throttling: SouthOPCSettingsThrottling;
  agentUrl: string;
  retryInterval: number;
  host: string;
  serverName: string;
}

interface NewSouthOPCSettings {
  throttling: SouthOPCSettingsThrottling;
  agentUrl: string;
  retryInterval: number;
  host: string;
  serverName: string;
  mode: SouthOPCSettingsMode;
}

export async function up(knex: Knex): Promise<void> {
  await updateOIAMessageTable(knex);
  await updateOIACommandTable(knex);
  await updateRegistrationSettings(knex);
  await updateNorthConnectors(knex);
  await updateHistoryQueries(knex);
  await updateSouthMQTTSettings(knex);
  await updateSouthOPCSettings(knex);
  await removeSouthSLIMS(knex);
}

async function updateSouthOPCSettings(knex: Knex) {
  const oldSouthSettings: Array<{
    id: string;
    type: string;
    settings: string;
  }> = await knex(SOUTH_CONNECTORS_TABLE).select('id', 'type', 'settings').where('type', 'opc');

  for (const connector of oldSouthSettings) {
    const oldSettings: OldSouthOPCSettings = JSON.parse(connector.settings);
    const newSettings: NewSouthOPCSettings = {
      ...oldSettings,
      mode: 'hda'
    };
    await knex(SOUTH_CONNECTORS_TABLE)
      .update({ settings: JSON.stringify(newSettings) })
      .where('id', connector.id);
  }

  const oldSouthHistorySettings: Array<{
    id: string;
    south_type: string;
    south_settings: string;
  }> = await knex(HISTORY_QUERIES_TABLE).select('id', 'south_type', 'south_settings').where('south_type', 'opc');

  for (const history of oldSouthHistorySettings) {
    const oldSettings: OldSouthOPCSettings = JSON.parse(history.south_settings);
    const newSettings: NewSouthOPCSettings = {
      ...oldSettings,
      mode: 'hda'
    };
    await knex(HISTORY_QUERIES_TABLE)
      .update({ south_settings: JSON.stringify(newSettings) })
      .where('id', history.id);
  }
}

async function updateSouthMQTTSettings(knex: Knex) {
  const oldSouthSettings: Array<{
    id: string;
    type: string;
    settings: string;
  }> = await knex(SOUTH_CONNECTORS_TABLE).select('id', 'type', 'settings').where('type', 'mqtt');

  for (const connector of oldSouthSettings) {
    const oldSettings: OldSouthMQTTSettings = JSON.parse(connector.settings);
    const newSettings: NewSouthMQTTSettings = {
      ...oldSettings,
      maxNumberOfMessages: 1_000,
      flushMessageTimeout: 1_000
    };
    await knex(SOUTH_CONNECTORS_TABLE)
      .update({ settings: JSON.stringify(newSettings) })
      .where('id', connector.id);
  }
}

async function updateOIAMessageTable(knex: Knex): Promise<void> {
  await knex.schema.alterTable(OIANALYTICS_MESSAGE_TABLE, table => {
    table.string('history_id');
  });
}

async function updateOIACommandTable(knex: Knex): Promise<void> {
  await knex.schema.alterTable(COMMANDS_TABLE, table => {
    table.string('certificate_id');
    table.string('ip_filter_id');
    table.string('history_id');
    table.string('item_id');
  });
}

async function updateRegistrationSettings(knex: Knex): Promise<void> {
  await knex.schema.alterTable(REGISTRATIONS_TABLE, table => {
    table.boolean('command_test_south_connection');
    table.boolean('command_test_south_item');
    table.boolean('command_test_north_connection');
    table.boolean('command_test_history_north_connection');
    table.boolean('command_test_history_south_connection');
    table.boolean('command_test_history_south_item');
  });
  await knex(REGISTRATIONS_TABLE).update({
    command_test_south_connection: true,
    command_test_south_item: true,
    command_test_north_connection: true,
    command_test_history_south_connection: true,
    command_test_history_south_item: true,
    command_test_history_north_connection: true
  });
}

async function updateNorthConnectors(knex: Knex): Promise<void> {
  await knex.schema.alterTable(NORTH_CONNECTORS_TABLE, table => {
    table.integer('caching_throttling_run_min_delay');
    table.integer('caching_error_retention_duration');
    table.renameColumn('caching_scan_mode_id', 'caching_trigger_schedule');
    table.renameColumn('caching_group_count', 'caching_trigger_number_of_elements');
    table.renameColumn('caching_max_size', 'caching_throttling_cache_max_size');
    table.renameColumn('caching_max_send_count', 'caching_throttling_max_number_of_elements');
    table.renameColumn('caching_send_file_immediately', 'caching_trigger_number_of_files');
    table.renameColumn('caching_retry_interval', 'caching_error_retry_interval');
    table.renameColumn('caching_retry_count', 'caching_error_retry_count');
    table.renameColumn('archive_enabled', 'caching_archive_enabled');
    table.renameColumn('archive_retention_duration', 'caching_archive_retention_duration');
  });

  // Update the new column based on the old boolean column
  await knex(NORTH_CONNECTORS_TABLE).update({
    caching_trigger_number_of_files: knex.raw('CAST(caching_trigger_number_of_files AS INTEGER)'),
    caching_throttling_run_min_delay: 200,
    caching_error_retention_duration: 0
  });
}

async function updateHistoryQueries(knex: Knex): Promise<void> {
  await knex.schema.alterTable(HISTORY_QUERIES_TABLE, table => {
    table.integer('caching_throttling_run_min_delay');
    table.integer('caching_error_retention_duration');
    table.renameColumn('caching_scan_mode_id', 'caching_trigger_schedule');
    table.renameColumn('caching_group_count', 'caching_trigger_number_of_elements');
    table.renameColumn('caching_max_size', 'caching_throttling_cache_max_size');
    table.renameColumn('caching_max_send_count', 'caching_throttling_max_number_of_elements');
    table.renameColumn('caching_send_file_immediately', 'caching_trigger_number_of_files');
    table.renameColumn('caching_retry_interval', 'caching_error_retry_interval');
    table.renameColumn('caching_retry_count', 'caching_error_retry_count');
    table.renameColumn('archive_enabled', 'caching_archive_enabled');
    table.renameColumn('archive_retention_duration', 'caching_archive_retention_duration');
  });

  // Update the new column based on the old boolean column
  await knex(HISTORY_QUERIES_TABLE).update({
    caching_trigger_number_of_files: knex.raw('CAST(caching_trigger_number_of_elements AS INTEGER)'),
    caching_throttling_run_min_delay: 200,
    caching_error_retention_duration: 0
  });
}

async function removeSouthSLIMS(knex: Knex): Promise<void> {
  const southSlims: Array<{
    id: string;
    type: string;
  }> = await knex(SOUTH_CONNECTORS_TABLE).select('id', 'type').where('type', 'slims');

  for (const south of southSlims) {
    await knex(SUBSCRIPTION_TABLE).delete().where('south_connector_id', south.id);
    await knex(SOUTH_ITEMS_TABLE).delete().where('connector_id', south.id);
    await knex(SOUTH_CONNECTORS_TABLE).delete().where('id', south.id);
  }

  const historySlims: Array<{
    id: string;
    south_type: string;
  }> = await knex(HISTORY_QUERIES_TABLE).select('id', 'south_type').where('south_type', 'slims');

  for (const history of historySlims) {
    await knex(HISTORY_ITEMS_TABLE).delete().where('history_id', history.id);
    await knex(HISTORY_QUERIES_TABLE).delete().where('id', history.id);
  }
}

export async function down(_knex: Knex): Promise<void> {
  return;
}
