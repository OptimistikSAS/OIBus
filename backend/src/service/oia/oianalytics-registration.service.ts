import { generateRandomId, getNetworkSettingsFromRegistration, getOIBusInfo } from '../utils';
import EncryptionService from '../encryption.service';
import pino from 'pino';
import { DateTime } from 'luxon';
import fetch from 'node-fetch';
import { Instant } from '../../../../shared/model/types';
import OIAnalyticsRegistrationRepository from '../../repository/config/oianalytics-registration.repository';
import EngineRepository from '../../repository/config/engine.repository';
import { OIAnalyticsRegistration } from '../../model/oianalytics-registration.model';
import { RegistrationSettingsDTO } from '../../../../shared/model/engine.model';
import JoiValidator from '../../web-server/controllers/validators/joi.validator';
import { registrationSchema } from '../../web-server/controllers/validators/oibus-validation-schema';

const HTTP_TIMEOUT = 10_000;
const CHECK_REGISTRATION_INTERVAL = 10_000;
export default class OIAnalyticsRegistrationService {
  private intervalCheckRegistration: NodeJS.Timeout | null = null;
  private ongoingCheckRegistration = false;

  constructor(
    protected readonly validator: JoiValidator,
    private oIAnalyticsRegistrationRepository: OIAnalyticsRegistrationRepository,
    private engineRepository: EngineRepository,
    private encryptionService: EncryptionService,
    private logger: pino.Logger
  ) {}

  start() {
    const registrationSettings = this.oIAnalyticsRegistrationRepository.get()!;
    if (registrationSettings.checkUrl && registrationSettings.status === 'PENDING') {
      this.intervalCheckRegistration = setInterval(this.checkRegistration.bind(this), HTTP_TIMEOUT);
    }
  }

  getRegistrationSettings(): OIAnalyticsRegistration | null {
    return this.oIAnalyticsRegistrationRepository.get();
  }

  /**
   * First step, the user want to register: the service try to reach OIAnalytics to send
   * the activation code. On success, it runs an interval to regularly check if it has been accepted on OIAnalytics
   */
  async register(command: Omit<OIAnalyticsRegistration, 'id' | 'status' | 'activationDate'>): Promise<void> {
    await this.validator.validate(registrationSchema, command);

    const activationCode = generateRandomId(6);
    const registrationSettings = this.oIAnalyticsRegistrationRepository.get()!;

    if (!command.proxyPassword) {
      command.proxyPassword = registrationSettings.proxyPassword;
    } else {
      command.proxyPassword = await this.encryptionService.encryptText(command.proxyPassword);
    }

    const engineSettings = this.engineRepository.get()!;
    const oibusInfo = getOIBusInfo(engineSettings);
    const body = {
      activationCode,
      oibusVersion: oibusInfo.version,
      oibusArch: oibusInfo.architecture,
      oibusOs: oibusInfo.operatingSystem,
      oibusId: oibusInfo.oibusId,
      oibusName: oibusInfo.oibusName
    };
    let response;
    try {
      const endpoint = '/api/oianalytics/oibus/registration';
      const connectionSettings = await getNetworkSettingsFromRegistration(
        command,
        '/api/oianalytics/oibus/registration',
        this.encryptionService
      );
      const url = `${connectionSettings.host}${endpoint}`;

      response = await fetch(url, {
        method: 'POST',
        timeout: HTTP_TIMEOUT,
        agent: connectionSettings.agent,
        body: JSON.stringify(body),
        headers: {
          'Content-Type': 'application/json'
        }
      });
    } catch (fetchError) {
      throw new Error(`Registration failed: ${fetchError}`);
    }

    if (!response.ok) {
      throw new Error(`Registration failed with status code ${response.status} and message: ${response.statusText}`);
    }

    const result: { redirectUrl: string; expirationDate: Instant } = await response.json();
    this.oIAnalyticsRegistrationRepository.register(command, activationCode, result.redirectUrl, result.expirationDate);
    if (!this.intervalCheckRegistration) {
      this.intervalCheckRegistration = setInterval(this.checkRegistration.bind(this), CHECK_REGISTRATION_INTERVAL);
    }
  }

