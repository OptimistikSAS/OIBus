import { EventEmitter } from 'node:events';
import { mock } from 'node:test';
import { OIAnalyticsRegistration } from '../../../../model/oianalytics-registration.model';
import { RegistrationSettingsCommandDTO } from '../../../../../shared/model/engine.model';
import OIAnalyticsRegistrationService from '../../../../service/oia/oianalytics-registration.service';

/**
 * Create a mock object for OIAnalytics Registration Service
 */
export default class OIAnalyticsRegistrationServiceMock extends OIAnalyticsRegistrationService {
  constructor() {
    super(null!, null!, null!, null!, null!);
  }
  override start = mock.fn((): void => undefined);
  override getRegistrationSettings = mock.fn((): OIAnalyticsRegistration => ({}) as OIAnalyticsRegistration);
  override register = mock.fn(async (_command: RegistrationSettingsCommandDTO, _updatedBy: string): Promise<void> => undefined);
  override checkRegistration = mock.fn(async (): Promise<void> => undefined);
  override editRegistrationSettings = mock.fn(
    async (_command: RegistrationSettingsCommandDTO, _updatedBy: string): Promise<void> => undefined
  );
  override updateKeys = mock.fn(async (_privateKey: string, _publicKey: string): Promise<void> => undefined);
  override testConnection = mock.fn(async (_command: RegistrationSettingsCommandDTO): Promise<void> => undefined);
  override unregister = mock.fn((): void => undefined);
  override stop = mock.fn((): void => undefined);
  override registrationEvent = new EventEmitter();
}
