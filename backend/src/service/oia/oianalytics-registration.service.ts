import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';

import { DateTime } from 'luxon';

import { RegistrationSettingsCommandDTO, RegistrationSettingsDTO } from '../../../shared/model/api/engine.model';
import { GetUserInfo } from '../../../shared/model/common/types';

import type { ILogger } from '../../model/logger.model';
import { OIAnalyticsRegistration, OIAnalyticsRegistrationTokens } from '../../model/oianalytics-registration.model';
import { NotFoundError } from '../../model/types';
import EngineRepository from '../../repository/config/engine.repository';
import OIAnalyticsRegistrationRepository from '../../repository/config/oianalytics-registration.repository';
import JoiValidator from '../../web-server/controllers/validators/joi.validator';
import { registrationSchema } from '../../web-server/controllers/validators/oibus-validation-schema';
import { encryptionService } from '../encryption.service';
import { getErrorMessage, getOIBusInfo } from '../utils';
import { testOIAnalyticsConnection } from '../utils-oianalytics';
import { OIAnalyticsTokensDTO } from './oianalytics.model';
import OIAnalyticsClient, { OIAnalyticsInvalidGrantError, OIAnalyticsTokenRefreshUnsupportedError } from './oianalytics-client.service';

const CHECK_REGISTRATION_INTERVAL = 10_000;
const TOKEN_REFRESH_INTERVAL = 60_000;
// The access token is renewed when it expires in less than this delay
const TOKEN_REFRESH_MARGIN_MS = 10 * 60_000;

/**
 * Encrypt the tokens issued by OIAnalytics, and compute their expiration dates from their lifetimes: OIAnalytics
 * gives lifetimes rather than dates so that the clock of OIBus doesn't need to match its own.
 * An OIAnalytics which can't refresh tokens yet only gives a long-lived access token: it is then the only one stored.
 */
export const toRegistrationTokens = async (
  tokens: Pick<OIAnalyticsTokensDTO, 'accessToken'> & Partial<OIAnalyticsTokensDTO>
): Promise<OIAnalyticsRegistrationTokens> => {
  const now = DateTime.now().toUTC();
  if (!tokens.refreshToken) {
    return {
      token: await encryptionService.encryptText(tokens.accessToken),
      refreshToken: null,
      tokenExpirationDate: null,
      refreshTokenExpirationDate: null
    };
  }
  return {
    token: await encryptionService.encryptText(tokens.accessToken),
    refreshToken: await encryptionService.encryptText(tokens.refreshToken),
    tokenExpirationDate: now.plus({ seconds: tokens.accessTokenExpiresIn! }).toISO()!,
    refreshTokenExpirationDate: now.plus({ seconds: tokens.refreshTokenExpiresIn! }).toISO()!
  };
};

export default class OIAnalyticsRegistrationService {
  private intervalCheckRegistration: NodeJS.Timeout | null = null;
  private ongoingCheckRegistration = false;
  private intervalTokenRefresh: NodeJS.Timeout | null = null;
  private ongoingTokenRefresh: Promise<void> | null = null;
  public registrationEvent: EventEmitter = new EventEmitter(); // Used to trigger logger on (un)registration

  constructor(
    protected readonly validator: JoiValidator,
    private oIAnalyticsClient: OIAnalyticsClient,
    private oIAnalyticsRegistrationRepository: OIAnalyticsRegistrationRepository,
    private engineRepository: EngineRepository,
    private logger: ILogger
  ) {}

  start() {
    const registrationSettings = this.oIAnalyticsRegistrationRepository.get()!;
    if (registrationSettings.checkUrl && registrationSettings.status === 'PENDING') {
      this.intervalCheckRegistration = setInterval(this.checkRegistration.bind(this), CHECK_REGISTRATION_INTERVAL);
    }
    // The tokens are only refreshed when registered: the interval runs whatever the status, to keep them up to date
    // whenever OIBus gets registered
    if (!this.intervalTokenRefresh) {
      this.intervalTokenRefresh = setInterval(this.refreshTokenIfNeeded.bind(this), TOKEN_REFRESH_INTERVAL);
    }
    this.refreshTokenIfNeeded();
  }

  getRegistrationSettings(): OIAnalyticsRegistration {
    const registrationSettings = this.oIAnalyticsRegistrationRepository.get();
    if (!registrationSettings) {
      throw new NotFoundError('Registration settings not found');
    }
    return registrationSettings;
  }

