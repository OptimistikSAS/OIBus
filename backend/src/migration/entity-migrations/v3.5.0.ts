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
const ENGINES_TABLE = 'engines';

export async function up(knex: Knex): Promise<void> {
  await removeExternalSubscriptions(knex);
  await removeNorthOIBusConnectors(knex);
  await removeNorthOIBusHistoryQueries(knex);
  await updateNorthConnectors(knex);
  await updateSouthConnectors(knex);
  await updateSouthConnectorItems(knex);
  await updateHistoryQueries(knex);
  await updateHistoryQueryItems(knex);
  await updateOIAMessageTable(knex);
  await recreateCommandTable(knex);
  await updateRegistrationSettings(knex);
  await updateEngineTable(knex);
}

async function removeNorthOIBusConnectors(knex: Knex): Promise<void> {
  const northConnectors: Array<{ id: string; name: string }> = await knex(NORTH_CONNECTORS_TABLE)
    .select('id', 'name')
    .where('type', 'oibus');
  for (const north of northConnectors) {
    await knex(SUBSCRIPTION_TABLE).delete().where('north_connector_id', north.id);
    const baseFolder = path.resolve('./cache/data-stream', `north-${north.id}`);
    if (await filesExists(baseFolder)) {
      await fs.rm(baseFolder, { recursive: true });
    }
  }
  await knex(NORTH_CONNECTORS_TABLE).delete().where('type', 'oibus');
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

function toNewOPCUASecurityMode(securityMode: 'None' | 'Sign' | 'SignAndEncrypt'): 'none' | 'sign' | 'sign-and-encrypt' {
  switch (securityMode) {
    case 'None':
      return 'none';
    case 'Sign':
      return 'sign';
    case 'SignAndEncrypt':
      return 'sign-and-encrypt';
  }
}

function toNewOPCUASecurityPolicy(
  securityPolicy:
    | 'None'
    | 'Basic128'
    | 'Basic192'
    | 'Basic256'
    | 'Basic128Rsa15'
    | 'Basic192Rsa15'
    | 'Basic256Rsa15'
    | 'Basic256Sha256'
    | 'Aes128_Sha256_RsaOaep'
    | 'PubSub_Aes128_CTR'
    | 'PubSub_Aes256_CTR'
):
  | 'none'
  | 'basic128'
  | 'basic192'
  | 'basic192-rsa15'
  | 'basic256-rsa15'
  | 'basic256-sha256'
  | 'aes128-sha256-rsa-oaep'
  | 'pub-sub-aes-128-ctr'
  | 'pub-sub-aes-256-ctr' {
  switch (securityPolicy) {
    case 'None':
      return 'none';
    case 'Basic128':
      return 'basic128';
    case 'Basic192':
      return 'basic192';
    case 'Basic256': // obsolete
      return 'basic128';
    case 'Basic128Rsa15': // obsolete
      return 'basic128';
    case 'Basic192Rsa15':
      return 'basic192-rsa15';
    case 'Basic256Rsa15':
      return 'basic256-rsa15';
    case 'Basic256Sha256':
      return 'basic256-sha256';
    case 'Aes128_Sha256_RsaOaep':
      return 'aes128-sha256-rsa-oaep';
    case 'PubSub_Aes128_CTR':
      return 'pub-sub-aes-128-ctr';
    case 'PubSub_Aes256_CTR':
      return 'pub-sub-aes-256-ctr';
  }
}

function toNewModbusEndianness(endianness: 'Big Endian' | 'Little Endian'): 'big-endian' | 'little-endian' {
  switch (endianness) {
    case 'Big Endian':
      return 'big-endian';
    case 'Little Endian':
      return 'little-endian';
  }
}

function toNewModbusAddressOffset(addressOffset: 'Modbus' | 'JBus'): 'modbus' | 'jbus' {
  switch (addressOffset) {
    case 'Modbus':
      return 'modbus';
    case 'JBus':
      return 'jbus';
  }
}

function toNewADSAsText(value: 'Text' | 'Integer'): 'text' | 'integer' {
  switch (value) {
    case 'Text':
      return 'text';
    case 'Integer':
      return 'integer';
  }
}

function toNewAzureBlobAuthentication(
  authentication: 'accessKey' | 'sasToken' | 'aad' | 'external'
): 'access-key' | 'sas-token' | 'aad' | 'external' {
  switch (authentication) {
    case 'external':
      return 'external';
    case 'aad':
      return 'aad';
    case 'accessKey':
      return 'access-key';
    case 'sasToken':
      return 'sas-token';
  }
}

async function updateNorthConnectors(knex: Knex): Promise<void> {
  const oldNorthSettings: Array<{
    id: string;
    type: string;
    settings: string;
  }> = await knex(NORTH_CONNECTORS_TABLE).select('id', 'type', 'settings');
  for (const { id, type, settings } of oldNorthSettings) {
    const newSettings = JSON.parse(settings);
    switch (type) {
      case 'azure-blob':
        newSettings.authentication = toNewAzureBlobAuthentication(newSettings.authentication);
        newSettings.useADLS = false;
        break;
    }
    await knex(NORTH_CONNECTORS_TABLE)
      .update({ settings: JSON.stringify(newSettings) })
      .where('id', id);
  }
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
  }> = await knex(SOUTH_CONNECTORS_TABLE).select(
    'id',
    'type',
    'settings',
    'history_max_read_interval',
    'history_read_delay',
    'history_read_overlap',
    'history_max_instant_per_item'
  );

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
    const newSettings = JSON.parse(settings);
    let southType = type;
    switch (type) {
      case 'ads':
        newSettings.enumAsText = toNewADSAsText(newSettings.enumAsText);
        newSettings.boolAsText = toNewADSAsText(newSettings.boolAsText);
        break;
      case 'modbus':
        newSettings.endianness = toNewModbusEndianness(newSettings.endianness);
        newSettings.addressOffset = toNewModbusAddressOffset(newSettings.addressOffset);
        break;
      case 'mssql':
        newSettings.throttling = {
          maxReadInterval: history_max_read_interval,
          readDelay: history_read_delay,
          overlap: history_read_overlap
        };
        break;
      case 'mysql':
        newSettings.throttling = {
          maxReadInterval: history_max_read_interval,
          readDelay: history_read_delay,
          overlap: history_read_overlap
        };
        break;
      case 'odbc':
        newSettings.throttling = {
          maxReadInterval: history_max_read_interval,
          readDelay: history_read_delay,
          overlap: history_read_overlap
        };
        break;
      case 'oianalytics':
        newSettings.throttling = {
          maxReadInterval: history_max_read_interval,
          readDelay: history_read_delay,
          overlap: history_read_overlap
        };
        break;
      case 'oledb':
        newSettings.throttling = {
          maxReadInterval: history_max_read_interval,
          readDelay: history_read_delay,
          overlap: history_read_overlap
        };
        break;
      case 'opc-hda':
        southType = 'opc';
        newSettings.throttling = {
          maxReadInterval: history_max_read_interval,
          readDelay: history_read_delay,
          overlap: history_read_overlap,
          maxInstantPerItem: history_max_instant_per_item
        };
        break;
      case 'opcua':
        newSettings.sharedConnection = false;
        newSettings.throttling = {
          maxReadInterval: history_max_read_interval,
          readDelay: history_read_delay,
          overlap: history_read_overlap,
          maxInstantPerItem: history_max_instant_per_item
        };
        newSettings.securityMode = toNewOPCUASecurityMode(newSettings.securityMode);
        newSettings.securityPolicy = toNewOPCUASecurityPolicy(newSettings.securityPolicy);
        break;
      case 'oracle':
        newSettings.throttling = {
          maxReadInterval: history_max_read_interval,
          readDelay: history_read_delay,
          overlap: history_read_overlap
        };
        break;
      case 'osisoft-pi':
        newSettings.throttling = {
          maxReadInterval: history_max_read_interval,
          readDelay: history_read_delay,
          overlap: history_read_overlap,
          maxInstantPerItem: history_max_instant_per_item
        };
        break;
      case 'postgresql':
        newSettings.throttling = {
          maxReadInterval: history_max_read_interval,
          readDelay: history_read_delay,
          overlap: history_read_overlap
        };
        break;

      case 'slims':
        newSettings.throttling = {
          maxReadInterval: history_max_read_interval,
          readDelay: history_read_delay,
          overlap: history_read_overlap
        };
        break;
      case 'sqlite':
        newSettings.throttling = {
          maxReadInterval: history_max_read_interval,
          readDelay: history_read_delay,
          overlap: history_read_overlap
        };
        break;
    }
    await knex(SOUTH_CONNECTORS_TABLE)
      .update({ settings: JSON.stringify(newSettings), type: southType })
      .where('id', id);
  }
}

