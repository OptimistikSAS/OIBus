import { Knex } from 'knex';

const ENGINES_TABLE = 'engines';
const COMMANDS_TABLE = 'commands';
const REGISTRATIONS_TABLE = 'registrations';
const OIANALYTICS_MESSAGE_TABLE = 'oianalytics_messages';

export async function up(knex: Knex): Promise<void> {
  await removeCommandsEnum(knex);
  await removeEngineLogEnum(knex);
  await removeRegistrationEnum(knex);
  await removeRegistrationEnum(knex);
  await removeOIAnalyticsMessagesEnum(knex);
}

async function removeCommandsEnum(knex: Knex): Promise<void> {
  // STEP 1: Rename the existing ENUM column to a temporary name
  await knex.schema.alterTable(COMMANDS_TABLE, table => {
    table.renameColumn('type', 'type_old');
    table.renameColumn('status', 'status_old');
  });

  // STEP 2: Create the new STRING column
  await knex.schema.alterTable(COMMANDS_TABLE, table => {
    // We re-apply the same defaults and constraints
    table.string('type').notNullable().defaultTo('');
    table.string('status').notNullable().defaultTo('');
  });

  // STEP 3: Copy the data from the old column to the new one
  await knex(COMMANDS_TABLE).update({
    status: knex.ref('status_old'),
    type: knex.ref('type_old')
  });

  // STEP 4: Drop the old column
  await knex.schema.alterTable(COMMANDS_TABLE, table => {
    table.dropColumn('status_old');
    table.dropColumn('type_old');
  });
}

async function removeEngineLogEnum(knex: Knex): Promise<void> {
  // STEP 1: Rename the existing ENUM column to a temporary name
  await knex.schema.alterTable(ENGINES_TABLE, table => {
    table.renameColumn('log_oia_level', 'log_oia_level_old');
    table.renameColumn('log_console_level', 'log_console_level_old');
    table.renameColumn('log_file_level', 'log_file_level_old');
    table.renameColumn('log_database_level', 'log_database_level_old');
    table.renameColumn('log_loki_level', 'log_loki_level_old');
  });

  // STEP 2: Create the new STRING column
  await knex.schema.alterTable(ENGINES_TABLE, table => {
    // We re-apply the same defaults and constraints
    table.string('log_oia_level').notNullable().defaultTo('silent');
    table.string('log_console_level').notNullable().defaultTo('silent');
    table.string('log_file_level').notNullable().defaultTo('silent');
    table.string('log_database_level').notNullable().defaultTo('silent');
    table.string('log_loki_level').notNullable().defaultTo('silent');
  });

  // STEP 3: Copy the data from the old column to the new one
  await knex(ENGINES_TABLE).update({
    log_oia_level: knex.ref('log_oia_level_old'),
    log_console_level: knex.ref('log_console_level_old'),
    log_file_level: knex.ref('log_file_level_old'),
    log_database_level: knex.ref('log_database_level_old'),
    log_loki_level: knex.ref('log_loki_level_old')
  });

  // STEP 4: Drop the old column
  await knex.schema.alterTable(ENGINES_TABLE, table => {
    table.dropColumn('log_oia_level_old');
    table.dropColumn('log_console_level_old');
    table.dropColumn('log_file_level_old');
    table.dropColumn('log_database_level_old');
    table.dropColumn('log_loki_level_old');
  });
}

async function removeRegistrationEnum(knex: Knex): Promise<void> {
  // STEP 1: Rename the existing ENUM column to a temporary name
  await knex.schema.alterTable(REGISTRATIONS_TABLE, table => {
    table.renameColumn('status', 'status_old');
  });

  // STEP 2: Create the new STRING column
  await knex.schema.alterTable(REGISTRATIONS_TABLE, table => {
    // We re-apply the same defaults and constraints
    table.string('status').notNullable().defaultTo('NOT_REGISTERED');
  });

  // STEP 3: Copy the data from the old column to the new one
  await knex(REGISTRATIONS_TABLE).update({
    status: knex.ref('status_old')
  });

  // STEP 4: Drop the old column
  await knex.schema.alterTable(REGISTRATIONS_TABLE, table => {
    table.dropColumn('status_old');
  });
}

async function removeOIAnalyticsMessagesEnum(knex: Knex): Promise<void> {
  // STEP 1: Rename the existing ENUM column to a temporary name
  await knex.schema.alterTable(OIANALYTICS_MESSAGE_TABLE, table => {
    table.renameColumn('status', 'status_old');
  });

  // STEP 2: Create the new STRING column
  await knex.schema.alterTable(OIANALYTICS_MESSAGE_TABLE, table => {
    // We re-apply the same defaults and constraints
    table.string('status').notNullable().defaultTo('PENDING');
  });

  // STEP 3: Copy the data from the old column to the new one
  await knex(OIANALYTICS_MESSAGE_TABLE).update({
    status: knex.ref('status_old')
  });

  // STEP 4: Drop the old column
  await knex.schema.alterTable(OIANALYTICS_MESSAGE_TABLE, table => {
    table.dropColumn('status_old');
  });
}

export async function down(_knex: Knex): Promise<void> {
  return;
}
