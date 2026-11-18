import crypto from 'node:crypto';

import { Database } from 'better-sqlite3';

import { CryptoSettings } from '../../../shared/model/domain/engine.model';

export const CRYPTO_TABLE = 'crypto';

/**
 * Repository used for engine settings
 */
export default class CryptoRepository {
  constructor(private readonly database: Database) {}

  getCryptoSettings(oibusId: string): CryptoSettings | null {
    const query = `SELECT security_key FROM ${CRYPTO_TABLE} WHERE id = ?;`;

    const result = this.database.prepare(query).get(oibusId);
    if (!result) return null;
    return this.toCryptoSettings(result as Record<string, string>);
  }

  /**
   * Create engine settings in the database.
   */
  createCryptoSettings(oibusId: string): void {
    if (this.getCryptoSettings(oibusId)) {
      return;
    }

    // secret key generate 32 bytes of random data
    const securityKey = crypto.randomBytes(32);

    const query = `INSERT INTO ${CRYPTO_TABLE} (id, security_key) VALUES (?, ?);`;
    this.database.prepare(query).run(oibusId, securityKey.toString('base64'));
  }

  private toCryptoSettings(result: Record<string, string>): CryptoSettings {
    return {
      securityKey: result.security_key
    };
  }
}
