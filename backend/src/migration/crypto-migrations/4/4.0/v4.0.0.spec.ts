import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

import Database from 'better-sqlite3';
import knex, { Knex } from 'knex';

import { up as initialSetup } from '../../3/3.0/v3.0-initial-setup';
import { down, up } from './v4.0.0';

describe('Crypto migration v4.0.0', () => {
  let folder: string;
  let db: Knex;

  /** Creates the oibus.db next to crypto.db, with the entity migrations it records and the certificates of its store */
  const createOIBusDatabase = (migrations: Array<string>, certificates: Array<string> = []) => {
    const database = new Database(path.join(folder, 'oibus.db'));
    database.exec('CREATE TABLE migrations (id INTEGER PRIMARY KEY, name TEXT);');
    database.exec('CREATE TABLE certificates (id TEXT PRIMARY KEY, certificate TEXT);');
    for (const name of migrations) database.prepare('INSERT INTO migrations (name) VALUES (?);').run(name);
    certificates.forEach((certificate, i) =>
      database.prepare('INSERT INTO certificates VALUES (?, ?);').run(`certificate-${i}`, certificate)
    );
    database.close();
  };

  /** Creates certs/, as OIBus up to 3.9 did */
  const createCertsFolder = async () => {
    await fs.mkdir(path.join(folder, 'certs'));
    for (const [file, content] of [
      ['cert.pem', 'oibus certificate'],
      ['private.pem', 'oibus private key'],
      ['public.pem', 'oibus public key']
    ]) {
      await fs.writeFile(path.join(folder, 'certs', file), content);
    }
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
    assert.deepStrictEqual(columns.sort(), ['id', 'security_key', 'token_secret']);
    const [settings] = await db('crypto').select('*');
    assert.strictEqual(settings.id, 'oibus-id');
    assert.strictEqual(settings.security_key, 'key');
    // a random secret of 32 bytes signs the authentication tokens
    assert.strictEqual(Buffer.from(settings.token_secret, 'base64').length, 32);
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

  it('removes certs/ once its certificate is in the store', async () => {
    createOIBusDatabase(['v4.0.0.js'], ['another certificate', 'oibus certificate']);
    await createCertsFolder();

    await up(db);

    await assert.rejects(() => fs.stat(path.join(folder, 'certs')), { code: 'ENOENT' });
  });

  it('keeps certs/ when its certificate is not in the store', async () => {
    const warn = mock.method(console, 'warn', () => undefined);
    createOIBusDatabase(['v4.0.0.js'], ['another certificate']);
    await createCertsFolder();

    await up(db);

    assert.deepStrictEqual((await fs.readdir(path.join(folder, 'certs'))).sort(), ['cert.pem', 'private.pem', 'public.pem']);
    assert.deepStrictEqual(warn.mock.calls[0].arguments, [
      `The certificate of ${path.join(folder, 'certs')} is not in the certificate store: the folder is kept`
    ]);
    warn.mock.restore();
  });

  it('keeps certs/ when the settings of a connector use its files', async () => {
    const warn = mock.method(console, 'warn', () => undefined);
    createOIBusDatabase(['v4.0.0.js'], ['oibus certificate']);
    const database = new Database(path.join(folder, 'oibus.db'));
    database.exec('CREATE TABLE south_connectors (id TEXT PRIMARY KEY, settings TEXT);');
    database
      .prepare('INSERT INTO south_connectors VALUES (?, ?);')
      .run('south-opcua', JSON.stringify({ authentication: { type: 'cert', certFilePath: 'C:\\OIBusData\\certs\\cert.pem' } }));
    database.close();
    await createCertsFolder();

    await up(db);

    assert.deepStrictEqual((await fs.readdir(path.join(folder, 'certs'))).sort(), ['cert.pem', 'private.pem', 'public.pem']);
    assert.deepStrictEqual(warn.mock.calls[0].arguments, [
      `The files of ${path.join(folder, 'certs')} are used in the settings of a connector or history query: the folder is kept`
    ]);
    warn.mock.restore();
  });

  it('keeps the other files of certs/', async () => {
    createOIBusDatabase(['v4.0.0.js'], ['oibus certificate']);
    await createCertsFolder();
    await fs.writeFile(path.join(folder, 'certs', 'other.pem'), 'other');

    await up(db);

    assert.deepStrictEqual(await fs.readdir(path.join(folder, 'certs')), ['other.pem']);
  });

  it('down is a no-op', async () => {
    await assert.doesNotReject(() => down(db));
  });
});
