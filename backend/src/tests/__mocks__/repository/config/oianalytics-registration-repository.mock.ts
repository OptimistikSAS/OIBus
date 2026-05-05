import { mock } from 'node:test';
import type { Database } from 'better-sqlite3';
import { OIAnalyticsRegistration, OIAnalyticsRegistrationEditCommand } from '../../../../model/oianalytics-registration.model';
import { Instant } from '../../../../../shared/model/types';
import OIAnalyticsRegistrationRepository from '../../../../repository/config/oianalytics-registration.repository';

/**
 * Create a mock object for OIAnalytics Registration repository
 */
export default class OianalyticsRegistrationRepositoryMock extends OIAnalyticsRegistrationRepository {
  constructor() {
    super({} as Database);
  }
  protected override createDefault(): void {
    return;
  }
  override get = mock.fn((): OIAnalyticsRegistration | null => null);
  override register = mock.fn(
    (
      _command: OIAnalyticsRegistrationEditCommand,
      _activationCode: string,
      _checkUrl: string,
      _expirationDate: Instant,
      _publicKey: string,
      _privateKey: string,
      _updatedBy: string
    ): void => undefined
  );
  override update = mock.fn((_command: Omit<OIAnalyticsRegistrationEditCommand, 'host'>, _updatedBy: string): void => undefined);
  override updateKeys = mock.fn((_privateKey: string, _publicKey: string): void => undefined);
  override activate = mock.fn((_activationDate: Instant, _token: string): void => undefined);
  override unregister = mock.fn((): void => undefined);
}
