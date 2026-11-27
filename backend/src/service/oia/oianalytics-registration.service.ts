import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';

import { DateTime } from 'luxon';

import { RegistrationSettingsCommandDTO, RegistrationSettingsDTO } from '../../../shared/model/api/engine.model';
import { GetUserInfo } from '../../../shared/model/common/types';
import { OIBusConnectionTestResult } from '../../../shared/model/domain/engine.model';
import {
  PresentedServerIdentity,
  ServerIdentity,
  ServerTrustState,
  X509ServerIdentityDetails
} from '../../../shared/model/domain/server-identity.model';

import type { ILogger } from '../../model/logger.model';
import { OIAnalyticsRegistration, OIAnalyticsRegistrationTokens } from '../../model/oianalytics-registration.model';
import { NotFoundError, OIBusValidationError } from '../../model/types';
import CertificateRepository from '../../repository/config/certificate.repository';
import EngineRepository from '../../repository/config/engine.repository';
import OIAnalyticsRegistrationRepository from '../../repository/config/oianalytics-registration.repository';
import JoiValidator from '../../web-server/controllers/validators/joi.validator';
import { registrationSchema } from '../../web-server/controllers/validators/oibus-validation-schema';
import { encryptionService } from '../encryption.service';
import {
  retrieveServerIdentityToTrust,
  testConnectionWithServerIdentity,
  toCertificateStoreServerTrust,
  trustFormCertificateInStore
} from '../server-trust.utils';
import { getErrorMessage, getOIBusInfo } from '../utils';
import { OIAnalyticsTokensDTO } from './oianalytics.model';
import OIAnalyticsClient, {
  formServerIdentity,
  OIAnalyticsInvalidGrantError,
  OIAnalyticsTokenRefreshUnsupportedError
} from './oianalytics-client.service';

const CHECK_REGISTRATION_INTERVAL = 10_000;

/** Adds the certificate of a server to the certificate store as a trusted certificate (see `CertificateService`) */
export type TrustCertificate = (certificatePem: string) => { id: string };

/**
 * The registration settings validate the certificate of OIAnalytics against the certificate trusted in their form (see
 * `RegistrationSettingsCommandDTO.serverTrust`), added to the certificate store
 */
const trustFormCertificate = (command: RegistrationSettingsCommandDTO, trustCertificate: TrustCertificate): void => {
  trustFormCertificateInStore(command, { identity: null, trustOnFirstUse: false }, command.serverTrust, true, trustCertificate);
  delete command.serverTrust;
};
const TOKEN_REFRESH_INTERVAL = 60_000;
// The access token is renewed when it expires in less than this delay
const TOKEN_REFRESH_MARGIN_MS = 10 * 60_000;

/**
 * Encrypt the tokens issued by OIAnalytics, and compute their expiration dates from their lifetimes: OIAnalytics
 * gives lifetimes rather than dates so that the clock of OIBus doesn't need to match its own.
 * An OIAnalytics which can't refresh tokens yet only gives a long-lived access token: it is then the only one stored.
 */
export const toRegistrationTokens = (
  tokens: Pick<OIAnalyticsTokensDTO, 'accessToken'> & Partial<OIAnalyticsTokensDTO>
): OIAnalyticsRegistrationTokens => {
  const now = DateTime.now().toUTC();
  if (!tokens.refreshToken) {
    return {
      token: encryptionService.encryptText(tokens.accessToken),
      refreshToken: null,
      tokenExpirationDate: null,
      refreshTokenExpirationDate: null
    };
  }
  return {
    token: encryptionService.encryptText(tokens.accessToken),
    refreshToken: encryptionService.encryptText(tokens.refreshToken),
    tokenExpirationDate: now.plus({ seconds: tokens.accessTokenExpiresIn! }).toISO()!,
    refreshTokenExpirationDate: now.plus({ seconds: tokens.refreshTokenExpiresIn! }).toISO()!
  };
};

