import { Knex } from 'knex';

const LOG_TABLE = 'logs';

export async function up(knex: Knex): Promise<void> {
  await removeLogsEnum(knex);
}

async function removeLogsEnum(knex: Knex): Promise<void> {
  // STEP 1: Rename the existing ENUM column to a temporary name
  await knex.schema.alterTable(LOG_TABLE, table => {
    table.renameColumn('scope_type', 'scope_type_old');
    table.renameColumn('level', 'level_old');
  });

  // STEP 2: Create the new STRING column
  await knex.schema.alterTable(LOG_TABLE, table => {
    // We re-apply the same defaults and constraints
    table.string('scope_type').notNullable().defaultTo('');
    table.string('level').notNullable().defaultTo('');
  });

  // STEP 3: Copy the data from the old column to the new one
  await knex(LOG_TABLE).update({
    level: knex.ref('level_old'),
    scope_type: knex.ref('scope_type_old')
  });

  // STEP 4: Drop the old column
  await knex.schema.alterTable(LOG_TABLE, table => {
    table.dropColumn('level_old');
    table.dropColumn('scope_type_old');
  });
}

export async function down(): Promise<void> {
  return;
}
