import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';

import Database from 'better-sqlite3';
import knex, { Knex } from 'knex';

import { up as initialSetup } from '../../3/3.0/v3.0-initial-setup';
import { down, up } from './v4.0.0';

describe('Crypto migration v4.0.0', () => {
  let folder: string;
  let db: Knex;

  /** Creates the oibus.db next to crypto.db, with the entity migrations it records */
  const createOIBusDatabase = (migrations: Array<string>) => {
    const database = new Database(path.join(folder, 'oibus.db'));
    database.exec('CREATE TABLE migrations (id INTEGER PRIMARY KEY, name TEXT);');
    for (const name of migrations) database.prepare('INSERT INTO migrations (name) VALUES (?);').run(name);
    database.close();
  };

  beforeEach(async () => {
    folder = await fs.mkdtemp(path.join(os.tmpdir(), 'oibus-crypto-migration-'));
    db = knex({ client: 'better-sqlite3', connection: { filename: path.join(folder, 'crypto.db') }, useNullAsDefault: true });
    await initialSetup(db);
    await db('crypto').insert({ id: 'oibus-id', algorithm: 'aes-256-cbc', init_vector: 'iv', security_key: 'key' });
  });

  afterEach(async () => {
    await db.destroy();
    await fs.rm(folder, { recursive: true, force: true });
  });

  const assertMigrated = async () => {
    const columns = ((await db.raw('PRAGMA table_info(crypto)')) as Array<{ name: string }>).map(column => column.name);
    assert.deepStrictEqual(columns.sort(), ['id', 'security_key']);
    assert.deepStrictEqual(await db('crypto').select('*'), [{ id: 'oibus-id', security_key: 'key' }]);
  };

  it('drops the IV and the algorithm once the entity migration encrypted the secrets again, keeping the key', async () => {
    createOIBusDatabase(['v3.9.5.js', 'v4.0.0.js']);

    await up(db);

    await assertMigrated();
  });

  it('drops them without any configuration database', async () => {
    await up(db);

    await assertMigrated();
  });

  it('keeps the IV while the entity migration has not run', async () => {
    createOIBusDatabase(['v3.9.5.js']);

    await assert.rejects(() => up(db), {
      message: 'The entity migration v4.0.0 must run before the crypto one: it encrypts the secrets again with the IV this one removes'
    });
    assert.deepStrictEqual(await db('crypto').first('init_vector'), { init_vector: 'iv' });
  });

  it('down is a no-op', async () => {
    await assert.doesNotReject(() => down(db));
  });
});