/**
 * The private keys to decrypt the secrets OIAnalytics sends: the current one, then the one replaced by the last key
 * rotation, with which OIAnalytics may still have encrypted secrets before it received the new public key
 */
export const getPrivateCipherKeys = (registration: OIAnalyticsRegistration): Array<string> =>
  [registration.privateCipherKey, registration.previousPrivateCipherKey]
    .filter((key): key is string => !!key)
    .map(key => encryptionService.decryptText(key));

/**
 * Generate the RSA key pair with which OIAnalytics encrypts the secrets it sends, asynchronously to avoid blocking the
 * event loop
 */
const generateCipherKeys = (): Promise<{ publicKey: string; privateKey: string }> =>
  new Promise((resolve, reject) =>
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
      (err, publicKey, privateKey) => {
        if (err) reject(err);
        else resolve({ publicKey, privateKey });
      }
    )
  );

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
    private certificateRepository: CertificateRepository,
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
  async register(command: RegistrationSettingsCommandDTO, updatedBy: string, trustCertificate: TrustCertificate): Promise<void> {
    await this.validator.validate(registrationSchema, command);
    const engineSettings = this.engineRepository.get()!;

    const registrationSettings = this.oIAnalyticsRegistrationRepository.get()!;
    if (!command.proxyPassword) {
      command.proxyPassword = registrationSettings.proxyPassword;
    } else {
      command.proxyPassword = encryptionService.encryptText(command.proxyPassword);
    }

    if (!command.apiGatewayHeaderValue) {
      command.apiGatewayHeaderValue = registrationSettings.apiGatewayHeaderValue;
    } else {
      command.apiGatewayHeaderValue = encryptionService.encryptText(command.apiGatewayHeaderValue);
    }

    const oibusInfo = getOIBusInfo(engineSettings);
    const { publicKey, privateKey } = await generateCipherKeys();

    const result = await this.oIAnalyticsClient.register(command, oibusInfo, publicKey);
    trustFormCertificate(command, trustCertificate);
    this.oIAnalyticsRegistrationRepository.register(
      command,
      result.activationCode,
      result.redirectUrl,
      result.expirationDate,
      publicKey,
      encryptionService.encryptText(privateKey),
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
          toRegistrationTokens({ ...result, accessToken: result.accessToken! })
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
   * The cipher key pair is replaced when the refresh token issued with it would have expired, right before a refresh,
   * which sends the new public key to OIAnalytics (each refresh sends the current one).
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
    let registration = this.oIAnalyticsRegistrationRepository.get()!;
    if (registration.status !== 'REGISTERED') return;
    const exchange = !registration.refreshToken;
    // an OIAnalytics which can't refresh tokens can't receive a new public key either: the keys are only replaced along
    // with refreshable tokens
    const rotateKeys =
      !exchange && (!registration.cipherKeyRotationDate || DateTime.fromISO(registration.cipherKeyRotationDate) <= DateTime.now());
    if (
      !exchange &&
      !rotateKeys &&
      registration.tokenExpirationDate &&
      DateTime.fromISO(registration.tokenExpirationDate).toMillis() - DateTime.now().toMillis() > TOKEN_REFRESH_MARGIN_MS
    ) {
      return;
    }

    if (rotateKeys) {
      try {
        registration = await this.rotateCipherKeys(registration);
      } catch (error: unknown) {
        // the token must be refreshed anyway: the rotation is retried at the next renewal
        this.logger.warn(`Could not replace the OIAnalytics cipher keys, retrying later: ${getErrorMessage(error)}`);
      }
    }
    try {
      const tokens = exchange
        ? await this.oIAnalyticsClient.exchangeToken(registration)
        : await this.oIAnalyticsClient.refreshToken(registration);
      const registrationTokens = toRegistrationTokens(tokens);
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
   * Replace the cipher key pair, before the refresh which sends the new public key to OIAnalytics. If the refresh fails,
   * the next one sends it: meanwhile, the secrets encrypted with the former public key are decrypted with the previous
   * private key. The next rotation is due when the refresh token would have expired.
   */
  private async rotateCipherKeys(registration: OIAnalyticsRegistration): Promise<OIAnalyticsRegistration> {
    const { publicKey, privateKey } = await generateCipherKeys();
    if (!this.isSameRegistration(registration)) return registration;
    this.oIAnalyticsRegistrationRepository.rotateKeys(
      publicKey,
      encryptionService.encryptText(privateKey),
      registration.refreshTokenExpirationDate
    );
    this.logger.info('OIAnalytics cipher keys replaced');
    return this.oIAnalyticsRegistrationRepository.get()!;
  }

  /**
   * Whether the registration is still the one whose tokens were being renewed: OIBus may have been unregistered or
   * registered again meanwhile, in which case the renewal outcome is ignored
   */
  private isSameRegistration(registration: OIAnalyticsRegistration): boolean {
    const current = this.oIAnalyticsRegistrationRepository.get()!;
    return current.status === 'REGISTERED' && current.token === registration.token && current.refreshToken === registration.refreshToken;
  }

  async editRegistrationSettings(
    command: RegistrationSettingsCommandDTO,
    updatedBy: string,
    trustCertificate: TrustCertificate | null = null
  ): Promise<void> {
    await this.validator.validate(registrationSchema, command);
    if (trustCertificate) {
      trustFormCertificate(command, trustCertificate);
    }

    const currentRegistration = this.oIAnalyticsRegistrationRepository.get()!;

    if (!command.proxyPassword) {
      command.proxyPassword = currentRegistration.proxyPassword;
    } else {
      command.proxyPassword = encryptionService.encryptText(command.proxyPassword);
    }
    if (!command.apiGatewayHeaderValue) {
      command.apiGatewayHeaderValue = currentRegistration.apiGatewayHeaderValue;
    } else {
      command.apiGatewayHeaderValue = encryptionService.encryptText(command.apiGatewayHeaderValue);
    }
    this.oIAnalyticsRegistrationRepository.update(command, updatedBy);
    this.registrationEvent.emit('updated');
  }

  /**
   * Tests the connection to OIAnalytics with these settings, after reading the certificate it presents: when it does not
   * validate, the connection is not tested further. With `withServerIdentity` (a client which shows the identity for the
   * user to review and trust it), the result then carries the identity presented; otherwise the test fails.
   */
  async testConnection(tested: RegistrationSettingsCommandDTO, withServerIdentity = false): Promise<OIBusConnectionTestResult> {
    await this.validator.validate(registrationSchema, tested);

    // When registering for the first time (PENDING status), accept 401 as success
    // because the token hasn't been retrieved yet
    const currentRegistration = this.oIAnalyticsRegistrationRepository.get()!;
    const accept401AsSuccess = currentRegistration.status !== 'REGISTERED' || !currentRegistration.token;
    // the secrets are tested as they are saved: encrypted, the saved ones when the form leaves them empty
    const command: RegistrationSettingsCommandDTO = {
      ...tested,
      proxyPassword: tested.proxyPassword ? encryptionService.encryptText(tested.proxyPassword) : currentRegistration.proxyPassword,
      apiGatewayHeaderValue: tested.apiGatewayHeaderValue
        ? encryptionService.encryptText(tested.apiGatewayHeaderValue)
        : currentRegistration.apiGatewayHeaderValue
    };

    let presented: PresentedServerIdentity | null = null;
    return await testConnectionWithServerIdentity(
      {
        retrieveServerIdentity: async () => {
          presented = await this.oIAnalyticsClient.retrieveServerIdentity(command as OIAnalyticsRegistration, formServerIdentity(command));
          return presented?.identity ?? null;
        },
        getServerIdentityTrustStatus: identity => (presented?.identity.fingerprint === identity.fingerprint ? presented.status : 'unknown'),
        testConnection: async () => {
          await this.oIAnalyticsClient.testConnection(command, accept401AsSuccess);
          return { items: [] };
        }
      },
      null,
      withServerIdentity
    );
  }

  /**
   * The trust of the registration in the identity of OIAnalytics: the certificate of the store it validates the certificate
   * of OIAnalytics against, and the identity OIAnalytics presented at the last request refused
   */
  getServerTrustState(): ServerTrustState {
    const registration = this.getRegistrationSettings();
    return {
      ...toCertificateStoreServerTrust(registration, { identity: null, trustOnFirstUse: registration.trustOnFirstUse }, certificateId => {
        const certificate = this.certificateRepository.findById(certificateId);
        if (!certificate) {
          throw new NotFoundError(`Certificate "${certificateId}" not found`);
        }
        return certificate;
      }),
      pending: this.oIAnalyticsClient.pendingServerIdentity
    };
  }

  /**
   * The identity OIAnalytics presents now with the saved settings, and whether it validates, without sending anything.
   * `null` without TLS (an `http://` host).
   */
  async retrieveServerIdentity(): Promise<PresentedServerIdentity | null> {
    return await this.oIAnalyticsClient.retrieveServerIdentity(this.getRegistrationSettings());
  }

  /**
   * Trusts the certificate OIAnalytics presented at the first connection of a registration which accepted any certificate
   * before (see `OIAnalyticsRegistration.trustOnFirstUse`): it is added to the certificate store and selected
   */
  trustCertificateOnFirstUse(identity: ServerIdentity, trustCertificate: TrustCertificate): void {
    // read again: the request may have been sent with the registration as it was before a certificate was trusted
    const registration = this.oIAnalyticsRegistrationRepository.get()!;
    if (!registration.trustOnFirstUse || registration.certificateValidation !== 'trusted' || registration.trustedCertificateId) {
      this.logger.debug(`Certificate of OIAnalytics ${identity.fingerprint} not trusted: the registration no longer awaits one`);
      return;
    }
    try {
      const certificate = (identity.details as X509ServerIdentityDetails).certificate;
      if (!certificate) {
        throw new Error('no certificate presented');
      }
      this.oIAnalyticsRegistrationRepository.trustCertificate(trustCertificate(certificate).id, 'system');
      this.logger.info(`Certificate of OIAnalytics ${identity.fingerprint} trusted at the first connection`);
      this.registrationEvent.emit('updated');
    } catch (error: unknown) {
      this.logger.error(`Could not save the certificate of OIAnalytics trusted at the first connection: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Trusts the certificate OIAnalytics presents, when its fingerprint is the one the user reviewed: it is added to the
   * certificate store (see `trustCertificate`) and the registration validates the certificate of OIAnalytics against it
   */
  async trustServerIdentity(fingerprint: string, trustedBy: string, trustCertificate: TrustCertificate): Promise<void> {
    const registration = this.getRegistrationSettings();
    const identity = await retrieveServerIdentityToTrust(
      { retrieveServerIdentity: async () => (await this.oIAnalyticsClient.retrieveServerIdentity(registration))?.identity ?? null },
      fingerprint
    );
    const certificate = (identity.details as X509ServerIdentityDetails).certificate;
    if (!certificate) {
      throw new OIBusValidationError('OIAnalytics does not present a certificate to trust');
    }
    this.oIAnalyticsRegistrationRepository.trustCertificate(trustCertificate(certificate).id, trustedBy);
    this.registrationEvent.emit('updated');
    this.logger.info(`Identity of OIAnalytics ${identity.fingerprint} trusted by "${trustedBy}"`);
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
    certificateValidation: registration.certificateValidation,
    trustedCertificateId: registration.trustedCertificateId,
    commandRefreshInterval: registration.commandRefreshInterval,
    commandRetryInterval: registration.commandRetryInterval,
    messageRetryInterval: registration.messageRetryInterval,
    commandPermissions: registration.commandPermissions
  };
};
