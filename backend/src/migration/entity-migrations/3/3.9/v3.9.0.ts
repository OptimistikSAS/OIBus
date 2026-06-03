import { Knex } from 'knex';

const ENGINES_TABLE = 'engines';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(ENGINES_TABLE, t => {
    t.string('log_syslog_level');
    t.string('log_syslog_host');
    t.integer('log_syslog_port');
    t.string('log_syslog_protocol');
    t.string('forward_proxy_url').nullable();
    t.string('forward_proxy_username').nullable();
    t.string('forward_proxy_password').nullable();
  });
  await knex(ENGINES_TABLE).update({
    log_syslog_level: 'silent',
    log_syslog_host: '',
    log_syslog_port: 514,
    log_syslog_protocol: 'udp4'
  });
}

export async function down(_knex: Knex): Promise<void> {
  return;
}
