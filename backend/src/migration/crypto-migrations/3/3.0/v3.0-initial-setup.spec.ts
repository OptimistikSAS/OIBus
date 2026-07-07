import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import knex, { Knex } from 'knex';
import { down, up } from './v3.0-initial-setup';

describe('Crypto migration v3.0 (initial-setup)', () => {
  let db: Knex;

  before(() => {
    db = knex({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
  });

  after(async () => {
    await db.destroy();
  });

  it('creates the crypto table with id as primary key and required columns', async () => {
    await up(db);

    assert.ok(await db.schema.hasTable('crypto'));
    const info = (await db.raw('PRAGMA table_info(crypto)')) as Array<{ name: string; notnull: number; pk: number }>;
    const columns = info.map(c => c.name);
    assert.deepStrictEqual(columns.sort(), ['algorithm', 'id', 'init_vector', 'security_key'].sort());

    const pkCols = info.filter(c => c.pk > 0).map(c => c.name);
    assert.deepStrictEqual(pkCols, ['id']);

    const notNullCols = info.filter(c => c.notnull === 1 && c.name !== 'id').map(c => c.name);
    assert.deepStrictEqual(notNullCols.sort(), ['algorithm', 'init_vector', 'security_key'].sort());
  });

  it('allows inserting a crypto row', async () => {
    await db('crypto').insert({
      id: '11111111-1111-1111-1111-111111111111',
      algorithm: 'aes-256-cbc',
      init_vector: 'iv-value',
      security_key: 'key-value'
    });

    const row = await db('crypto').first();
    assert.strictEqual(row.algorithm, 'aes-256-cbc');
    assert.strictEqual(row.init_vector, 'iv-value');
    assert.strictEqual(row.security_key, 'key-value');
  });

  it('drops the crypto table on down', async () => {
    await down(db);
    assert.strictEqual(await db.schema.hasTable('crypto'), false);
  });
});
