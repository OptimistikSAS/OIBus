import { Knex } from 'knex';

const ENGINES_TABLE = 'engines';
const SOUTH_ITEM_GROUPS_TABLE = 'south_item_groups';
const SOUTH_ITEMS_TABLE = 'south_items';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(ENGINES_TABLE, t => {
    t.string('log_syslog_level');
    t.string('log_syslog_host');
    t.integer('log_syslog_port');
    t.string('log_syslog_protocol');
    t.string('forward_proxy_url').nullable();
    t.string('forward_proxy_username').nullable();
    t.string('forward_proxy_password').nullable();
    t.string('proxy_username').nullable();
    t.string('proxy_password').nullable();
  });
  await knex(ENGINES_TABLE).update({
    log_syslog_level: 'silent',
    log_syslog_host: '',
    log_syslog_port: 514,
    log_syslog_protocol: 'udp4'
  });

  await knex.schema.alterTable(SOUTH_ITEM_GROUPS_TABLE, t => {
    t.string('recovery_strategy').nullable();
    t.integer('start_time_offset').nullable().defaultTo(0);
    t.integer('end_time_offset').nullable().defaultTo(0);
  });
  await knex.schema.alterTable(SOUTH_ITEMS_TABLE, t => {
    t.string('recovery_strategy').nullable();
    t.integer('start_time_offset').nullable().defaultTo(0);
    t.integer('end_time_offset').nullable().defaultTo(0);
  });

  await knex.raw(`UPDATE ${SOUTH_ITEM_GROUPS_TABLE} SET start_time_offset = -overlap WHERE overlap IS NOT NULL`);
  await knex.raw(`UPDATE ${SOUTH_ITEMS_TABLE} SET start_time_offset = -overlap WHERE overlap IS NOT NULL`);

  await knex.schema.alterTable(SOUTH_ITEM_GROUPS_TABLE, t => {
    t.dropColumn('overlap');
  });
  await knex.schema.alterTable(SOUTH_ITEMS_TABLE, t => {
    t.dropColumn('overlap');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable(SOUTH_ITEM_GROUPS_TABLE, t => {
    t.integer('overlap').nullable().defaultTo(null);
  });
  await knex.schema.alterTable(SOUTH_ITEMS_TABLE, t => {
    t.integer('overlap').nullable().defaultTo(null);
  });
  await knex.raw(`UPDATE ${SOUTH_ITEM_GROUPS_TABLE} SET overlap = -start_time_offset WHERE start_time_offset IS NOT NULL`);
  await knex.raw(`UPDATE ${SOUTH_ITEMS_TABLE} SET overlap = -start_time_offset WHERE start_time_offset IS NOT NULL`);
  await knex.schema.alterTable(SOUTH_ITEM_GROUPS_TABLE, t => {
    t.dropColumn('start_time_offset');
    t.dropColumn('end_time_offset');
  });
  await knex.schema.alterTable(SOUTH_ITEMS_TABLE, t => {
    t.dropColumn('start_time_offset');
    t.dropColumn('end_time_offset');
  });
}
