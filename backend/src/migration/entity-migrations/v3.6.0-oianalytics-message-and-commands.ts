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
const SOUTH_CONNECTORS_TABLE = 'south_connectors';
const HISTORY_QUERIES_TABLE = 'history_queries';

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

  await updateSouthMQTTSettings(knex);
  await updateSouthOPCSettings(knex);
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

export async function down(_knex: Knex): Promise<void> {
  return;
}
