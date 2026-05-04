import { EventEmitter } from 'node:events';
import { mock } from 'node:test';
import { OIAnalyticsRegistration } from '../../../../model/oianalytics-registration.model';
import { RegistrationSettingsCommandDTO } from '../../../../../shared/model/engine.model';

/**
 * Create a mock object for OIAnalytics Registration Service
 */
export default class OIAnalyticsRegistrationServiceMock {
  start = mock.fn((): void => undefined);
  getRegistrationSettings = mock.fn((): OIAnalyticsRegistration => ({}) as OIAnalyticsRegistration);
  register = mock.fn(async (_command: RegistrationSettingsCommandDTO, _updatedBy: string): Promise<void> => undefined);
  checkRegistration = mock.fn(async (): Promise<void> => undefined);
  editRegistrationSettings = mock.fn(async (_command: RegistrationSettingsCommandDTO, _updatedBy: string): Promise<void> => undefined);
  updateKeys = mock.fn(async (_privateKey: string, _publicKey: string): Promise<void> => undefined);
  testConnection = mock.fn(async (_command: RegistrationSettingsCommandDTO): Promise<void> => undefined);
  unregister = mock.fn((): void => undefined);
  stop = mock.fn((): void => undefined);
  registrationEvent = new EventEmitter();
}