function toNewOPUAItemMode(mode: 'HA' | 'DA'): 'ha' | 'da' {
  switch (mode) {
    case 'HA':
      return 'ha';
    case 'DA':
      return 'da';
  }
}

function toNewModbusDataType(
  modbusType: 'UInt16' | 'Int16' | 'UInt32' | 'Int32' | 'BigUInt64' | 'BigInt64' | 'Float' | 'Double' | 'Bit'
): 'uint16' | 'int16' | 'uint32' | 'int32' | 'big-uint64' | 'big-int64' | 'float' | 'double' | 'bit' {
  switch (modbusType) {
    case 'UInt16':
      return 'uint16';
    case 'Int16':
      return 'int16';
    case 'UInt32':
      return 'uint32';
    case 'Int32':
      return 'uint32';
    case 'BigUInt64':
      return 'big-uint64';
    case 'BigInt64':
      return 'big-int64';
    case 'Float':
      return 'float';
    case 'Double':
      return 'double';
    case 'Bit':
      return 'bit';
  }
}

function toNewModbusRegisterType(
  dataType: 'coil' | 'discreteInput' | 'inputRegister' | 'holdingRegister'
): 'coil' | 'discrete-input' | 'input-register' | 'holding-register' {
  switch (dataType) {
    case 'coil':
      return 'coil';
    case 'discreteInput':
      return 'discrete-input';
    case 'inputRegister':
      return 'input-register';
    case 'holdingRegister':
      return 'holding-register';
  }
}

