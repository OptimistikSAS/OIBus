import { existsSync } from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';
import { Knex } from 'knex';

const CRYPTO_TABLE = 'crypto';

/**
 * The secrets are now encrypted with AES-256-GCM, with a random nonce each: the IV shared by all the AES-256-CBC secrets
 * is no longer used, nor the algorithm, which the code fixes.
 *
 * The entity migration v4.0.0 encrypts the secrets again with this IV: it must run first. OIBus runs the entity
 * migrations before the crypto ones, and this migration fails rather than lose the IV if oibus.db, next to crypto.db,
 * has not been migrated yet.
 */
export async function up(knex: Knex): Promise<void> {
  assertEntitiesMigrated(path.resolve(path.dirname((knex.client.config.connection as { filename: string }).filename), 'oibus.db'));
  // Native SQLite DROP COLUMN, as in the entity migrations, instead of the table rebuild of knex's dropColumn()
  await knex.raw(`ALTER TABLE "${CRYPTO_TABLE}" DROP COLUMN "init_vector"`);
  await knex.raw(`ALTER TABLE "${CRYPTO_TABLE}" DROP COLUMN "algorithm"`);
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
