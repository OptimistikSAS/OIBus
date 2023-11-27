import { RegistrationSettingsCommandDTO, RegistrationSettingsDTO } from '../../../shared/model/engine.model';
import { generateRandomId } from '../service/utils';
import { Database } from 'better-sqlite3';
import { Instant } from '../../../shared/model/types';

export const REGISTRATIONS_TABLE = 'registrations';

/**
 * Repository used for registration settings
 */
export default class RegistrationRepository {
  constructor(private readonly database: Database) {
    this.createRegistrationSettings({ host: '' });
  }

  /**
   * Retrieve registration settings
   */
  getRegistrationSettings(): RegistrationSettingsDTO | null {
    const query =
      `SELECT id, host, token, activation_code AS activationCode, status, activation_date AS activationDate, ` +
      `check_url AS checkUrl, activation_expiration_date AS activationExpirationDate FROM ${REGISTRATIONS_TABLE};`;
    const results: Array<any> = this.database.prepare(query).all();

    if (results.length > 0) {
      return {
        id: results[0].id,
        host: results[0].host,
        token: results[0].token,
        activationCode: results[0].activationCode,
        status: results[0].status,
        activationDate: results[0].activationDate,
        activationExpirationDate: results[0].activationExpirationDate,
        checkUrl: results[0].checkUrl
      };
    } else {
      return null;
    }
  }

  /**
   * Update registration in the database.
   */
  updateRegistration(command: RegistrationSettingsCommandDTO, activationCode: string, checkUrl: string, expirationDate: Instant): void {
    const query = `UPDATE ${REGISTRATIONS_TABLE} SET host = ?, status = 'PENDING', token = '', activation_code = ?, check_url = ?, activation_expiration_date = ? WHERE rowid=(SELECT MIN(rowid) FROM ${REGISTRATIONS_TABLE});`;
    this.database.prepare(query).run(command.host, activationCode, checkUrl, expirationDate);
  }

  /**
   * Create registration settings in the database.
   */
  createRegistrationSettings(command: RegistrationSettingsCommandDTO): void {
    if (this.getRegistrationSettings()) {
      return;
    }

    const query = `INSERT INTO ${REGISTRATIONS_TABLE} (id, host, status) VALUES (?, ?, ?);`;
    this.database.prepare(query).run(generateRandomId(), command.host, 'NOT_REGISTERED');
  }

  activateRegistration(activationDate: Instant, token: string) {
    const query = `UPDATE ${REGISTRATIONS_TABLE} SET status = 'REGISTERED', activation_expiration_date = '', activation_code = '', check_url = '', activation_date = ?, token = ? WHERE rowid=(SELECT MIN(rowid) FROM ${REGISTRATIONS_TABLE});`;
    this.database.prepare(query).run(activationDate, token);
  }

  unregister() {
    const query = `UPDATE ${REGISTRATIONS_TABLE} SET status = 'NOT_REGISTERED', activation_expiration_date = '', check_url = '', activation_date = '', activation_code = '', token = '' WHERE rowid=(SELECT MIN(rowid) FROM ${REGISTRATIONS_TABLE});`;
    this.database.prepare(query).run();
  }
}