  /**
   * First step, the user wants to register: the service try to reach OIAnalytics to send
   * the activation code. On success, it runs an interval to regularly check if it has been accepted on OIAnalytics
   */
  async register(command: RegistrationSettingsCommandDTO, updatedBy: string): Promise<void> {
    await this.validator.validate(registrationSchema, command);
    const engineSettings = this.engineRepository.get()!;

    const registrationSettings = this.oIAnalyticsRegistrationRepository.get()!;
    if (!command.proxyPassword) {
      command.proxyPassword = registrationSettings.proxyPassword;
    } else {
      command.proxyPassword = await encryptionService.encryptText(command.proxyPassword);
    }

    if (!command.apiGatewayHeaderValue) {
      command.apiGatewayHeaderValue = registrationSettings.apiGatewayHeaderValue;
    } else {
      command.apiGatewayHeaderValue = await encryptionService.encryptText(command.apiGatewayHeaderValue);
    }

    const oibusInfo = getOIBusInfo(engineSettings);
    // Generate an RSA key pair asynchronously to avoid blocking the event loop
    const { publicKey, privateKey } = await new Promise<{ publicKey: string; privateKey: string }>((resolve, reject) =>
      crypto.generateKeyPair(
        'rsa',
        {
          modulusLength: 4096,
          publicKeyEncoding: {
            type: 'spki', // Recommended format for a public key
            format: 'pem' // Output format for the key
          },
          privateKeyEncoding: {
            type: 'pkcs8', // Recommended format for a private key
            format: 'pem' // Output format for the key
          }
        },
        (err, pub, priv) => {
          if (err) reject(err);
          else resolve({ publicKey: pub, privateKey: priv });
        }
      )
    );

    const result = await this.oIAnalyticsClient.register(command, oibusInfo, publicKey);
    this.oIAnalyticsRegistrationRepository.register(
      command,
      result.activationCode,
      result.redirectUrl,
      result.expirationDate,
      publicKey,
      await encryptionService.encryptText(privateKey),
      updatedBy
    );
    if (!this.intervalCheckRegistration) {
      this.intervalCheckRegistration = setInterval(this.checkRegistration.bind(this), CHECK_REGISTRATION_INTERVAL);
    }
  }

  /**
   * The second step of the registration: once the activation code has been sent to OIAnalytics, OIBus
   * regularly checks if it has been accepted by the user on OIAnalytics
   */
  async checkRegistration(): Promise<void> {
    if (this.ongoingCheckRegistration) {
      this.logger.trace(`On going registration check`);
      return;
    }
    const registrationSettings = this.oIAnalyticsRegistrationRepository.get()!;
    this.ongoingCheckRegistration = true;
    try {
      const result = await this.oIAnalyticsClient.checkRegistration(registrationSettings);
      if (result.status !== 'COMPLETED') {
        this.logger.warn(`Registration not completed. Status: ${result.status}`);
      } else {
        this.oIAnalyticsRegistrationRepository.activate(
          DateTime.now().toUTC().toISO()!,
          await toRegistrationTokens({ ...result, accessToken: result.accessToken! })
        );
        if (this.intervalCheckRegistration) {
          clearInterval(this.intervalCheckRegistration);
          this.intervalCheckRegistration = null;
        }
        this.logger.info(`OIBus registered on ${registrationSettings.host}`);
        this.registrationEvent.emit('updated'); // used to update logger and other oianalytics services
      }
    } catch (error: unknown) {
      this.logger.error(`Error while checking registration: ${getErrorMessage(error)}`);
    }
    this.ongoingCheckRegistration = false;
  }

  /**
   * Renew the access token when it is about to expire, with the refresh token. A registration made before the tokens
   * could be refreshed has a long-lived token and no refresh token: its token is exchanged for a refreshable pair.
   * Only one renewal runs at a time: a call during a renewal waits for it.
   */
  refreshTokenIfNeeded(): Promise<void> {
    if (!this.ongoingTokenRefresh) {
      this.ongoingTokenRefresh = this.refreshToken().finally(() => {
        this.ongoingTokenRefresh = null;
      });
    }
    return this.ongoingTokenRefresh;
  }

