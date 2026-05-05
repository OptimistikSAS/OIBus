import { mock } from 'node:test';
import { OIAnalyticsRegistration } from '../../../../model/oianalytics-registration.model';
import { OIAnalyticsFetchCommandDTO } from '../../../../service/oia/oianalytics.model';
import { OIBusInfo, RegistrationSettingsCommandDTO } from '../../../../../shared/model/engine.model';
import { Instant } from '../../../../../shared/model/types';
import { OIBusCommand } from '../../../../model/oianalytics-command.model';

/**
 * Create a mock object for OIAnalytics Client
 */
export default class OIAnalyticsClientMock {
  updateCommandStatus = mock.fn(async (_registrationSettings: OIAnalyticsRegistration, _payload: string): Promise<void> => undefined);
  retrieveCancelledCommands = mock.fn(
    async (_registrationSettings: OIAnalyticsRegistration, _commands: Array<OIBusCommand>): Promise<Array<OIAnalyticsFetchCommandDTO>> => []
  );
  retrievePendingCommands = mock.fn(
    async (_registrationSettings: OIAnalyticsRegistration): Promise<Array<OIAnalyticsFetchCommandDTO>> => []
  );
  register = mock.fn(
    async (
      _registration: RegistrationSettingsCommandDTO,
      _oibusInfo: OIBusInfo,
      _publicKey: string
    ): Promise<{ redirectUrl: string; expirationDate: Instant; activationCode: string }> => ({
      redirectUrl: '',
      expirationDate: '' as Instant,
      activationCode: ''
    })
  );
  checkRegistration = mock.fn(
    async (_registrationSettings: OIAnalyticsRegistration): Promise<{ status: string; expired: boolean; accessToken: string }> => ({
      status: '',
      expired: false,
      accessToken: ''
    })
  );
  sendConfiguration = mock.fn(async (_registrationSettings: OIAnalyticsRegistration, _payload: string): Promise<void> => undefined);
  sendHistoryQuery = mock.fn(async (_registrationSettings: OIAnalyticsRegistration, _payload: string): Promise<void> => undefined);
  deleteHistoryQuery = mock.fn(async (_registrationSettings: OIAnalyticsRegistration, _historyId: string): Promise<void> => undefined);
  downloadFile = mock.fn(
    async (_registrationSettings: OIAnalyticsRegistration, _assetId: string, _filename: string): Promise<void> => undefined
  );
}
