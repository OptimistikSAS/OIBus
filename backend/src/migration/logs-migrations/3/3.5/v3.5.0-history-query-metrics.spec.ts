import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import knex, { Knex } from 'knex';
import { down, up } from './v3.5.0-history-query-metrics';

describe('Logs migration v3.5.0 (history-query-metrics)', () => {
  let db: Knex;

  before(() => {
    db = knex({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
  });

  after(async () => {
    await db.destroy();
  });

  it('up is a no-op and does not throw', async () => {
    await assert.doesNotReject(() => up(db));
  });

  it('down is a no-op and does not throw', async () => {
    await assert.doesNotReject(() => down());
  });
});
