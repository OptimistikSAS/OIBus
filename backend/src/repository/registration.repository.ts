import { RegistrationSettingsCommandDTO, RegistrationSettingsDTO } from '../../../shared/model/engine.model';
import { generateRandomId } from '../service/utils';
import { Database } from 'better-sqlite3';
import { Instant } from '../../../shared/model/types';

export const REGISTRATIONS_TABLE = 'registrations';

const defaultRegistrationSettings: RegistrationSettingsCommandDTO = {
  enabled: false,
  host: ''
};
/**
 * Repository used for registration settings
 */
export default class RegistrationRepository {
  constructor(private readonly database: Database) {
    this.createRegistrationSettings(defaultRegistrationSettings);
  }

  /**
   * Retrieve registration settings
   */
  getRegistrationSettings(): RegistrationSettingsDTO | null {
    const query =
      `SELECT id, enabled, host, activation_code AS activationCode, activated, activation_date AS activationDate, ` +
      `activation_expiration_date AS activationExpirationDate FROM ${REGISTRATIONS_TABLE};`;
    const results: Array<any> = this.database.prepare(query).all();

    if (results.length > 0) {
      return {
        id: results[0].id,
        enabled: results[0].enabled,
        host: results[0].host,
        activationCode: results[0].activationCode,
        activated: results[0].activated,
        activationDate: results[0].activationDate,
        activationExpirationDate: results[0].activationExpirationDate
      };
    } else {
      return null;
    }
  }

  /**
   * Update registration settings in the database.
   */
  updateRegistrationSettings(command: RegistrationSettingsCommandDTO): void {
    const query = `UPDATE ${REGISTRATIONS_TABLE} SET enabled = ?, host = ? WHERE rowid=(SELECT MIN(rowid) FROM ${REGISTRATIONS_TABLE});`;
    this.database.prepare(query).run(+command.enabled, command.host);
  }

  /**
   * Create registration settings in the database.
   */
  createRegistrationSettings(command: RegistrationSettingsCommandDTO): void {
    if (this.getRegistrationSettings()) {
      return;
    }

    const query = `INSERT INTO ${REGISTRATIONS_TABLE} (id, enabled, host) VALUES (?, ?, ?);`;
    this.database.prepare(query).run(generateRandomId(), +command.enabled, command.host);
  }

  createActivationCode(activationCode: string, expirationDate: Instant) {
    const query = `UPDATE ${REGISTRATIONS_TABLE} SET activationCode = ?, activation_expiration_date = ?, activated = 0, activation_date = '' WHERE rowid=(SELECT MIN(rowid) FROM ${REGISTRATIONS_TABLE});`;

    this.database.prepare(query).run(activationCode, expirationDate);
  }

  activateRegistration(activationDate: Instant) {
    const query = `UPDATE ${REGISTRATIONS_TABLE} SET activated = 1, activation_expiration_date = '', activation_date = ? WHERE rowid=(SELECT MIN(rowid) FROM ${REGISTRATIONS_TABLE});`;
    this.database.prepare(query).run(activationDate);
  }
}
