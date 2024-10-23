import { Knex } from 'knex';
import path from 'node:path';
import { filesExists } from '../../service/utils';
import fs from 'node:fs/promises';
import {
  SouthOPCUASettingsAuthentication,
  SouthOPCUASettingsSecurityMode,
  SouthOPCUASettingsSecurityPolicy
} from '../../../shared/model/south-settings.model';

const NORTH_CONNECTORS_TABLE = 'north_connectors';
const SOUTH_CONNECTORS_TABLE = 'south_connectors';
const HISTORY_QUERIES_TABLE = 'history_queries';
const HISTORY_ITEMS_TABLE = 'history_items';
const EXTERNAL_SOURCES_TABLE = 'external_sources';
const EXTERNAL_SUBSCRIPTION_TABLE = 'external_subscription';
const OIANALYTICS_MESSAGE_TABLE = 'oianalytics_messages';
const REGISTRATIONS_TABLE = 'registrations';
const COMMANDS_TABLE = 'commands';

export interface OldSouthOPCUASettings {
  url: string;
  keepSessionAlive: boolean;
  retryInterval: number;
  readTimeout: number;
  securityMode: SouthOPCUASettingsSecurityMode;
  securityPolicy?: SouthOPCUASettingsSecurityPolicy | null;
  authentication: SouthOPCUASettingsAuthentication;
}

export interface NewSouthOPCUASettings {
  sharedConnection: boolean;
  url: string;
  keepSessionAlive: boolean;
  retryInterval: number;
  readTimeout: number;
  securityMode: SouthOPCUASettingsSecurityMode;
  securityPolicy?: SouthOPCUASettingsSecurityPolicy | null;
  authentication: SouthOPCUASettingsAuthentication;
}

export async function up(knex: Knex): Promise<void> {
  await removeNorthOIBusConnectors(knex);
  await removeNorthOIBusHistoryQueries(knex);
  await removeExternalSubscriptions(knex);
  await updateOPCUASouthConnectorsTable(knex);
  await updateOPCUAHistoryQueriesTable(knex);
  await updateOIAMessageTable(knex);
  await recreateCommandTable(knex);
  await updateRegistrationSettings(knex);
}

async function removeNorthOIBusConnectors(knex: Knex): Promise<void> {
  const northConnectors: Array<{ id: string; name: string }> = await knex(NORTH_CONNECTORS_TABLE)
    .select('id', 'name')
    .where('type', 'oibus');
  await knex(NORTH_CONNECTORS_TABLE).delete().where('type', 'oibus');
  for (const north of northConnectors) {
    const baseFolder = path.resolve('./cache/data-stream', `north-${north.id}`);
    if (await filesExists(baseFolder)) {
      await fs.rm(baseFolder, { recursive: true });
    }
  }
}

async function removeNorthOIBusHistoryQueries(knex: Knex): Promise<void> {
  const historyQueries: Array<{ id: string; name: string }> = await knex(HISTORY_QUERIES_TABLE)
    .select('id', 'name')
    .where('north_type', 'oibus');

  for (const history of historyQueries) {
    await knex(HISTORY_ITEMS_TABLE).delete().where('history_id', history.id);
    const baseFolder = path.resolve('./cache/history-query', `history-${history.id}`);
    if (await filesExists(baseFolder)) {
      await fs.rm(baseFolder, { recursive: true });
    }
  }
  await knex(HISTORY_QUERIES_TABLE).delete().where('north_type', 'oibus');
}

async function removeExternalSubscriptions(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(EXTERNAL_SUBSCRIPTION_TABLE);
  await knex.schema.dropTableIfExists(EXTERNAL_SOURCES_TABLE);
}

async function updateOPCUASouthConnectorsTable(knex: Knex): Promise<void> {
  const oldSouthSettings: Array<{ id: string; settings: string }> = await knex(SOUTH_CONNECTORS_TABLE)
    .select('id', 'settings')
    .where('type', 'opcua');

  for (const { id, settings } of oldSouthSettings) {
    const newSettings: NewSouthOPCUASettings = {
      ...(JSON.parse(settings) as OldSouthOPCUASettings),
      sharedConnection: false
    };
    await knex(SOUTH_CONNECTORS_TABLE)
      .update({ settings: JSON.stringify(newSettings) })
      .where('id', id);
  }
}

async function updateOPCUAHistoryQueriesTable(knex: Knex): Promise<void> {
  const oldSouthSettings: Array<{ id: string; settings: string }> = await knex(HISTORY_QUERIES_TABLE)
    .select('id', 'south_settings as settings')
    .where('south_type', 'opcua');

  for (const { id, settings } of oldSouthSettings) {
    const newSettings: NewSouthOPCUASettings = {
      ...(JSON.parse(settings) as OldSouthOPCUASettings),
      sharedConnection: false
    };
    await knex(HISTORY_QUERIES_TABLE)
      .update({ south_settings: JSON.stringify(newSettings) })
      .where('id', id);
  }
}

async function updateOIAMessageTable(knex: Knex): Promise<void> {
  await knex.schema.raw(`delete
                         from ${OIANALYTICS_MESSAGE_TABLE}`);
  await knex.schema.alterTable(OIANALYTICS_MESSAGE_TABLE, table => {
    table.dropColumn('content');
  });
}

async function recreateCommandTable(knex: Knex): Promise<void> {
  await knex.schema.raw(
    `create table temporary_table
     (
       id               char(36) primary key,
       created_at       datetime default CURRENT_TIMESTAMP not null,
       updated_at       datetime default CURRENT_TIMESTAMP not null,
       type             text                               not null,
       status           text                               not null,
       ack              boolean  default '0'               not null,
       retrieved_date   varchar(255),
       completed_date   varchar(255),
       result           varchar(255),
       upgrade_version  varchar(255),
       upgrade_asset_id varchar(255),
       command_content  text,
       target_version   text                               not null
     );
    `
  );
  await knex.schema.raw(`INSERT INTO temporary_table
                         SELECT *, '', 'v3.5.0'
                         FROM ${COMMANDS_TABLE}`);
  await knex.schema.raw(`DROP TABLE ${COMMANDS_TABLE}`);
  await knex.schema.raw(`ALTER TABLE temporary_table
    RENAME TO ${COMMANDS_TABLE}`);
  await knex.schema.alterTable(COMMANDS_TABLE, table => {
    table.string('south_connector_id', 255);
    table.string('north_connector_id', 255);
    table.string('scan_mode_id', 255);
  });
}

async function updateRegistrationSettings(knex: Knex): Promise<void> {
  await knex.schema.alterTable(REGISTRATIONS_TABLE, table => {
    table.string('public_key');
    table.string('private_key');
  });
}

export async function down(_knex: Knex): Promise<void> {
  return;
}
