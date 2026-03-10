import { Knex } from 'knex';

const SCAN_MODES_TABLE = 'scan_modes';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(SCAN_MODES_TABLE, t => {
    t.datetime('created_at').defaultTo(knex.fn.now());
    t.datetime('updated_at').defaultTo(knex.fn.now());
  });
  // Backfill existing rows that have NULL timestamps
  await knex(SCAN_MODES_TABLE).whereNull('created_at').update({
    created_at: knex.fn.now(),
    updated_at: knex.fn.now()
  });
}

export async function down(_knex: Knex): Promise<void> {
  return;
}
