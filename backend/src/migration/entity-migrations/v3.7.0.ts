import { Knex } from 'knex';
import { SouthPostgreSQLSettingsThrottling } from '../../../shared/model/south-settings.model';

const TRANSFORMERS_TABLE = 'transformers';
const NORTH_TRANSFORMERS_TABLE = 'north_transformers';
const HISTORY_QUERY_TRANSFORMERS_TABLE = 'history_query_transformers';
const NORTH_CONNECTORS_TABLE = 'north_connectors';
const SOUTH_CONNECTORS_TABLE = 'south_connectors';
const HISTORY_QUERIES_TABLE = 'history_queries';
const REGISTRATIONS_TABLE = 'registrations';

interface OldSouthPostgreSQLSettings {
  throttling: SouthPostgreSQLSettingsThrottling;
  host: string;
  port: number;
  database: string;
  connectionTimeout: number;
  requestTimeout: number;
  username: string | null;
  password: string | null;
}

interface NewSouthPostgreSQLSettings {
  throttling: SouthPostgreSQLSettingsThrottling;
  host: string;
  port: number;
  sslMode: boolean;
  database: string;
  connectionTimeout: number;
  requestTimeout: number;
  username: string | null;
  password: string | null;
}

export async function up(knex: Knex): Promise<void> {
  await createTransformersTable(knex);
  await createNorthTransformersTable(knex);
  await createHistoryTransformersTable(knex);
  await updateRegistrationSettings(knex);
  await updatePostgresqlSettings(knex);

  // TODO on 3.7.1
  // TODO: remove enum on command table
  // made on 3.2 :table.enum('type', OIBUS_COMMAND_TYPES).notNullable();
  //     table.enum('status', OIBUS_COMMAND_STATUS).notNullable();

  // TODO : remove enum on registration
  // table.enum('status', REGISTRATION_STATUS).notNullable().defaultTo('NOT_REGISTERED');

  // TODO: remove enum on oianalytics message
  //     table.enum('status', OIANALYTICS_MESSAGE_STATUS).notNullable().defaultTo('PENDING');

  // TODO : remove enum on engine log level
  // table.enum('log_oia_level', LOG_LEVELS).notNullable().defaultTo('silent');
  // table.enum('log_console_level', LOG_LEVELS).notNullable().defaultTo('silent');
  //     table.enum('log_file_level', LOG_LEVELS).notNullable().defaultTo('silent');
  //     table.enum('log_database_level', LOG_LEVELS).notNullable().defaultTo('silent');
  //table.string('log_loki_level').notNullable().defaultTo('silent');

  // TODO: remove enum on history query
  // table.enum('status', HISTORY_QUERY_STATUS).notNullable().defaultTo('PENDING');

  // TODO on log migration: remove enum on logs
  // table.enum('level', LOG_LEVELS).notNullable();
  // table.enum('scope_type', SCOPE_TYPES).notNullable();
}

async function createTransformersTable(knex: Knex): Promise<void> {
  await knex.schema.createTable(TRANSFORMERS_TABLE, table => {
    table.uuid('id').primary();
    table.timestamps(false, true);
    table.string('type').notNullable();
    table.string('input_type').notNullable();
    table.string('output_type').notNullable();
    // standard
    table.string('function_name');
    // custom
    table.string('name');
    table.string('description');
    table.string('custom_manifest');
    table.string('custom_code');
  });
}

async function createNorthTransformersTable(knex: Knex): Promise<void> {
  await knex.schema.createTable(NORTH_TRANSFORMERS_TABLE, table => {
    table.uuid('north_id').notNullable().references('id').inTable(NORTH_CONNECTORS_TABLE);
    table.uuid('transformer_id').notNullable().references('id').inTable(TRANSFORMERS_TABLE);
    table.string('options');
    table.string('input_type');
    table.unique(['north_id', 'transformer_id', 'input_type']);
  });
}

async function createHistoryTransformersTable(knex: Knex): Promise<void> {
  await knex.schema.createTable(HISTORY_QUERY_TRANSFORMERS_TABLE, table => {
    table.uuid('history_id').notNullable().references('id').inTable(HISTORY_QUERIES_TABLE);
    table.uuid('transformer_id').notNullable().references('id').inTable(TRANSFORMERS_TABLE);
    table.string('options');
    table.string('input_type');
    table.unique(['history_id', 'transformer_id', 'input_type']);
  });
}

async function updateRegistrationSettings(knex: Knex): Promise<void> {
  await knex.schema.alterTable(REGISTRATIONS_TABLE, table => {
    table.boolean('command_setpoint');
  });
  await knex(REGISTRATIONS_TABLE).update({
    command_setpoint: true
  });
}

async function updatePostgresqlSettings(knex: Knex) {
  const oldSouth: Array<{
    id: string;
    type: string;
    settings: string;
  }> = await knex(SOUTH_CONNECTORS_TABLE).select('id', 'type', 'settings').where('type', 'postgresql');

  for (const connector of oldSouth) {
    const oldSettings = JSON.parse(connector.settings) as OldSouthPostgreSQLSettings;
    const newSettings: NewSouthPostgreSQLSettings = { ...oldSettings, sslMode: false };
    await knex(SOUTH_CONNECTORS_TABLE)
      .update({ settings: JSON.stringify(newSettings) })
      .where('id', connector.id);
  }

  const oldHistory: Array<{
    id: string;
    south_type: string;
    south_settings: string;
  }> = await knex(HISTORY_QUERIES_TABLE).select('id', 'south_type', 'south_settings').where('south_type', 'postgresql');

  for (const history of oldHistory) {
    const oldSettings = JSON.parse(history.south_settings) as OldSouthPostgreSQLSettings;
    const newSettings: NewSouthPostgreSQLSettings = { ...oldSettings, sslMode: false };
    await knex(HISTORY_QUERIES_TABLE)
      .update({ south_settings: JSON.stringify(newSettings) })
      .where('id', history.id);
  }
}

export async function down(_knex: Knex): Promise<void> {
  return;
}
