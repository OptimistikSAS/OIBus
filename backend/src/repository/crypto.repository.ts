import crypto from 'node:crypto';
import { Database } from 'better-sqlite3';
import { CryptoSettings } from '../../../shared/model/engine.model';

export const CRYPTO_TABLE = 'crypto';

/**
 * Repository used for engine settings
 */
export default class CryptoRepository {
  constructor(private readonly database: Database) {}

  getCryptoSettings(oibusId: string): CryptoSettings | undefined {
    const query = `SELECT algorithm, init_vector AS initVector, security_key AS securityKey FROM ${CRYPTO_TABLE} WHERE id = ?;`;

    return this.database.prepare(query).get(oibusId) as CryptoSettings | undefined;
  }

  /**
   * Create engine settings in the database.
   */
  createCryptoSettings(oibusId: string): void {
    if (this.getCryptoSettings(oibusId)) {
      return;
    }

    const algorithm = 'aes-256-cbc';
    // generate 16 bytes of random data
    const initVector = crypto.randomBytes(16);
    // secret key generate 32 bytes of random data
    const securityKey = crypto.randomBytes(32);

    const query = `INSERT INTO ${CRYPTO_TABLE} VALUES (?,?,?,?);`;
    this.database.prepare(query).run(oibusId, algorithm, initVector.toString('base64'), securityKey.toString('base64'));
  }
}