  private async refreshToken(): Promise<void> {
    const registration = this.oIAnalyticsRegistrationRepository.get()!;
    if (registration.status !== 'REGISTERED') return;
    const exchange = !registration.refreshToken;
    if (
      !exchange &&
      registration.tokenExpirationDate &&
      DateTime.fromISO(registration.tokenExpirationDate).toMillis() - DateTime.now().toMillis() > TOKEN_REFRESH_MARGIN_MS
    ) {
      return;
    }

    try {
      const tokens = exchange
        ? await this.oIAnalyticsClient.exchangeToken(registration)
        : await this.oIAnalyticsClient.refreshToken(registration);
      const registrationTokens = await toRegistrationTokens(tokens);
      if (!this.isSameRegistration(registration)) return;
      this.oIAnalyticsRegistrationRepository.updateTokens(registrationTokens);
      this.logger.debug(exchange ? 'OIAnalytics long-lived token exchanged for a refreshable one' : 'OIAnalytics access token refreshed');
    } catch (error: unknown) {
      if (!this.isSameRegistration(registration)) return;
      if (error instanceof OIAnalyticsInvalidGrantError) {
        this.logger.error(
          `OIAnalytics refused to renew the access token of OIBus: its tokens were revoked or expired. OIBus must be registered again. ${getErrorMessage(error)}`
        );
        this.unregister();
      } else if (error instanceof OIAnalyticsTokenRefreshUnsupportedError) {
        // the OIAnalytics instance has not been upgraded yet: the long-lived token keeps working
        this.logger.trace(`OIAnalytics cannot refresh tokens yet, keeping the long-lived token: ${getErrorMessage(error)}`);
      } else {
        this.logger.warn(`Could not renew the OIAnalytics access token, retrying later: ${getErrorMessage(error)}`);
      }
    }
  }

  /**
   * Whether the registration is still the one whose tokens were being renewed: OIBus may have been unregistered or
   * registered again meanwhile, in which case the renewal outcome is ignored
   */
  private isSameRegistration(registration: OIAnalyticsRegistration): boolean {
    const current = this.oIAnalyticsRegistrationRepository.get()!;
    return current.status === 'REGISTERED' && current.token === registration.token && current.refreshToken === registration.refreshToken;
  }

  async editRegistrationSettings(command: RegistrationSettingsCommandDTO, updatedBy: string): Promise<void> {
    await this.validator.validate(registrationSchema, command);

    const currentRegistration = this.oIAnalyticsRegistrationRepository.get()!;

    if (!command.proxyPassword) {
      command.proxyPassword = currentRegistration.proxyPassword;
    } else {
      command.proxyPassword = await encryptionService.encryptText(command.proxyPassword);
    }
    if (!command.apiGatewayHeaderValue) {
      command.apiGatewayHeaderValue = currentRegistration.apiGatewayHeaderValue;
    } else {
      command.apiGatewayHeaderValue = await encryptionService.encryptText(command.apiGatewayHeaderValue);
    }
    this.oIAnalyticsRegistrationRepository.update(command, updatedBy);
    this.registrationEvent.emit('updated');
  }

  async updateKeys(privateKey: string, publicKey: string, updatedBy: string): Promise<void> {
    this.oIAnalyticsRegistrationRepository.updateKeys(await encryptionService.encryptText(privateKey), publicKey, updatedBy);
  }

  async testConnection(command: RegistrationSettingsCommandDTO): Promise<void> {
    await this.validator.validate(registrationSchema, command);

    // When registering for the first time (PENDING status), accept 401 as success
    // because the token hasn't been retrieved yet
    const currentRegistration = this.oIAnalyticsRegistrationRepository.get()!;
    const accept401AsSuccess = currentRegistration.status !== 'REGISTERED' || !currentRegistration.token;

    // Test the connection with the provided settings
    await testOIAnalyticsConnection(true, command as OIAnalyticsRegistration, null, 30_000, null, accept401AsSuccess);
  }

  unregister(): void {
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
    if (this.intervalTokenRefresh) {
      clearInterval(this.intervalTokenRefresh);
      this.intervalTokenRefresh = null;
    }

    this.registrationEvent.removeAllListeners();
  }
}

export const toOIAnalyticsRegistrationDTO = (registration: OIAnalyticsRegistration, getUserInfo: GetUserInfo): RegistrationSettingsDTO => {
  return {
    id: registration.id,
    createdBy: getUserInfo(registration.createdBy),
    updatedBy: getUserInfo(registration.updatedBy),
    createdAt: registration.createdAt,
    updatedAt: registration.updatedAt,
    host: registration.host,
    activationCode: registration.activationCode,
    status: registration.status,
    activationDate: registration.activationDate,
    activationExpirationDate: registration.activationExpirationDate,
    checkUrl: registration.checkUrl,
    useProxy: registration.useProxy,
    proxyUrl: registration.proxyUrl,
    proxyUsername: registration.proxyUsername,
    useApiGateway: registration.useApiGateway,
    apiGatewayHeaderKey: registration.apiGatewayHeaderKey,
    apiGatewayBaseEndpoint: registration.apiGatewayBaseEndpoint,
    acceptUnauthorized: registration.acceptUnauthorized,
    commandRefreshInterval: registration.commandRefreshInterval,
    commandRetryInterval: registration.commandRetryInterval,
    messageRetryInterval: registration.messageRetryInterval,
    commandPermissions: registration.commandPermissions
  };
};