function toNewOSIsoftPI(type: 'pointId' | 'pointQuery'): 'point-id' | 'point-query' {
  switch (type) {
    case 'pointId':
      return 'point-id';
    case 'pointQuery':
      return 'point-query';
  }
}

async function updateSouthConnectorItems(knex: Knex): Promise<void> {
  const oldItems = await knex(SOUTH_ITEMS_TABLE)
    .join(SOUTH_CONNECTORS_TABLE, `${SOUTH_CONNECTORS_TABLE}.id`, '=', `${SOUTH_ITEMS_TABLE}.connector_id`)
    .select(`${SOUTH_ITEMS_TABLE}.id as id`, `${SOUTH_CONNECTORS_TABLE}.type as type`, `${SOUTH_ITEMS_TABLE}.settings as settings`)
    .whereIn(`${SOUTH_CONNECTORS_TABLE}.type`, ['opcua', 'modbus', 'osisoft-pi']);

  for (const { id, type, settings } of oldItems) {
    const newSettings = JSON.parse(settings);
    switch (type) {
      case 'opcua':
        newSettings.mode = toNewOPUAItemMode(newSettings.mode);
        break;
      case 'modbus':
        newSettings.modbusType = toNewModbusRegisterType(newSettings.modbusType);
        if (newSettings.data) {
          newSettings.data.dataType = toNewModbusDataType(newSettings.data.dataType);
        }
        break;
      case 'osisoft-pi':
        newSettings.type = toNewOSIsoftPI(newSettings.type);
        break;
    }
    await knex(SOUTH_ITEMS_TABLE)
      .update({ settings: JSON.stringify(newSettings) })
      .where('id', id);
  }
}

