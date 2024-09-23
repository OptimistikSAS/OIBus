import { generateRandomId } from '../../service/utils';
import { Database } from 'better-sqlite3';
import { Instant } from '../../../../shared/model/types';
import { OIAnalyticsRegistration, OIAnalyticsRegistrationEditCommand } from '../../model/oianalytics-registration.model';
import { RegistrationStatus } from '../../../../shared/model/engine.model';

export const REGISTRATIONS_TABLE = 'registrations';

/**
 * Repository used for OIAnalytics registration settings
 */
export default class OIAnalyticsRegistrationRepository {
  constructor(private readonly database: Database) {
    this.createDefault({ host: '', useProxy: false, acceptUnauthorized: false });
  }

  get(): OIAnalyticsRegistration | null {
    const query =
      `SELECT id, host, token, activation_code AS activationCode, status, activation_date AS activationDate, ` +
      `check_url AS checkUrl, activation_expiration_date AS activationExpirationDate, use_proxy AS useProxy, ` +
      `proxy_url AS proxyUrl, proxy_username AS proxyUsername, proxy_password AS proxyPassword, ` +
      `accept_unauthorized AS acceptUnauthorized FROM ${REGISTRATIONS_TABLE};`;
    const results = this.database.prepare(query).all();

    if (results.length > 0) {
      return this.toOIAnalyticsRegistration(results[0] as Record<string, string>);
    } else {
      return null;
    }
  }

  /**
   * After OIAnalytics confirm the creation of a registration, answering with the activation code, the
   * check URL and the expiration date, we store these information in OIBus
   * Next step is for the user to enter the activation code in OIAnalytics
   * OIBus regularly checks if the activation code has been entered
   * Once the activation code entered in OIAnalytics, it goes into the activate method
   */
  register(command: OIAnalyticsRegistrationEditCommand, activationCode: string, checkUrl: string, expirationDate: Instant): void {
    const query =
      `UPDATE ${REGISTRATIONS_TABLE} SET host = ?, status = 'PENDING', token = '', activation_code = ?, ` +
      `check_url = ?, activation_expiration_date = ?, use_proxy = ?, proxy_url = ?, proxy_username = ?, proxy_password = ?, ` +
      `accept_unauthorized = ? WHERE rowid=(SELECT MIN(rowid) FROM ${REGISTRATIONS_TABLE});`;
    this.database
      .prepare(query)
      .run(
        command.host,
        activationCode,
        checkUrl,
        expirationDate,
        +command.useProxy,
        command.proxyUrl,
        command.proxyUsername,
        command.proxyPassword,
        +command.acceptUnauthorized
      );
  }

  /**
   * When OIBus has an answer from OIAnalytics saying that the user correctly entered the activation code,
   * OIAnalytics also answer with the token that can be used to authenticate to OIAnalytics to send data, logs, settings etc.
   */
  activate(activationDate: Instant, token: string) {
    const query = `UPDATE ${REGISTRATIONS_TABLE} SET status = 'REGISTERED', activation_expiration_date = '', activation_code = '', check_url = '', activation_date = ?, token = ? WHERE rowid=(SELECT MIN(rowid) FROM ${REGISTRATIONS_TABLE});`;
    this.database.prepare(query).run(activationDate, token);
  }

  unregister() {
    const query = `UPDATE ${REGISTRATIONS_TABLE} SET status = 'NOT_REGISTERED', activation_expiration_date = '', check_url = '', activation_date = '', activation_code = '', token = '' WHERE rowid=(SELECT MIN(rowid) FROM ${REGISTRATIONS_TABLE});`;
    this.database.prepare(query).run();
  }

  update(command: Omit<OIAnalyticsRegistrationEditCommand, 'host'>): void {
    const query =
      `UPDATE ${REGISTRATIONS_TABLE} SET ` +
      `use_proxy = ?, proxy_url = ?, proxy_username = ?, proxy_password = ?, ` +
      `accept_unauthorized = ? WHERE rowid=(SELECT MIN(rowid) FROM ${REGISTRATIONS_TABLE});`;
    this.database
      .prepare(query)
      .run(+command.useProxy, command.proxyUrl, command.proxyUsername, command.proxyPassword, +command.acceptUnauthorized);
  }

  private createDefault(command: OIAnalyticsRegistrationEditCommand): void {
    if (this.get()) {
      return;
    }

    const query = `INSERT INTO ${REGISTRATIONS_TABLE} (id, host, status) VALUES (?, ?, ?);`;
    this.database.prepare(query).run(generateRandomId(), command.host, 'NOT_REGISTERED');
  }

  private toOIAnalyticsRegistration(result: Record<string, string>): OIAnalyticsRegistration {
    return {
      id: result.id,
      host: result.host,
      activationCode: result.activationCode,
      token: result.token,
      status: result.status as RegistrationStatus,
      activationDate: result.activationDate,
      activationExpirationDate: result.activationExpirationDate,
      checkUrl: result.checkUrl,
      useProxy: Boolean(result.useProxy),
      proxyUrl: result.proxyUrl,
      proxyUsername: result.proxyUsername,
      proxyPassword: result.proxyPassword,
      acceptUnauthorized: Boolean(result.acceptUnauthorized)
    };
  }
}