  /**
   * Second step of the registration: once the activation code has been sent to OIAnalytics, OIBus
   * regularly checks if it has been accepted by the user on OIAnalytics
   */
  async checkRegistration(): Promise<void> {
    if (this.ongoingCheckRegistration) {
      this.logger.trace(`On going registration check`);
      return;
    }
    const registrationSettings = this.oIAnalyticsRegistrationRepository.get()!;
    if (!registrationSettings.checkUrl) {
      this.logger.error(`Error while checking registration status: could not retrieve check URL`);
      return;
    }
    this.ongoingCheckRegistration = true;
    let response;
    try {
      const connectionSettings = await getNetworkSettingsFromRegistration(
        registrationSettings,
        '/api/oianalytics/oibus/registration',
        this.encryptionService
      );
      const url = `${connectionSettings.host}${registrationSettings.checkUrl}`;
      response = await fetch(url, {
        method: 'GET',
        timeout: HTTP_TIMEOUT,
        agent: connectionSettings.agent
      });
      if (!response.ok) {
        this.logger.error(`Error ${response.status} while checking registration status on ${url}: ${response.statusText}`);
        this.ongoingCheckRegistration = false;
        return;
      }

      const responseData: { status: string; expired: boolean; accessToken: string } = await response.json();
      if (responseData.status !== 'COMPLETED') {
        this.logger.warn(`Registration not completed. Status: ${responseData.status}`);
      } else {
        const encryptedToken = await this.encryptionService.encryptText(responseData.accessToken);
        this.oIAnalyticsRegistrationRepository.activate(DateTime.now().toUTC().toISO()!, encryptedToken);
        if (this.intervalCheckRegistration) {
          clearInterval(this.intervalCheckRegistration);
          this.intervalCheckRegistration = null;
        }

        this.logger.info(`OIBus registered on ${registrationSettings.host}`);
        // TODO:
        // const engineSettings = this.engineRepository.get()!;
        // if (engineSettings.logParameters.oia.level !== 'silent') {
        //   await this.oibusService.resetLogger(engineSettings);
        // }
      }
    } catch (fetchError) {
      this.logger.error(`Error while checking registration status: ${fetchError}`);
    }
    this.ongoingCheckRegistration = false;
  }

  async editConnectionSettings(command: Omit<OIAnalyticsRegistration, 'id' | 'status' | 'activationDate'>): Promise<void> {
    await this.validator.validate(registrationSchema, command);

    const currentRegistration = this.oIAnalyticsRegistrationRepository.get()!;

    if (!command.proxyPassword) {
      command.proxyPassword = currentRegistration.proxyPassword;
    } else {
      command.proxyPassword = await this.encryptionService.encryptText(command.proxyPassword);
    }
    this.oIAnalyticsRegistrationRepository.update(command);

    // TODO:
    // if (engineSettings.logParameters.oia.level !== 'silent') {
    //   await this.oibusService.resetLogger(engineSettings);
    // }
  }

  unregister() {
    this.oIAnalyticsRegistrationRepository.unregister();
    if (this.intervalCheckRegistration) {
      clearInterval(this.intervalCheckRegistration);
      this.intervalCheckRegistration = null;
    }
    // TODO:
    // if (engineSettings.logParameters.oia.level !== 'silent') {
    //   await this.oibusService.resetLogger(engineSettings);
    // }
  }

  stop() {
    if (this.intervalCheckRegistration) {
      clearInterval(this.intervalCheckRegistration);
      this.intervalCheckRegistration = null;
    }
  }
}

export const toOIAnalyticsRegistrationDTO = (registration: OIAnalyticsRegistration): RegistrationSettingsDTO => {
  return {
    id: registration.id,
    host: registration.host,
    activationCode: registration.activationCode,
    status: registration.status,
    activationDate: registration.activationDate,
    activationExpirationDate: registration.activationExpirationDate,
    checkUrl: registration.checkUrl,
    useProxy: registration.useProxy,
    proxyUrl: registration.proxyUrl,
    proxyUsername: registration.proxyUsername,
    acceptUnauthorized: registration.acceptUnauthorized
  };
};
