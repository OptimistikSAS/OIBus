import fetch from 'node-fetch';
import { getNetworkSettingsFromRegistration } from '../utils';
import OianalyticsRegistrationRepository from '../../repository/oianalytics-registration.repository';
import EncryptionService from '../encryption.service';
import pino from 'pino';
import { OIBusCommandStatus } from '../../../../shared/model/command.model';
import { OIBusCommandUpdateStatusCommandDTO } from './oianalytics-command.model';

const COMMAND_TIMEOUT = 15_000;
const ENDPOINT = '/api/oianalytics/oibus/commands';

export default class OIAnalyticsCommandClient {
  constructor(
    private registrationRepository: OianalyticsRegistrationRepository,
    private encryptionService: EncryptionService,
    private logger: pino.Logger
  ) {}

  async completeCommand(commandId: string, status: OIBusCommandStatus, result: string): Promise<void> {
    const registrationSettings = this.registrationRepository.get();
    const connectionSettings = await getNetworkSettingsFromRegistration(registrationSettings, ENDPOINT, this.encryptionService);
    const url = `${connectionSettings.host}${ENDPOINT}/status`;

    const body: Array<OIBusCommandUpdateStatusCommandDTO> = [{ id: commandId, status, result }];

    const response = await fetch(url, {
      method: 'PUT',
      body: JSON.stringify(body),
      headers: { ...connectionSettings.headers, 'Content-Type': 'application/json' },
      timeout: COMMAND_TIMEOUT,
      agent: connectionSettings.agent
    });

    if (response.ok) {
      return;
    } else {
      this.logger.error(`Error ${response.status} while completing command on ${url}: ${response.statusText}`);
      throw new Error(response.statusText);
    }
  }
}