async function updateHistoryQueries(knex: Knex): Promise<void> {
  const oldSouthSettings: Array<{
    id: string;
    south_type: string;
    north_type: string;
    south_settings: string;
    north_settings: string;
    history_max_read_interval: number;
    history_read_delay: number;
    history_max_instant_per_item: boolean;
  }> = await knex(HISTORY_QUERIES_TABLE).select(
    'id',
    'south_type',
    'north_type',
    'south_settings',
    'north_settings',
    'history_max_read_interval',
    'history_read_delay',
    'history_max_instant_per_item'
  );

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
    north_type,
    south_settings,
    north_settings,
    history_max_read_interval,
    history_read_delay,
    history_max_instant_per_item
  } of oldSouthSettings) {
    const newSouthSettings = JSON.parse(south_settings);
    const newNorthSettings = JSON.parse(north_settings);

    let type = south_type;
    switch (south_type) {
      case 'opc-hda':
        type = 'opc';
        newSouthSettings.throttling = {
          maxReadInterval: history_max_read_interval,
          readDelay: history_read_delay,
          overlap: 0,
          maxInstantPerItem: history_max_instant_per_item
        };
        break;
      case 'opcua':
        newSouthSettings.sharedConnection = false;
        newSouthSettings.throttling = {
          maxReadInterval: history_max_read_interval,
          readDelay: history_read_delay,
          overlap: 0,
          maxInstantPerItem: history_max_instant_per_item
        };
        newSouthSettings.securityMode = toNewOPCUASecurityMode(newSouthSettings.securityMode);
        newSouthSettings.securityPolicy = toNewOPCUASecurityPolicy(newSouthSettings.securityPolicy);
        break;
      case 'osisoft-pi':
        newSouthSettings.throttling = {
          maxReadInterval: history_max_read_interval,
          readDelay: history_read_delay,
          overlap: 0,
          maxInstantPerItem: history_max_instant_per_item
        };
        break;
      case 'mssql':
        newSouthSettings.throttling = {
          maxReadInterval: history_max_read_interval,
          readDelay: history_read_delay,
          overlap: 0
        };
        break;
      case 'mysql':
        newSouthSettings.throttling = {
          maxReadInterval: history_max_read_interval,
          readDelay: history_read_delay,
          overlap: 0
        };
        break;
      case 'odbc':
        newSouthSettings.throttling = {
          maxReadInterval: history_max_read_interval,
          readDelay: history_read_delay,
          overlap: 0
        };
        break;
      case 'oianalytics':
        newSouthSettings.throttling = {
          maxReadInterval: history_max_read_interval,
          readDelay: history_read_delay,
          overlap: 0
        };
        break;
      case 'oledb':
        newSouthSettings.throttling = {
          maxReadInterval: history_max_read_interval,
          readDelay: history_read_delay,
          overlap: 0
        };
        break;
      case 'oracle':
        newSouthSettings.throttling = {
          maxReadInterval: history_max_read_interval,
          readDelay: history_read_delay,
          overlap: 0
        };
        break;
      case 'postgresql':
        newSouthSettings.throttling = {
          maxReadInterval: history_max_read_interval,
          readDelay: history_read_delay,
          overlap: 0
        };
        break;
      case 'slims':
        newSouthSettings.throttling = {
          maxReadInterval: history_max_read_interval,
          readDelay: history_read_delay,
          overlap: 0
        };
        break;
      case 'sqlite':
        newSouthSettings.throttling = {
          maxReadInterval: history_max_read_interval,
          readDelay: history_read_delay,
          overlap: 0
        };
        break;
    }

    switch (north_type) {
      case 'azure-blob':
        newNorthSettings.authentication = toNewAzureBlobAuthentication(newNorthSettings.authentication);
        newNorthSettings.useADLS = false;
        break;
    }

    await knex(HISTORY_QUERIES_TABLE)
      .update({ south_settings: JSON.stringify(newSouthSettings), north_settings: JSON.stringify(newNorthSettings), south_type: type })
      .where('id', id);
  }
}

