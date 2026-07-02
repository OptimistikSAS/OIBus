import { Knex } from 'knex';

const LOG_TABLE = 'logs';

/**
 * Several co-located changes for v3.9.0:
 *
 * 1. Add item_id and item_name columns so logs can be linked to a specific
 *    south connector item (data point / query). Both columns are nullable;
 *    logs that are not item-specific leave them NULL.
 *
 * 2. Migrate scope_type = 'web-server' rows to scope_type = 'internal' with
 *    scope_id = 'web-server' and scope_name = 'Web Server'. The 'web-server'
 *    scope type is removed from the ScopeType union in v3.9.0; web-server logs
 *    are now a named internal scope, searchable via the scope typeahead.
 *
 * 3. Add group_id and group_name columns so logs can be linked to a south item
 *    group. Both columns are nullable; logs not associated with a group leave
 *    them NULL.
 *
 * 4. Clear scope_name for internal scope rows (including the web-server rows
 *    migrated above) — the frontend now derives the display name from the
 *    scope_id via i18n translation keys.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(LOG_TABLE, table => {
    table.text('item_id').nullable();
    table.text('item_name').nullable();
    table.text('group_id').nullable();
    table.text('group_name').nullable();
  });

  await knex(LOG_TABLE).where('scope_type', 'web-server').update({
    scope_type: 'internal',
    scope_id: 'web-server',
    scope_name: 'Web Server'
  });

  await knex(LOG_TABLE).where('scope_type', 'internal').update({ scope_name: null });

  // Partial index: covers getItemById (item_id = ?), search (item_id IN (...)),
  // and suggestItems (item_id IS NOT NULL guard). Kept small by indexing only
  // non-NULL rows.
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_logs_item_id ON ${LOG_TABLE} (item_id) WHERE item_id IS NOT NULL;`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_logs_group_id ON ${LOG_TABLE} (group_id) WHERE group_id IS NOT NULL;`);
}

export async function down(knex: Knex): Promise<void> {
  // Revert web-server rows before dropping the columns.
  await knex(LOG_TABLE).where({ scope_type: 'internal', scope_id: 'web-server' }).update({
    scope_type: 'web-server',
    scope_id: null,
    scope_name: null
  });

  // SQLite does not support DROP COLUMN — use the tmp-table pattern.
  await knex.schema.raw(`CREATE TABLE ${LOG_TABLE}_dg_tmp
    (timestamp  datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
     level      varchar(255) NOT NULL DEFAULT '',
     scope_type varchar(255),
     scope_id   varchar(255),
     scope_name varchar(255),
     message    varchar NOT NULL);`);

  await knex.schema.raw(`INSERT INTO ${LOG_TABLE}_dg_tmp (timestamp, level, scope_type, scope_id, scope_name, message)
    SELECT timestamp, level, scope_type, scope_id, scope_name, message FROM ${LOG_TABLE};`);

  await knex.schema.raw(`DROP TABLE ${LOG_TABLE};`);

  await knex.schema.raw(`ALTER TABLE ${LOG_TABLE}_dg_tmp RENAME TO ${LOG_TABLE};`);

  // Restore the two indexes that existed before this migration (created by v3.8.0).
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON ${LOG_TABLE} (timestamp);`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_logs_scope ON ${LOG_TABLE} (scope_id, scope_type);`);
}
