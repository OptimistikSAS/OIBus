import { OIBusFullConfigurationCommandDTO } from './oianalytics-configuration.model';
import fetch from 'node-fetch';
import { getNetworkSettingsFromRegistration } from '../utils';
import OianalyticsRegistrationRepository from '../../repository/oianalytics-registration.repository';
import EncryptionService from '../encryption.service';
import pino from 'pino';

const MESSAGE_TIMEOUT = 15_000;

export default class OIAnalyticsConfigurationClient {
  constructor(
    private registrationRepository: OianalyticsRegistrationRepository,
    private encryptionService: EncryptionService,
    private logger: pino.Logger
  ) {}

  async sendFullConfiguration(configuration: OIBusFullConfigurationCommandDTO): Promise<void> {
    const endpoint = '/api/oianalytics/oibus/configuration';
    const registrationSettings = this.registrationRepository.get();
    const connectionSettings = await getNetworkSettingsFromRegistration(registrationSettings, endpoint, this.encryptionService);
    const url = `${connectionSettings.host}${endpoint}`;

    const response = await fetch(url, {
      method: 'PUT',
      body: JSON.stringify(configuration),
      headers: { ...connectionSettings.headers, 'Content-Type': 'application/json' },
      timeout: MESSAGE_TIMEOUT,
      agent: connectionSettings.agent
    });

    if (response.ok) {
      return;
    } else {
      this.logger.error(`Error ${response.status} while sending full configuration on ${url}: ${response.statusText}`);
      throw new Error(response.statusText);
    }
  }
}