async function updateHistoryQueryItems(knex: Knex): Promise<void> {
  const oldItems = await knex(HISTORY_ITEMS_TABLE)
    .join(HISTORY_QUERIES_TABLE, `${HISTORY_QUERIES_TABLE}.id`, '=', `${HISTORY_ITEMS_TABLE}.history_id`)
    .select(
      `${HISTORY_ITEMS_TABLE}.id as id`,
      `${HISTORY_QUERIES_TABLE}.south_type as south_type`,
      `${HISTORY_ITEMS_TABLE}.settings as settings`
    )
    .whereIn(`${HISTORY_QUERIES_TABLE}.south_type`, ['opcua', 'osisoft-pi']);

  for (const { id, south_type, settings } of oldItems) {
    const newSettings = JSON.parse(settings);
    switch (south_type) {
      case 'opcua':
        newSettings.mode = toNewOPUAItemMode(newSettings.mode);
        break;
      case 'osisoft-pi':
        newSettings.type = toNewOSIsoftPI(newSettings.type);
        break;
    }
    await knex(HISTORY_ITEMS_TABLE)
      .update({ settings: JSON.stringify(newSettings) })
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

async function updateEngineTable(knex: Knex): Promise<void> {
  await knex.schema.alterTable(ENGINES_TABLE, table => {
    table.string('oibus_launcher_version');
  });
  await knex(ENGINES_TABLE).update({ oibus_launcher_version: '3.4.0' });
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
    table.integer('command_retry_interval');
    table.integer('message_retry_interval');
    table.integer('command_refresh_interval');
    table.boolean('command_update_version');
    table.boolean('command_restart_engine');
    table.boolean('command_regenerate_cipher_keys');
    table.boolean('command_update_engine_settings');
    table.boolean('command_update_registration_settings');
    table.boolean('command_create_scan_mode');
    table.boolean('command_update_scan_mode');
    table.boolean('command_delete_scan_mode');
    table.boolean('command_create_ip_filter');
    table.boolean('command_update_ip_filter');
    table.boolean('command_delete_ip_filter');
    table.boolean('command_create_certificate');
    table.boolean('command_update_certificate');
    table.boolean('command_delete_certificate');
    table.boolean('command_create_history_query');
    table.boolean('command_update_history_query');
    table.boolean('command_delete_history_query');
    table.boolean('command_create_or_update_history_items_from_csv');
    table.boolean('command_create_south');
    table.boolean('command_update_south');
    table.boolean('command_delete_south');
    table.boolean('command_create_or_update_south_items_from_csv');
    table.boolean('command_create_north');
    table.boolean('command_update_north');
    table.boolean('command_delete_north');
  });
  await knex(REGISTRATIONS_TABLE).update({
    command_refresh_interval: 10,
    command_retry_interval: 5,
    message_retry_interval: 5,
    command_update_version: true,
    command_restart_engine: true,
    command_regenerate_cipher_keys: true,
    command_update_engine_settings: true,
    command_update_registration_settings: true,
    command_create_scan_mode: true,
    command_update_scan_mode: true,
    command_delete_scan_mode: true,
    command_create_ip_filter: true,
    command_update_ip_filter: true,
    command_delete_ip_filter: true,
    command_create_certificate: true,
    command_update_certificate: true,
    command_delete_certificate: true,
    command_create_history_query: true,
    command_update_history_query: true,
    command_delete_history_query: true,
    command_create_or_update_history_items_from_csv: true,
    command_create_south: true,
    command_update_south: true,
    command_delete_south: true,
    command_create_or_update_south_items_from_csv: true,
    command_create_north: true,
    command_update_north: true,
    command_delete_north: true
  });
}

export async function down(_knex: Knex): Promise<void> {
  return;
}
