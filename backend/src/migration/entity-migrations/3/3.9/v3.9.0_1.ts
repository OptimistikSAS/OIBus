import { Knex } from 'knex';

const ENGINES_TABLE = 'engines';

/**
 * Add auth_token_duration to engines, storing the same jsonwebtoken `expiresIn` duration string
 * ('1h', '6h', '1d', '3d', '7d', '14d', '30d') passed straight through at sign time. Matches the
 * previously hardcoded '7d' JWT expiresIn — existing installs keep the same session length after
 * upgrading.
 *
 * Also adds forward_proxy_enabled: previously, forwarding to an upstream proxy was implicitly
 * active whenever forward_proxy_url was set. This backfills the new explicit flag from that
 * existing data so behavior is unchanged after upgrading.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(ENGINES_TABLE, t => {
    t.string('auth_token_duration');
    t.integer('forward_proxy_enabled');
  });
  await knex(ENGINES_TABLE).update({
    auth_token_duration: '7d'
  });
  await knex(ENGINES_TABLE).whereNotNull('forward_proxy_url').update({ forward_proxy_enabled: 1 });
  await knex(ENGINES_TABLE).whereNull('forward_proxy_url').update({ forward_proxy_enabled: 0 });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable(ENGINES_TABLE, t => {
    t.dropColumn('auth_token_duration');
    t.dropColumn('forward_proxy_enabled');
  });
}
