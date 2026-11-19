import crypto from 'node:crypto';
import { existsSync, readdirSync, readFileSync, rmdirSync, rmSync } from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';
import { Knex } from 'knex';

const CRYPTO_TABLE = 'crypto';

/**
 * The secrets are now encrypted with AES-256-GCM, with a random nonce each: the IV shared by all the AES-256-CBC secrets
 * is no longer used, nor the algorithm, which the code fixes.
 *
 * The authentication tokens of the web server were signed with the private key of OIBus, in certs/, also used by the
 * OPC UA connectors: they are now signed with an HS256 secret of their own, generated here (the tokens issued before can
 * no longer be used). The entity migration v4.0.0 imported the certificate of certs/ into the store for the OPC UA
 * connectors: certs/ is removed, once its certificate is found in the store.
 *
 * The entity migration v4.0.0 encrypts the secrets again with the IV, and imports certs/: it must run first. OIBus runs
 * the entity migrations before the crypto ones, and this migration fails rather than lose the IV if oibus.db, next to
 * crypto.db, has not been migrated yet.
 */
export async function up(knex: Knex): Promise<void> {
  const dataFolder = path.dirname((knex.client.config.connection as { filename: string }).filename);
  const oibusDatabasePath = path.resolve(dataFolder, 'oibus.db');
  assertEntitiesMigrated(oibusDatabasePath);
  // Native SQLite DROP COLUMN, as in the entity migrations, instead of the table rebuild of knex's dropColumn()
  await knex.raw(`ALTER TABLE "${CRYPTO_TABLE}" DROP COLUMN "init_vector"`);
  await knex.raw(`ALTER TABLE "${CRYPTO_TABLE}" DROP COLUMN "algorithm"`);

  await knex.raw(`ALTER TABLE "${CRYPTO_TABLE}" ADD COLUMN "token_secret" text`);
  for (const { id } of await knex(CRYPTO_TABLE).select('id')) {
    await knex(CRYPTO_TABLE)
      .where('id', id)
      .update({ token_secret: crypto.randomBytes(32).toString('base64') });
  }

  removeImportedCertsFolder(path.resolve(dataFolder, 'certs'), oibusDatabasePath);
}

export async function down(_knex: Knex): Promise<void> {
  return;
}

const assertEntitiesMigrated = (oibusDatabasePath: string): void => {
  if (!existsSync(oibusDatabasePath)) return; // no configuration, hence no secret
  const database = new Database(oibusDatabasePath, { readonly: true });
  try {
    const hasMigrations = database.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'migrations';`).get();
    if (!hasMigrations) return;
    const migrated = database.prepare(`SELECT 1 FROM migrations WHERE name IN ('v4.0.0.ts', 'v4.0.0.js');`).get();
    if (!migrated) {
      throw new Error(
        'The entity migration v4.0.0 must run before the crypto one: it encrypts the secrets again with the IV this one removes'
      );
    }
  } finally {
    database.close();
  }
};

/**
 * Remove certs/ (its private key, public key and certificate) when its certificate is in the store of oibus.db, where the
 * entity migration v4.0.0 imported it: otherwise it is kept, not to lose the certificate trusted by the OPC UA servers.
 * It is also kept when the settings of a connector or history query refer to its files (as the user certificate of an
 * OPC UA connector, which the documentation suggested).
 */
const removeImportedCertsFolder = (certsFolder: string, oibusDatabasePath: string): void => {
  const certificatePath = path.resolve(certsFolder, 'cert.pem');
  if (!existsSync(certificatePath)) return;
  let imported = false;
  if (existsSync(oibusDatabasePath)) {
    const database = new Database(oibusDatabasePath, { readonly: true });
    try {
      const hasCertificates = database.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'certificates';`).get();
      imported =
        !!hasCertificates &&
        !!database.prepare('SELECT 1 FROM certificates WHERE certificate = ?;').get(readFileSync(certificatePath, 'utf8'));
      if (imported && isReferencedBySettings(database)) {
        console.warn(`The files of ${certsFolder} are used in the settings of a connector or history query: the folder is kept`);
        return;
      }
    } finally {
      database.close();
    }
  }
  if (!imported) {
    console.warn(`The certificate of ${certsFolder} is not in the certificate store: the folder is kept`);
    return;
  }
  for (const file of ['private.pem', 'public.pem', 'cert.pem']) {
    rmSync(path.resolve(certsFolder, file), { force: true });
  }
  if (readdirSync(certsFolder).length === 0) {
    rmdirSync(certsFolder);
  }
};

/** Whether the settings of a connector or history query refer to a file of certs/ */
const isReferencedBySettings = (database: Database.Database): boolean =>
  [
    ['south_connectors', 'settings'],
    ['north_connectors', 'settings'],
    ['history_queries', 'south_settings'],
    ['history_queries', 'north_settings']
  ].some(([table, column]) => {
    const exists = database.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?;`).get(table);
    return (
      !!exists &&
      !!database
        .prepare(
          `SELECT 1 FROM ${table} WHERE ${column} LIKE '%certs%cert.pem%' OR ${column} LIKE '%certs%private.pem%' OR ${column} LIKE '%certs%public.pem%';`
        )
        .get()
    );
  });
