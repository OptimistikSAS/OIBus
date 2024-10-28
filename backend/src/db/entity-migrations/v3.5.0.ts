import { Knex } from 'knex';
import path from 'node:path';
import { filesExists } from '../../service/utils';
import fs from 'node:fs/promises';

const NORTH_CONNECTORS_TABLE = 'north_connectors';
const SOUTH_CONNECTORS_TABLE = 'south_connectors';
const HISTORY_QUERIES_TABLE = 'history_queries';
const HISTORY_ITEMS_TABLE = 'history_items';
const EXTERNAL_SOURCES_TABLE = 'external_sources';
const EXTERNAL_SUBSCRIPTION_TABLE = 'external_subscription';
const OIANALYTICS_MESSAGE_TABLE = 'oianalytics_messages';
const REGISTRATIONS_TABLE = 'registrations';
const COMMANDS_TABLE = 'commands';
const SOUTH_ITEMS_TABLE = 'south_items';
const SUBSCRIPTION_TABLE = 'subscription';
const SCAN_MODES_TABLE = 'scan_modes';

export async function up(knex: Knex): Promise<void> {
  await removeNorthOIBusConnectors(knex);
  await removeNorthOIBusHistoryQueries(knex);
  await removeExternalSubscriptions(knex);
  await updateSouthConnectors(knex);
  await updateHistoryQueries(knex);
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

async function updateSouthConnectors(knex: Knex): Promise<void> {
  const oldSouthSettings: Array<{
    id: string;
    type: string;
    settings: string;
    history_max_read_interval: number;
    history_read_delay: number;
    history_read_overlap: number;
    history_max_instant_per_item: boolean;
  }> = await knex(SOUTH_CONNECTORS_TABLE)
    .select(
      'id',
      'type',
      'settings',
      'history_max_read_interval',
      'history_read_delay',
      'history_read_overlap',
      'history_max_instant_per_item'
    )
    .whereIn('type', [
      'mssql',
      'mysql',
      'odbc',
      'oianalytics',
      'oledb',
      'opc-hda',
      'opcua',
      'oracle',
      'osisoft-pi',
      'postgresql',
      'slims',
      'sqlite'
    ]);

  await knex.transaction(async trx => {
    await trx.raw('PRAGMA foreign_keys = OFF;');

    // South items table for foreign key management
    await trx.schema.raw(`create table ${SOUTH_ITEMS_TABLE}_dg_tmp(id             char(36) primary key,
                                                                   created_at     datetime default CURRENT_TIMESTAMP not null,
                                                                   updated_at     datetime default CURRENT_TIMESTAMP not null,
                                                                   connector_id   char(36)                           not null,
                                                                   scan_mode_id   char(36)                           not null,
                                                                   name           varchar(255)                       not null,
                                                                   enabled        boolean                            not null,
                                                                   settings       json                               not null);`);

    await trx.schema
      .raw(`insert into ${SOUTH_ITEMS_TABLE}_dg_tmp(id, created_at, updated_at, connector_id, scan_mode_id, name, enabled, settings)
            select id,
                   created_at,
                   updated_at,
                   connector_id,
                   scan_mode_id,
                   name,
                   enabled,
                   settings
            from ${SOUTH_ITEMS_TABLE};`);

    await trx.schema.raw(`drop table ${SOUTH_ITEMS_TABLE};`);

    await trx.schema.raw(`alter table ${SOUTH_ITEMS_TABLE}_dg_tmp rename to ${SOUTH_ITEMS_TABLE};`);

    await trx.schema.raw(`create unique index ${SOUTH_ITEMS_TABLE}_connector_id_name_unique on ${SOUTH_ITEMS_TABLE} (connector_id, name);`);

    // Subscription table for foreign key management
    await trx.schema.raw(`create table ${SUBSCRIPTION_TABLE}_dg_tmp(created_at           datetime default CURRENT_TIMESTAMP not null,
                                                                    updated_at           datetime default CURRENT_TIMESTAMP not null,
                                                                    north_connector_id   char(36)                           not null,
                                                                    south_connector_id   char(36)                           not null,
                                                                    PRIMARY KEY (north_connector_id, south_connector_id));`);

    await trx.schema.raw(`insert into ${SUBSCRIPTION_TABLE}_dg_tmp(created_at, updated_at, north_connector_id, south_connector_id)
            select created_at, updated_at, north_connector_id, south_connector_id from ${SUBSCRIPTION_TABLE};`);

    await trx.schema.raw(`drop table ${SUBSCRIPTION_TABLE};`);

    await trx.schema.raw(`alter table ${SUBSCRIPTION_TABLE}_dg_tmp rename to ${SUBSCRIPTION_TABLE};`);

    // South connectors migration
    await trx.schema.raw(`create table ${SOUTH_CONNECTORS_TABLE}_dg_tmp(
                        id          char(36) primary key,
                        created_at  datetime default CURRENT_TIMESTAMP not null,
                        updated_at  datetime default CURRENT_TIMESTAMP not null,
                        name        varchar(255)                       not null,
                        type        varchar(255)                       not null,
                        description varchar(255),
                        enabled     boolean                            not null,
                        settings    json                               not null);`);
    await trx.schema
      .raw(`insert into ${SOUTH_CONNECTORS_TABLE}_dg_tmp(id, created_at, updated_at, name, type, description, enabled, settings)
                    select id,
                      created_at,
                      updated_at,
                      name,
                      type,
                      description,
                      enabled,
                      settings
                    from ${SOUTH_CONNECTORS_TABLE};`);

    await trx.schema.raw(`drop table ${SOUTH_CONNECTORS_TABLE};`);

    await trx.schema.raw(`alter table ${SOUTH_CONNECTORS_TABLE}_dg_tmp rename to ${SOUTH_CONNECTORS_TABLE};`);

    await trx.schema.raw(`create unique index ${SOUTH_CONNECTORS_TABLE}_name_unique on ${SOUTH_CONNECTORS_TABLE} (name);`);

    await trx.schema.table(SOUTH_ITEMS_TABLE, table => {
      table.foreign('connector_id').references('id').inTable(SOUTH_CONNECTORS_TABLE);
      table.foreign('scan_mode_id').references('id').inTable(SCAN_MODES_TABLE);
    });

    await trx.schema.table(SUBSCRIPTION_TABLE, table => {
      table.foreign('north_connector_id').references('id').inTable(NORTH_CONNECTORS_TABLE);
      table.foreign('south_connector_id').references('id').inTable(SOUTH_CONNECTORS_TABLE);
    });

    await trx.raw('PRAGMA foreign_keys = ON;');

    await trx.commit();
  });

  for (const {
    id,
    type,
    settings,
    history_max_read_interval,
    history_read_delay,
    history_read_overlap,
    history_max_instant_per_item
  } of oldSouthSettings) {
    let newSettings;
    let southType = type;
    switch (type) {
      case 'opc-hda':
        southType = 'opc';
        newSettings = {
          ...JSON.parse(settings),
          sharedConnection: false,
          throttling: {
            maxReadInterval: history_max_read_interval,
            readDelay: history_read_delay,
            overlap: history_read_overlap,
            maxInstantPerItem: history_max_instant_per_item
          }
        };
        break;
      case 'opcua':
      case 'osisoft-pi':
        newSettings = {
          ...JSON.parse(settings),
          sharedConnection: false,
          throttling: {
            maxReadInterval: history_max_read_interval,
            readDelay: history_read_delay,
            overlap: history_read_overlap,
            maxInstantPerItem: history_max_instant_per_item
          }
        };
        break;
      default:
        newSettings = {
          ...JSON.parse(settings),
          throttling: {
            maxReadInterval: history_max_read_interval,
            readDelay: history_read_delay,
            overlap: history_read_overlap
          }
        };
        break;
    }
    await knex(SOUTH_CONNECTORS_TABLE)
      .update({ settings: JSON.stringify(newSettings), type: southType })
      .where('id', id);
  }
}

async function updateHistoryQueries(knex: Knex): Promise<void> {
  const oldSouthSettings: Array<{
    id: string;
    south_type: string;
    south_settings: string;
    history_max_read_interval: number;
    history_read_delay: number;
    history_max_instant_per_item: boolean;
  }> = await knex(HISTORY_QUERIES_TABLE)
    .select('id', 'south_type', 'south_settings', 'history_max_read_interval', 'history_read_delay', 'history_max_instant_per_item')
    .whereIn('south_type', [
      'mssql',
      'mysql',
      'odbc',
      'oianalytics',
      'oledb',
      'opc-hda',
      'opcua',
      'oracle',
      'osisoft-pi',
      'postgresql',
      'slims',
      'sqlite'
    ]);

  await knex.transaction(async trx => {
    await trx.raw('PRAGMA foreign_keys = OFF;');

    // History query items table for foreign key management
    await trx.schema.raw(`create table ${HISTORY_ITEMS_TABLE}_dg_tmp(id             char(36) primary key,
                                                                   created_at     datetime default CURRENT_TIMESTAMP not null,
                                                                   updated_at     datetime default CURRENT_TIMESTAMP not null,
                                                                   history_id   char(36)                           not null,
                                                                   name           varchar(255)                       not null,
                                                                   enabled        boolean                            not null,
                                                                   settings       json                               not null);`);

    await trx.schema.raw(`insert into ${HISTORY_ITEMS_TABLE}_dg_tmp(id, created_at, updated_at, history_id, name, enabled, settings)
            select id,
                   created_at,
                   updated_at,
                   history_id,
                   name,
                   enabled,
                   settings
            from ${HISTORY_ITEMS_TABLE};`);

    await trx.schema.raw(`drop table ${HISTORY_ITEMS_TABLE};`);

    await trx.schema.raw(`alter table ${HISTORY_ITEMS_TABLE}_dg_tmp rename to ${HISTORY_ITEMS_TABLE};`);

    await trx.schema.raw(`create unique index ${HISTORY_ITEMS_TABLE}_history_id_name_unique on ${HISTORY_ITEMS_TABLE} (history_id, name);`);

    // History query table
    await trx.schema.raw(`create table ${HISTORY_QUERIES_TABLE}_dg_tmp
                             (
                               id                            char(36) primary key,
                               created_at                    datetime default CURRENT_TIMESTAMP not null,
                               updated_at                    datetime default CURRENT_TIMESTAMP not null,
                               status                        text     default 'PENDING'         not null,
                               name                          varchar(255)                       not null,
                               description                   varchar(255),
                               start_time                    datetime                           not null,
                               end_time                      datetime                           not null,
                               south_type                    varchar(255)                       not null,
                               north_type                    varchar(255)                       not null,
                               south_settings                json                               not null,
                               north_settings                json                               not null,
                               caching_scan_mode_id          varchar(255)                       not null references scan_modes,
                               caching_group_count           integer                            not null,
                               caching_retry_interval        integer                            not null,
                               caching_retry_count           integer                            not null,
                               caching_max_send_count        integer                            not null,
                               caching_send_file_immediately integer                            not null,
                               caching_max_size              integer                            not null,
                               archive_enabled               integer                            not null,
                               archive_retention_duration    integer                            not null
                             );
      `);

    await trx.schema.raw(`insert into ${HISTORY_QUERIES_TABLE}_dg_tmp(id, created_at, updated_at, status, name, description,
                                                          start_time, end_time,
                                                          south_type, north_type, south_settings, north_settings,
                                                          caching_scan_mode_id,
                                                          caching_group_count, caching_retry_interval,
                                                          caching_retry_count,
                                                          caching_max_send_count, caching_send_file_immediately,
                                                          caching_max_size,
                                                          archive_enabled, archive_retention_duration)
              select id,
                     created_at,
                     updated_at,
                     status,
                     name,
                     description,
                     start_time,
                     end_time,
                     south_type,
                     north_type,
                     south_settings,
                     north_settings,
                     caching_scan_mode_id,
                     caching_group_count,
                     caching_retry_interval,
                     caching_retry_count,
                     caching_max_send_count,
                     caching_send_file_immediately,
                     caching_max_size,
                     archive_enabled,
                     archive_retention_duration
              from ${HISTORY_QUERIES_TABLE};`);

    await trx.schema.raw(`drop table ${HISTORY_QUERIES_TABLE};`);

    await trx.schema.raw(`alter table ${HISTORY_QUERIES_TABLE}_dg_tmp rename to ${HISTORY_QUERIES_TABLE};`);

    await trx.schema.raw(`create unique index ${HISTORY_QUERIES_TABLE}_name_unique on ${HISTORY_QUERIES_TABLE} (name);`);

    await trx.schema.table(HISTORY_ITEMS_TABLE, table => {
      table.foreign('history_id').references('id').inTable(HISTORY_QUERIES_TABLE);
    });

    await trx.raw('PRAGMA foreign_keys = ON;');

    await trx.commit();
  });

  for (const {
    id,
    south_type,
    south_settings,
    history_max_read_interval,
    history_read_delay,
    history_max_instant_per_item
  } of oldSouthSettings) {
    let newSettings;
    let type = south_type;
    switch (south_type) {
      case 'opc-hda':
        type = 'opc';
        newSettings = {
          ...JSON.parse(south_settings),
          sharedConnection: false,
          throttling: {
            maxReadInterval: history_max_read_interval,
            readDelay: history_read_delay,
            overlap: 0,
            maxInstantPerItem: history_max_instant_per_item
          }
        };
        break;
      case 'opcua':
      case 'osisoft-pi':
        newSettings = {
          ...JSON.parse(south_settings),
          sharedConnection: false,
          throttling: {
            maxReadInterval: history_max_read_interval,
            readDelay: history_read_delay,
            overlap: 0,
            maxInstantPerItem: history_max_instant_per_item
          }
        };
        break;
      default:
        newSettings = {
          ...JSON.parse(south_settings),
          throttling: {
            maxReadInterval: history_max_read_interval,
            readDelay: history_read_delay,
            overlap: 0
          }
        };
        break;
    }
    await knex(HISTORY_QUERIES_TABLE)
      .update({ south_settings: JSON.stringify(newSettings), south_type: type })
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
  const oldUpdateCommands: Array<{ id: string; type: string; upgrade_version: string; upgrade_asset_id: string }> = await knex(
    COMMANDS_TABLE
  )
    .select('id', 'type', 'upgrade_version', 'upgrade_asset_id')
    .whereIn('type', ['update-version', 'UPGRADE']);

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
       command_content  text,
       target_version   text                               not null
     );
    `
  );
  await knex.schema.raw(`INSERT INTO temporary_table
                         SELECT id, created_at, updated_at, type, status, ack, retrieved_date, completed_date, result, '', 'v3.5.0'
                         FROM ${COMMANDS_TABLE}`);
  await knex.schema.raw(`DROP TABLE ${COMMANDS_TABLE}`);
  await knex.schema.raw(`ALTER TABLE temporary_table
    RENAME TO ${COMMANDS_TABLE}`);
  await knex.schema.alterTable(COMMANDS_TABLE, table => {
    table.string('south_connector_id', 255);
    table.string('north_connector_id', 255);
    table.string('scan_mode_id', 255);
  });
  for (const { id, upgrade_version, upgrade_asset_id } of oldUpdateCommands) {
    const newCommandContent = {
      version: upgrade_version,
      assetId: upgrade_asset_id,
      updateLauncher: false,
      backupFolders: '*'
    };

    await knex(COMMANDS_TABLE)
      .update({ command_content: JSON.stringify(newCommandContent), type: 'update-version' })
      .where('id', id);
  }
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
