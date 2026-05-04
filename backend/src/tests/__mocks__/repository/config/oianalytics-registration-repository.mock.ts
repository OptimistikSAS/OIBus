import { mock } from 'node:test';
import { OIAnalyticsRegistration, OIAnalyticsRegistrationEditCommand } from '../../../../model/oianalytics-registration.model';
import { Instant } from '../../../../../shared/model/types';

/**
 * Create a mock object for OIAnalytics Registration repository
 */
export default class OianalyticsRegistrationRepositoryMock {
  get = mock.fn((): OIAnalyticsRegistration | null => null);
  register = mock.fn(
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
  update = mock.fn((_command: Omit<OIAnalyticsRegistrationEditCommand, 'host'>, _updatedBy: string): void => undefined);
  updateKeys = mock.fn((_privateKey: string, _publicKey: string): void => undefined);
  activate = mock.fn((_activationDate: Instant, _token: string): void => undefined);
  unregister = mock.fn((): void => undefined);
}
