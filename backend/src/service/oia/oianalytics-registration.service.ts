import { getOIBusInfo } from '../utils';
import EncryptionService from '../encryption.service';
import pino from 'pino';
import { DateTime } from 'luxon';
import OIAnalyticsRegistrationRepository from '../../repository/config/oianalytics-registration.repository';
import EngineRepository from '../../repository/config/engine.repository';
import { OIAnalyticsRegistration } from '../../model/oianalytics-registration.model';
import { RegistrationSettingsCommandDTO, RegistrationSettingsDTO } from '../../../shared/model/engine.model';
import JoiValidator from '../../web-server/controllers/validators/joi.validator';
import { registrationSchema } from '../../web-server/controllers/validators/oibus-validation-schema';
import crypto from 'node:crypto';
import OIAnalyticsClient from './oianalytics-client.service';
import { EventEmitter } from 'node:events';

const CHECK_REGISTRATION_INTERVAL = 10_000;
export default class OIAnalyticsRegistrationService {
  private intervalCheckRegistration: NodeJS.Timeout | null = null;
  private ongoingCheckRegistration = false;
  public registrationEvent: EventEmitter = new EventEmitter(); // Used to trigger logger on (un)registration

  constructor(
    protected readonly validator: JoiValidator,
    private oIAnalyticsClient: OIAnalyticsClient,
    private oIAnalyticsRegistrationRepository: OIAnalyticsRegistrationRepository,
    private engineRepository: EngineRepository,
    private encryptionService: EncryptionService,
    private logger: pino.Logger
  ) {}

  start() {
    const registrationSettings = this.oIAnalyticsRegistrationRepository.get()!;
    if (registrationSettings.checkUrl && registrationSettings.status === 'PENDING') {
      this.intervalCheckRegistration = setInterval(this.checkRegistration.bind(this), CHECK_REGISTRATION_INTERVAL);
    }
  }

  getRegistrationSettings(): OIAnalyticsRegistration | null {
    return this.oIAnalyticsRegistrationRepository.get();
  }

  /**
   * First step, the user want to register: the service try to reach OIAnalytics to send
   * the activation code. On success, it runs an interval to regularly check if it has been accepted on OIAnalytics
   */
  async register(command: RegistrationSettingsCommandDTO): Promise<void> {
    await this.validator.validate(registrationSchema, command);
    const engineSettings = this.engineRepository.get()!;

    const registrationSettings = this.oIAnalyticsRegistrationRepository.get()!;
    if (!command.proxyPassword) {
      command.proxyPassword = registrationSettings.proxyPassword;
    } else {
      command.proxyPassword = await this.encryptionService.encryptText(command.proxyPassword);
    }

    const oibusInfo = getOIBusInfo(engineSettings);
    // Generate RSA key pair
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048, // Length of the key in bits (2048 is standard for RSA)
      publicKeyEncoding: {
        type: 'spki', // Recommended format for public key
        format: 'pem' // Output format for the key
      },
      privateKeyEncoding: {
        type: 'pkcs8', // Recommended format for private key
        format: 'pem' // Output format for the key
      }
    });

    const result = await this.oIAnalyticsClient.register(command, oibusInfo, publicKey);
    this.oIAnalyticsRegistrationRepository.register(
      command,
      result.activationCode,
      result.redirectUrl,
      result.expirationDate,
      publicKey,
      await this.encryptionService.encryptText(privateKey)
    );
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
    try {
      const result = await this.oIAnalyticsClient.checkRegistration(registrationSettings);
      if (result.status !== 'COMPLETED') {
        this.logger.warn(`Registration not completed. Status: ${result.status}`);
      } else {
        const encryptedToken = await this.encryptionService.encryptText(result.accessToken);
        this.oIAnalyticsRegistrationRepository.activate(DateTime.now().toUTC().toISO()!, encryptedToken);
        if (this.intervalCheckRegistration) {
          clearInterval(this.intervalCheckRegistration);
          this.intervalCheckRegistration = null;
        }
        this.logger.info(`OIBus registered on ${registrationSettings.host}`);
        this.registrationEvent.emit('updated'); // used to update logger
        this.registrationEvent.emit('completed'); // used to generate a full-config message
      }
    } catch (error: unknown) {
      this.logger.error(`Error while checking registration: ${(error as Error).message}`);
    }
    this.ongoingCheckRegistration = false;
  }

  async editConnectionSettings(command: RegistrationSettingsCommandDTO): Promise<void> {
    await this.validator.validate(registrationSchema, command);

    const currentRegistration = this.oIAnalyticsRegistrationRepository.get()!;

    if (!command.proxyPassword) {
      command.proxyPassword = currentRegistration.proxyPassword;
    } else {
      command.proxyPassword = await this.encryptionService.encryptText(command.proxyPassword);
    }
    this.oIAnalyticsRegistrationRepository.update(command);
    this.registrationEvent.emit('updated');
  }

  unregister() {
    this.oIAnalyticsRegistrationRepository.unregister();
    if (this.intervalCheckRegistration) {
      clearInterval(this.intervalCheckRegistration);
      this.intervalCheckRegistration = null;
    }
    this.registrationEvent.emit('updated');
  }

  stop() {
    if (this.intervalCheckRegistration) {
      clearInterval(this.intervalCheckRegistration);
      this.intervalCheckRegistration = null;
    }

    this.registrationEvent.removeAllListeners();
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
