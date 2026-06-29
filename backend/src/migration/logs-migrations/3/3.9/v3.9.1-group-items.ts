import { Knex } from 'knex';

const LOG_TABLE = 'logs';

/**
 * Add group_id and group_name columns so logs can be linked to a south item group.
 * Both columns are nullable; logs not associated with a group leave them NULL.
 * Also clear scope_name for internal scope rows — the frontend now derives the
 * display name from the scope_id via i18n translation keys.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(LOG_TABLE, table => {
    table.text('group_id').nullable();
    table.text('group_name').nullable();
  });

  await knex(LOG_TABLE).where('scope_type', 'internal').update({ scope_name: null });

  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_logs_group_id ON ${LOG_TABLE} (group_id) WHERE group_id IS NOT NULL;`);
}

export async function down(knex: Knex): Promise<void> {
  // SQLite does not support DROP COLUMN — use the tmp-table pattern.
  await knex.schema.raw(`CREATE TABLE ${LOG_TABLE}_dg_tmp
    (timestamp  datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
     level      varchar(255) NOT NULL DEFAULT '',
     scope_type varchar(255),
     scope_id   varchar(255),
     scope_name varchar(255),
     item_id    text,
     item_name  text,
     message    varchar NOT NULL);`);

  await knex.schema.raw(`INSERT INTO ${LOG_TABLE}_dg_tmp
    (timestamp, level, scope_type, scope_id, scope_name, item_id, item_name, message)
    SELECT timestamp, level, scope_type, scope_id, scope_name, item_id, item_name, message FROM ${LOG_TABLE};`);

  await knex.schema.raw(`DROP TABLE ${LOG_TABLE};`);
  await knex.schema.raw(`ALTER TABLE ${LOG_TABLE}_dg_tmp RENAME TO ${LOG_TABLE};`);

  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON ${LOG_TABLE} (timestamp);`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_logs_scope ON ${LOG_TABLE} (scope_id, scope_type);`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_logs_item_id ON ${LOG_TABLE} (item_id) WHERE item_id IS NOT NULL;`);
}
