import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { afterEach, before, beforeEach, describe, it, type Mock, mock } from 'node:test';

import * as forge from 'node-forge';

import { RegistrationSettingsCommandDTO } from '../../../shared/model/api/engine.model';
import { ServerIdentity } from '../../../shared/model/domain/server-identity.model';

import { OIAnalyticsRegistration } from '../../model/oianalytics-registration.model';
import { NotFoundError } from '../../model/types';
import type CertificateRepository from '../../repository/config/certificate.repository';
import type EngineRepository from '../../repository/config/engine.repository';
import type OIAnalyticsRegistrationRepository from '../../repository/config/oianalytics-registration.repository';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import type LoggerMock from '../../tests/__mocks__/service/logger/logger.mock';
import { createOIAnalyticsClientMock } from '../../tests/__mocks__/service/oia/oianalytics-client.mock';
import testData from '../../tests/utils/test-data';
import { createMock, flushPromises, Mocked, mockModule, reloadModule, seq } from '../../tests/utils/test-utils';
import JoiValidator from '../../web-server/controllers/validators/joi.validator';
import { getErrorMessage } from '../utils';
import type OIAnalyticsClient from './oianalytics-client.service';
import { OIAnalyticsInvalidGrantError, OIAnalyticsTokenRefreshUnsupportedError } from './oianalytics-client.service';
import type OIAnalyticsRegistrationServiceType from './oianalytics-registration.service';
import type {
  getPrivateCipherKeys as getPrivateCipherKeysType,
  toOIAnalyticsRegistrationDTO as toOIAnalyticsRegistrationDTOType
} from './oianalytics-registration.service';

const nodeRequire = createRequire(import.meta.url);

// Mocked module exports — mutated in-place between tests
let mockUtils: Record<string, unknown>;
let mockEncryptionService: { encryptionService: EncryptionServiceMock };

let OIAnalyticsRegistrationService: new (
  ...args: ConstructorParameters<typeof OIAnalyticsRegistrationServiceType>
) => InstanceType<typeof OIAnalyticsRegistrationServiceType>;
let toOIAnalyticsRegistrationDTO: typeof toOIAnalyticsRegistrationDTOType;
let getPrivateCipherKeys: typeof getPrivateCipherKeysType;

before(() => {
  mockUtils = {
    getOIBusInfo: mock.fn(() => testData.engine.oIBusInfo),
    createFolder: mock.fn(),
    filesExists: mock.fn(),
    getErrorMessage
  };
  mockEncryptionService = {
    encryptionService: new EncryptionServiceMock()
  };

  mockModule(nodeRequire, '../utils', mockUtils);
  mockModule(nodeRequire, '../encryption.service', mockEncryptionService);

  const mod = reloadModule<{
    default: new (
      ...args: ConstructorParameters<typeof OIAnalyticsRegistrationServiceType>
    ) => InstanceType<typeof OIAnalyticsRegistrationServiceType>;
    toOIAnalyticsRegistrationDTO: typeof toOIAnalyticsRegistrationDTOType;
    getPrivateCipherKeys: typeof getPrivateCipherKeysType;
  }>(nodeRequire, './oianalytics-registration.service');
  OIAnalyticsRegistrationService = mod.default;
  toOIAnalyticsRegistrationDTO = mod.toOIAnalyticsRegistrationDTO;
  getPrivateCipherKeys = mod.getPrivateCipherKeys;
});

describe('OIAnalytics Registration Service', () => {
  let oIAnalyticsRegistrationRepository: Mocked<OIAnalyticsRegistrationRepository>;
  let engineRepository: Mocked<EngineRepository>;
  let oIAnalyticsClient: Mocked<OIAnalyticsClient>;
  let certificateRepository: Mocked<CertificateRepository>;
  let trustCertificate: Mock<(certificatePem: string) => { id: string }>;
  let logger: LoggerMock;
  let service: InstanceType<typeof OIAnalyticsRegistrationServiceType>;
  beforeEach(() => {
    oIAnalyticsRegistrationRepository = createMock<OIAnalyticsRegistrationRepository>();
    engineRepository = createMock<EngineRepository>();
    oIAnalyticsClient = createOIAnalyticsClientMock();
    certificateRepository = createMock<CertificateRepository>();
    trustCertificate = mock.fn(() => ({ id: 'trustedCertificateId' }));
    logger = new (nodeRequire('../../tests/__mocks__/service/logger/logger.mock') as { default: new () => LoggerMock }).default();

    mockUtils.getOIBusInfo = mock.fn(() => testData.engine.oIBusInfo);
    engineRepository.get.mock.mockImplementation(() => testData.engine.settings);
    // Reset encryptionService mock fns
    mockEncryptionService.encryptionService = new EncryptionServiceMock();

    mock.timers.enable({ apis: ['Date', 'setTimeout', 'setInterval'], now: new Date(testData.constants.dates.FAKE_NOW) });

    const validator = new JoiValidator();
    mock.method(validator, 'validate', async () => undefined);
    service = new OIAnalyticsRegistrationService(
      validator,
      oIAnalyticsClient,
      oIAnalyticsRegistrationRepository,
      engineRepository as EngineRepository,
      certificateRepository,
      logger
    );
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  it('should start with pending registration, checking the registration without renewing any token', () => {
    oIAnalyticsRegistrationRepository.get.mock.mockImplementation(() => testData.oIAnalytics.registration.pending);
    const checkRegistrationMock = mock.fn(async () => undefined);
    service.checkRegistration = checkRegistrationMock;

    service.start();
    mock.timers.tick(10_000);

    assert.strictEqual(checkRegistrationMock.mock.calls.length, 1);
    assert.strictEqual(oIAnalyticsClient.refreshToken.mock.calls.length, 0);
    assert.strictEqual(oIAnalyticsClient.exchangeToken.mock.calls.length, 0);
  });

  it('should start with completed registration, renewing the tokens right away and then regularly', async () => {
    oIAnalyticsRegistrationRepository.get.mock.mockImplementation(() => testData.oIAnalytics.registration.completed);
    const refreshTokenIfNeeded = mock.method(service, 'refreshTokenIfNeeded', async () => undefined);

    service.start();
    service.start();

    assert.strictEqual(refreshTokenIfNeeded.mock.calls.length, 2);
    mock.timers.tick(60_000);
    // a second start does not run a second interval
    assert.strictEqual(refreshTokenIfNeeded.mock.calls.length, 3);
    service.stop();
    mock.timers.tick(60_000);
    assert.strictEqual(refreshTokenIfNeeded.mock.calls.length, 3);
  });

  it('should get registration settings', () => {
    oIAnalyticsRegistrationRepository.get.mock.mockImplementation(() => testData.oIAnalytics.registration.completed);

    assert.deepStrictEqual(service.getRegistrationSettings(), testData.oIAnalytics.registration.completed);
    assert.strictEqual(oIAnalyticsRegistrationRepository.get.mock.calls.length, 1);
  });

  it('should not get registration settings if not found', () => {
    oIAnalyticsRegistrationRepository.get.mock.mockImplementation(() => null);

    assert.throws(() => service.getRegistrationSettings(), new NotFoundError('Registration settings not found'));
    assert.strictEqual(oIAnalyticsRegistrationRepository.get.mock.calls.length, 1);
  });

  it('should register', async () => {
    oIAnalyticsRegistrationRepository.get.mock.mockImplementation(
      seq(
        () => testData.oIAnalytics.registration.completed,
        () => testData.oIAnalytics.registration.completed
      )
    );
    mockUtils.getOIBusInfo = mock.fn(
      seq(
        () => testData.engine.oIBusInfo,
        () => testData.engine.oIBusInfo
      )
    );
    const result = {
      redirectUrl: 'http://localhost:4200/api/oianalytics/oibus/check-registration?id=id',
      expirationDate: testData.constants.dates.FAKE_NOW,
      activationCode: '123ABC'
    };
    oIAnalyticsClient.register.mock.mockImplementationOnce(async () => result);
    oIAnalyticsClient.register.mock.mockImplementationOnce(async () => result);

    mock.method(crypto, 'generateKeyPair', (_type: unknown, _options: unknown, cb: (err: null, pub: string, priv: string) => void) => {
      cb(null, 'public key', 'private key');
    });
    const checkRegistrationMock = mock.fn(async () => undefined);
    service.checkRegistration = checkRegistrationMock;

    await service.register(testData.oIAnalytics.registration.command, testData.users.list[0].id, trustCertificate);

    assert.strictEqual(mockEncryptionService.encryptionService.encryptText.mock.calls.length, 1);
    assert.strictEqual(engineRepository.get.mock.calls.length, 1);
    assert.strictEqual(oIAnalyticsClient.register.mock.calls.length, 1);
    assert.strictEqual((mockUtils.getOIBusInfo as ReturnType<typeof mock.fn>).mock.calls.length, 1);
    assert.deepStrictEqual(oIAnalyticsRegistrationRepository.register.mock.calls[0].arguments, [
      testData.oIAnalytics.registration.command,
      result.activationCode,
      'http://localhost:4200/api/oianalytics/oibus/check-registration?id=id',
      testData.constants.dates.FAKE_NOW,
      'public key',
      'private key',
      testData.users.list[0].id
    ]);

    mock.timers.tick(10_000);
    assert.strictEqual(checkRegistrationMock.mock.calls.length, 1);

    await service.register(testData.oIAnalytics.registration.command, testData.users.list[0].id, trustCertificate);
    mock.timers.tick(10_000);
    assert.strictEqual(checkRegistrationMock.mock.calls.length, 2);
  });

  it('should reject registration when key pair generation fails', async () => {
    oIAnalyticsRegistrationRepository.get.mock.mockImplementation(() => testData.oIAnalytics.registration.completed);

    const keyPairError = new Error('key pair generation failed');
    mock.method(
      crypto,
      'generateKeyPair',
      (_type: unknown, _options: unknown, cb: (err: Error | null, pub?: string, priv?: string) => void) => {
        cb(keyPairError);
      }
    );

    await assert.rejects(
      service.register(testData.oIAnalytics.registration.command, testData.users.list[0].id, trustCertificate),
      keyPairError
    );

    assert.strictEqual(oIAnalyticsClient.register.mock.calls.length, 0);
  });

  it('should register with proxy', async () => {
    const command: Omit<OIAnalyticsRegistration, 'id' | 'status' | 'activationDate'> = {
      host: 'http://localhost:4200/',
      certificateValidation: 'standard',
      trustedCertificateId: null,
      trustOnFirstUse: false,
      useProxy: true,
      proxyUrl: 'http://localhost:3128',
      proxyUsername: 'user',
      proxyPassword: 'pass',
      useApiGateway: true,
      apiGatewayHeaderKey: 'headerKey',
      apiGatewayHeaderValue: 'headerValue',
      apiGatewayBaseEndpoint: '/oianalytics',
      activationCode: null,
      token: null,
      refreshToken: null,
      tokenExpirationDate: null,
      refreshTokenExpirationDate: null,
      publicCipherKey: null,
      privateCipherKey: null,
      previousPrivateCipherKey: null,
      cipherKeyRotationDate: null,
      checkUrl: null,
      commandRefreshInterval: 10,
      commandRetryInterval: 5,
      messageRetryInterval: 5,
      commandPermissions: {
        updateVersion: true,
        operate: true,
        configureEngine: true,
        configureDataFlow: true,
        configureCustomCode: true,
        manageAccess: true,
        manageRegistration: true,
        connectToDataSources: true,
        manageCache: true,
        diagnostics: true,
        setpoint: true
      },
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };
    const result = {
      redirectUrl: 'http://localhost:4200/api/oianalytics/oibus/check-registration?id=id',
      expirationDate: testData.constants.dates.FAKE_NOW,
      activationCode: '123ABC'
    };
    mock.method(crypto, 'generateKeyPair', (_type: unknown, _options: unknown, cb: (err: null, pub: string, priv: string) => void) => {
      cb(null, 'public key', 'private key');
    });
    oIAnalyticsClient.register.mock.mockImplementationOnce(async () => result);

    await service.register(command, testData.users.list[0].id, trustCertificate);
    assert.strictEqual(mockEncryptionService.encryptionService.encryptText.mock.calls.length, 3);
    assert.strictEqual(oIAnalyticsClient.register.mock.calls.length, 1);
    assert.deepStrictEqual(oIAnalyticsRegistrationRepository.register.mock.calls[0].arguments, [
      command,
      result.activationCode,
      'http://localhost:4200/api/oianalytics/oibus/check-registration?id=id',
      testData.constants.dates.FAKE_NOW,
      'public key',
      'private key',
      testData.users.list[0].id
    ]);
  });

  it('should edit registration connection settings', async () => {
    oIAnalyticsRegistrationRepository.get.mock.mockImplementation(() => testData.oIAnalytics.registration.completed);

    await service.editRegistrationSettings(testData.oIAnalytics.registration.command, testData.users.list[0].id, trustCertificate);

    assert.deepStrictEqual(oIAnalyticsRegistrationRepository.update.mock.calls[0].arguments, [
      testData.oIAnalytics.registration.command,
      testData.users.list[0].id
    ]);
  });

  it('should edit registration settings when no proxy nor api gateway is configured (null fields)', async () => {
    oIAnalyticsRegistrationRepository.get.mock.mockImplementation(() => testData.oIAnalytics.registration.completed);

    const command: RegistrationSettingsCommandDTO = {
      ...testData.oIAnalytics.registration.command,
      useProxy: false,
      proxyUrl: null,
      proxyUsername: null,
      proxyPassword: null,
      useApiGateway: false,
      apiGatewayHeaderKey: null,
      apiGatewayHeaderValue: null,
      apiGatewayBaseEndpoint: null
    };

    await assert.doesNotReject(service.editRegistrationSettings(command, testData.users.list[0].id, trustCertificate));
    assert.strictEqual(oIAnalyticsRegistrationRepository.update.mock.calls.length, 1);
  });

  it('should edit registration with proxy', async () => {
    const command: RegistrationSettingsCommandDTO = {
      host: 'http://localhost:4200/',
      certificateValidation: 'standard',
      trustedCertificateId: null,
      useProxy: true,
      proxyUrl: 'http://localhost:3128',
      proxyUsername: 'user',
      proxyPassword: 'pass',
      useApiGateway: true,
      apiGatewayHeaderKey: 'headerKey',
      apiGatewayHeaderValue: 'headerValue',
      apiGatewayBaseEndpoint: '/oianalytics',
      commandRefreshInterval: 10,
      commandRetryInterval: 5,
      messageRetryInterval: 5,
      commandPermissions: {
        updateVersion: true,
        operate: true,
        configureEngine: true,
        configureDataFlow: true,
        configureCustomCode: true,
        manageAccess: true,
        manageRegistration: true,
        connectToDataSources: true,
        manageCache: true,
        diagnostics: true,
        setpoint: true
      }
    };
    oIAnalyticsRegistrationRepository.get.mock.mockImplementation(() => testData.oIAnalytics.registration.completed);

    await service.editRegistrationSettings(command, testData.users.list[0].id, trustCertificate);

    assert.deepStrictEqual(oIAnalyticsRegistrationRepository.update.mock.calls[0].arguments, [command, testData.users.list[0].id]);
  });

  it('should unregister and not clear interval if it does not exist', () => {
    service.unregister();

    assert.strictEqual(oIAnalyticsRegistrationRepository.unregister.mock.calls.length, 1);
  });

  it('should unregister and clear interval if it exists', () => {
    oIAnalyticsRegistrationRepository.get.mock.mockImplementation(() => testData.oIAnalytics.registration.pending);

    service.start(); // start with pending registration to set interval
    service.unregister();

    assert.strictEqual(oIAnalyticsRegistrationRepository.unregister.mock.calls.length, 1);
  });

  it('should stop and clear interval if it exists', () => {
    oIAnalyticsRegistrationRepository.get.mock.mockImplementation(() => testData.oIAnalytics.registration.pending);

    service.start(); // start with pending registration to set interval
    service.stop();
    service.stop();

    // second stop() is a no-op — interval was already cleared on first call
  });

  it('should check registration', async () => {
    oIAnalyticsRegistrationRepository.get.mock.mockImplementation(() => testData.oIAnalytics.registration.pending);
    const result = {
      status: 'COMPLETED',
      expired: true,
      accessToken: 'access_token',
      accessTokenExpiresIn: 3600,
      refreshToken: 'refresh_token',
      refreshTokenExpiresIn: 7_776_000
    };
    oIAnalyticsClient.checkRegistration.mock.mockImplementationOnce(async () => result);
    const updatedListener = mock.fn();
    service.registrationEvent.on('updated', updatedListener);

    service.start(); // start with pending registration to set interval
    await service.checkRegistration();

    assert.strictEqual(oIAnalyticsClient.checkRegistration.mock.calls.length, 1);
    assert.deepStrictEqual(
      mockEncryptionService.encryptionService.encryptText.mock.calls.map(call => call.arguments),
      [['access_token'], ['refresh_token']]
    );
    assert.deepStrictEqual(oIAnalyticsRegistrationRepository.activate.mock.calls[0].arguments, [
      testData.constants.dates.FAKE_NOW,
      {
        token: 'access_token',
        refreshToken: 'refresh_token',
        tokenExpirationDate: '2021-01-02T01:00:00.000Z',
        refreshTokenExpirationDate: '2021-04-02T00:00:00.000Z'
      }
    ]);
    assert.strictEqual(updatedListener.mock.calls.length, 1);
  });

  it('should check registration and keep the long-lived token of an OIAnalytics which cannot refresh tokens', async () => {
    oIAnalyticsRegistrationRepository.get.mock.mockImplementation(() => testData.oIAnalytics.registration.pending);
    oIAnalyticsClient.checkRegistration.mock.mockImplementationOnce(async () => ({
      status: 'COMPLETED',
      expired: false,
      accessToken: 'long_lived_token'
    }));

    await service.checkRegistration();

    assert.deepStrictEqual(oIAnalyticsRegistrationRepository.activate.mock.calls[0].arguments, [
      testData.constants.dates.FAKE_NOW,
      { token: 'long_lived_token', refreshToken: null, tokenExpirationDate: null, refreshTokenExpirationDate: null }
    ]);
  });

  it('should check registration and return because already checking', async () => {
    oIAnalyticsRegistrationRepository.get.mock.mockImplementation(() => testData.oIAnalytics.registration.pending);
    const result = { status: 'COMPLETED', expired: true, accessToken: 'access_token' };
    oIAnalyticsClient.checkRegistration.mock.mockImplementation(async () => result);

    service.checkRegistration();
    await service.checkRegistration();

    assert.ok(logger.trace.mock.calls.some((c: { arguments: Array<string> }) => c.arguments[0] === 'On going registration check'));
    await flushPromises();
  });

  it('should check registration but fail because of return status', async () => {
    oIAnalyticsRegistrationRepository.get.mock.mockImplementation(() => testData.oIAnalytics.registration.pending);
    const result = { status: 'DECLINED', expired: true, accessToken: 'access_token' };
    oIAnalyticsClient.checkRegistration.mock.mockImplementationOnce(async () => result);

    await service.checkRegistration();

    assert.strictEqual(oIAnalyticsClient.checkRegistration.mock.calls.length, 1);
    assert.ok(
      logger.warn.mock.calls.some((c: { arguments: Array<string> }) => c.arguments[0] === 'Registration not completed. Status: DECLINED')
    );
  });

  it('should check registration but fail because of client error', async () => {
    oIAnalyticsRegistrationRepository.get.mock.mockImplementation(() => testData.oIAnalytics.registration.pending);
    oIAnalyticsClient.checkRegistration.mock.mockImplementationOnce(() => {
      throw new Error('error');
    });

    await service.checkRegistration();

    assert.strictEqual(oIAnalyticsClient.checkRegistration.mock.calls.length, 1);
    assert.ok(
      logger.error.mock.calls.some((c: { arguments: Array<string> }) => c.arguments[0] === 'Error while checking registration: error')
    );
  });

  it('should check registration but fail with AggregateError and log proper message', async () => {
    oIAnalyticsRegistrationRepository.get.mock.mockImplementation(() => testData.oIAnalytics.registration.pending);
    const networkError = new AggregateError([new Error('connect ECONNREFUSED 127.0.0.1:4200')], '');
    oIAnalyticsClient.checkRegistration.mock.mockImplementationOnce(() => {
      throw networkError;
    });

    await service.checkRegistration();

    assert.ok(
      logger.error.mock.calls.some((c: { arguments: Array<string> }) => c.arguments[0].includes('connect ECONNREFUSED 127.0.0.1:4200'))
    );
  });

  describe('token renewal', () => {
    const expiringRegistration = (overrides: Partial<OIAnalyticsRegistration> = {}): OIAnalyticsRegistration => ({
      ...testData.oIAnalytics.registration.completed,
      tokenExpirationDate: '2021-01-02T00:09:59.000Z', // FAKE_NOW + 9min59s
      ...overrides
    });
    const tokens = {
      accessToken: 'new_access_token',
      accessTokenExpiresIn: 3600,
      refreshToken: 'new_refresh_token',
      refreshTokenExpiresIn: 7_776_000
    };
    const expectedTokens = {
      token: 'new_access_token',
      refreshToken: 'new_refresh_token',
      tokenExpirationDate: '2021-01-02T01:00:00.000Z',
      refreshTokenExpirationDate: '2021-04-02T00:00:00.000Z'
    };

    it('should not renew the tokens when not registered', async () => {
      oIAnalyticsRegistrationRepository.get.mock.mockImplementation(() => testData.oIAnalytics.registration.pending);

      await service.refreshTokenIfNeeded();

      assert.strictEqual(oIAnalyticsClient.refreshToken.mock.calls.length, 0);
      assert.strictEqual(oIAnalyticsClient.exchangeToken.mock.calls.length, 0);
    });

    it('should not renew the access token while it is valid for more than 10 minutes', async () => {
      oIAnalyticsRegistrationRepository.get.mock.mockImplementation(() =>
        expiringRegistration({ tokenExpirationDate: '2021-01-02T00:10:01.000Z' })
      );

      await service.refreshTokenIfNeeded();

      assert.strictEqual(oIAnalyticsClient.refreshToken.mock.calls.length, 0);
      assert.strictEqual(oIAnalyticsRegistrationRepository.updateTokens.mock.calls.length, 0);
    });

    it('should renew the access token when it expires within 10 minutes', async () => {
      const registration = expiringRegistration();
      oIAnalyticsRegistrationRepository.get.mock.mockImplementation(() => registration);
      oIAnalyticsClient.refreshToken.mock.mockImplementationOnce(async () => tokens);

      await service.refreshTokenIfNeeded();

      assert.deepStrictEqual(oIAnalyticsClient.refreshToken.mock.calls[0].arguments, [registration]);
      assert.strictEqual(oIAnalyticsClient.exchangeToken.mock.calls.length, 0);
      assert.deepStrictEqual(oIAnalyticsRegistrationRepository.updateTokens.mock.calls[0].arguments, [expectedTokens]);
      assert.ok(logger.debug.mock.calls.some((c: { arguments: Array<string> }) => c.arguments[0] === 'OIAnalytics access token refreshed'));
    });

    it('should renew the access token when its expiration date is unknown', async () => {
      oIAnalyticsRegistrationRepository.get.mock.mockImplementation(() => expiringRegistration({ tokenExpirationDate: null }));
      oIAnalyticsClient.refreshToken.mock.mockImplementationOnce(async () => tokens);

      await service.refreshTokenIfNeeded();

      assert.deepStrictEqual(oIAnalyticsRegistrationRepository.updateTokens.mock.calls[0].arguments, [expectedTokens]);
    });

    it('should exchange the long-lived token of a registration without refresh token', async () => {
      const registration = expiringRegistration({ refreshToken: null, tokenExpirationDate: null, refreshTokenExpirationDate: null });
      oIAnalyticsRegistrationRepository.get.mock.mockImplementation(() => registration);
      oIAnalyticsClient.exchangeToken.mock.mockImplementationOnce(async () => tokens);

      await service.refreshTokenIfNeeded();

      assert.deepStrictEqual(oIAnalyticsClient.exchangeToken.mock.calls[0].arguments, [registration]);
      assert.strictEqual(oIAnalyticsClient.refreshToken.mock.calls.length, 0);
      assert.deepStrictEqual(oIAnalyticsRegistrationRepository.updateTokens.mock.calls[0].arguments, [expectedTokens]);
    });

    it('should run a single renewal at a time', async () => {
      oIAnalyticsRegistrationRepository.get.mock.mockImplementation(() => expiringRegistration());
      oIAnalyticsClient.refreshToken.mock.mockImplementationOnce(async () => tokens);

      const first = service.refreshTokenIfNeeded();
      const second = service.refreshTokenIfNeeded();
      assert.strictEqual(first, second);
      await first;
      await service.refreshTokenIfNeeded(); // a later call runs a new renewal

      assert.strictEqual(oIAnalyticsClient.refreshToken.mock.calls.length, 2);
    });

    it('should unregister when OIAnalytics refuses the refresh token', async () => {
      oIAnalyticsRegistrationRepository.get.mock.mockImplementation(() => expiringRegistration());
      oIAnalyticsClient.refreshToken.mock.mockImplementationOnce(async () => {
        throw new OIAnalyticsInvalidGrantError('401 - {"error":"invalid_grant"}');
      });
      const updatedListener = mock.fn();
      service.registrationEvent.on('updated', updatedListener);

      await service.refreshTokenIfNeeded();

      assert.strictEqual(oIAnalyticsRegistrationRepository.updateTokens.mock.calls.length, 0);
      assert.strictEqual(oIAnalyticsRegistrationRepository.unregister.mock.calls.length, 1);
      assert.strictEqual(updatedListener.mock.calls.length, 1);
      assert.ok(
        logger.error.mock.calls.some((c: { arguments: Array<string> }) =>
          c.arguments[0].startsWith('OIAnalytics refused to renew the access token of OIBus: its tokens were revoked or expired.')
        )
      );
    });

    it('should retry later when the renewal fails for another reason', async () => {
      oIAnalyticsRegistrationRepository.get.mock.mockImplementation(() => expiringRegistration());
      oIAnalyticsClient.refreshToken.mock.mockImplementationOnce(async () => {
        throw new Error('502 - Bad Gateway');
      });

      await service.refreshTokenIfNeeded();

      assert.strictEqual(oIAnalyticsRegistrationRepository.unregister.mock.calls.length, 0);
      assert.ok(
        logger.warn.mock.calls.some(
          (c: { arguments: Array<string> }) =>
            c.arguments[0] === 'Could not renew the OIAnalytics access token, retrying later: 502 - Bad Gateway'
        )
      );
    });

    it('should keep the long-lived token when OIAnalytics cannot exchange it yet', async () => {
      oIAnalyticsRegistrationRepository.get.mock.mockImplementation(() =>
        expiringRegistration({ refreshToken: null, tokenExpirationDate: null, refreshTokenExpirationDate: null })
      );
      oIAnalyticsClient.exchangeToken.mock.mockImplementationOnce(async () => {
        throw new OIAnalyticsTokenRefreshUnsupportedError('404 - Not Found');
      });

      await service.refreshTokenIfNeeded();

      assert.strictEqual(oIAnalyticsRegistrationRepository.updateTokens.mock.calls.length, 0);
      assert.strictEqual(oIAnalyticsRegistrationRepository.unregister.mock.calls.length, 0);
      assert.strictEqual(logger.warn.mock.calls.length, 0);
      assert.strictEqual(logger.error.mock.calls.length, 0);
    });

    describe('cipher key rotation', () => {
      // a registration whose access token doesn't need to be refreshed yet
      const validRegistration = (overrides: Partial<OIAnalyticsRegistration> = {}): OIAnalyticsRegistration =>
        expiringRegistration({
          tokenExpirationDate: '2021-01-02T01:00:00.000Z',
          refreshTokenExpirationDate: '2021-04-01T23:00:00.000Z',
          ...overrides
        });
      let current: OIAnalyticsRegistration;

      beforeEach(() => {
        oIAnalyticsRegistrationRepository.get.mock.mockImplementation(() => current);
        oIAnalyticsRegistrationRepository.rotateKeys.mock.mockImplementation((publicKey, privateKey, rotationDate) => {
          current = {
            ...current,
            publicCipherKey: publicKey,
            privateCipherKey: privateKey,
            previousPrivateCipherKey: current.privateCipherKey,
            cipherKeyRotationDate: rotationDate
          };
        });
        oIAnalyticsClient.refreshToken.mock.mockImplementation(async () => tokens);
      });

      const mockKeyPairGeneration = (error: Error | null = null) =>
        mock.method(
          crypto,
          'generateKeyPair',
          (_type: unknown, _options: unknown, cb: (err: Error | null, pub?: string, priv?: string) => void) => {
            if (error) cb(error);
            else cb(null, 'new public key', 'new private key');
          }
        );

      it('should replace the keys when their rotation date has passed, and send the new public key with a refresh', async () => {
        current = validRegistration({ cipherKeyRotationDate: testData.constants.dates.FAKE_NOW });
        mockKeyPairGeneration();

        await service.refreshTokenIfNeeded();

        // the next rotation is due when the refresh token would have expired
        assert.deepStrictEqual(oIAnalyticsRegistrationRepository.rotateKeys.mock.calls[0].arguments, [
          'new public key',
          'new private key',
          '2021-04-01T23:00:00.000Z'
        ]);
        assert.strictEqual(oIAnalyticsClient.refreshToken.mock.calls.length, 1);
        assert.strictEqual(oIAnalyticsClient.refreshToken.mock.calls[0].arguments[0].publicCipherKey, 'new public key');
        assert.deepStrictEqual(oIAnalyticsRegistrationRepository.updateTokens.mock.calls[0].arguments, [expectedTokens]);
        assert.ok(logger.info.mock.calls.some((c: { arguments: Array<string> }) => c.arguments[0] === 'OIAnalytics cipher keys replaced'));
      });

      it('should replace at the first refresh the keys of a registration without rotation date', async () => {
        current = validRegistration({ cipherKeyRotationDate: null });
        mockKeyPairGeneration();

        await service.refreshTokenIfNeeded();

        assert.strictEqual(oIAnalyticsRegistrationRepository.rotateKeys.mock.calls.length, 1);
        assert.strictEqual(oIAnalyticsClient.refreshToken.mock.calls.length, 1);
      });

      it('should not replace the keys before their rotation date', async () => {
        current = validRegistration({ cipherKeyRotationDate: '2021-01-02T00:00:01.000Z' });
        const generateKeyPair = mockKeyPairGeneration();

        await service.refreshTokenIfNeeded();

        assert.strictEqual(generateKeyPair.mock.calls.length, 0);
        assert.strictEqual(oIAnalyticsClient.refreshToken.mock.calls.length, 0);
      });

      it('should not replace the keys of a registration without refresh token', async () => {
        current = validRegistration({ refreshToken: null, refreshTokenExpirationDate: null, cipherKeyRotationDate: null });
        oIAnalyticsClient.exchangeToken.mock.mockImplementationOnce(async () => tokens);
        const generateKeyPair = mockKeyPairGeneration();

        await service.refreshTokenIfNeeded();

        assert.strictEqual(generateKeyPair.mock.calls.length, 0);
        assert.strictEqual(oIAnalyticsClient.exchangeToken.mock.calls.length, 1);
      });

      it('should refresh the token even when the keys cannot be replaced', async () => {
        current = validRegistration({ cipherKeyRotationDate: null });
        mockKeyPairGeneration(new Error('key pair generation failed'));

        await service.refreshTokenIfNeeded();

        assert.strictEqual(oIAnalyticsRegistrationRepository.rotateKeys.mock.calls.length, 0);
        assert.strictEqual(oIAnalyticsClient.refreshToken.mock.calls[0].arguments[0].publicCipherKey, 'public key');
        assert.ok(
          logger.warn.mock.calls.some(
            (c: { arguments: Array<string> }) =>
              c.arguments[0] === 'Could not replace the OIAnalytics cipher keys, retrying later: key pair generation failed'
          )
        );
      });

      it('should not replace the keys of a registration changed during their generation', async () => {
        current = validRegistration({ cipherKeyRotationDate: null });
        mock.method(
          crypto,
          'generateKeyPair',
          (_type: unknown, _options: unknown, cb: (err: Error | null, pub?: string, priv?: string) => void) => {
            current = testData.oIAnalytics.registration.pending;
            cb(null, 'new public key', 'new private key');
          }
        );

        await service.refreshTokenIfNeeded();

        assert.strictEqual(oIAnalyticsRegistrationRepository.rotateKeys.mock.calls.length, 0);
        assert.strictEqual(oIAnalyticsRegistrationRepository.updateTokens.mock.calls.length, 0);
      });
    });

    it('should ignore the renewal outcome when the registration changed meanwhile', async () => {
      oIAnalyticsRegistrationRepository.get.mock.mockImplementation(
        seq(
          () => expiringRegistration(),
          () => testData.oIAnalytics.registration.pending,
          () => expiringRegistration(),
          () => expiringRegistration({ refreshToken: 'another refresh token' })
        )
      );
      oIAnalyticsClient.refreshToken.mock.mockImplementationOnce(async () => tokens);
      oIAnalyticsClient.refreshToken.mock.mockImplementationOnce(async () => {
        throw new OIAnalyticsInvalidGrantError('401 - {"error":"invalid_grant"}');
      }, 1);

      await service.refreshTokenIfNeeded();
      await service.refreshTokenIfNeeded();

      assert.strictEqual(oIAnalyticsClient.refreshToken.mock.calls.length, 2);
      assert.strictEqual(oIAnalyticsRegistrationRepository.updateTokens.mock.calls.length, 0);
      assert.strictEqual(oIAnalyticsRegistrationRepository.unregister.mock.calls.length, 0);
    });
  });

  it('should test connection', async () => {
    oIAnalyticsRegistrationRepository.get.mock.mockImplementation(() => testData.oIAnalytics.registration.completed);

    assert.deepStrictEqual(await service.testConnection(testData.oIAnalytics.registration.command), { items: [] });

    assert.deepStrictEqual(oIAnalyticsClient.retrieveServerIdentity.mock.calls[0].arguments, [
      testData.oIAnalytics.registration.command,
      null
    ]);
    assert.deepStrictEqual(oIAnalyticsClient.testConnection.mock.calls[0].arguments, [testData.oIAnalytics.registration.command, false]);
  });

  describe('identity of OIAnalytics', () => {
    const identity: ServerIdentity = { type: 'x509', fingerprint: 'AB:CD', details: { keyType: 'rsa', certificate: 'pem' } };

    it('should test the connection with a certificate which validates', async () => {
      oIAnalyticsRegistrationRepository.get.mock.mockImplementation(() => testData.oIAnalytics.registration.pending);
      oIAnalyticsClient.retrieveServerIdentity.mock.mockImplementation(async () => ({ identity, status: 'trusted' }));
      const command = { ...testData.oIAnalytics.registration.command, serverTrust: { identity, trustOnFirstUse: false } };

      assert.deepStrictEqual(await service.testConnection(command, true), {
        items: [],
        serverIdentity: { identity, status: 'trusted' }
      });
      // the secrets left empty in the form are the saved ones
      const tested = {
        ...command,
        proxyPassword: testData.oIAnalytics.registration.pending.proxyPassword,
        apiGatewayHeaderValue: testData.oIAnalytics.registration.pending.apiGatewayHeaderValue
      };
      assert.deepStrictEqual(oIAnalyticsClient.retrieveServerIdentity.mock.calls[0].arguments, [tested, identity]);
      assert.deepStrictEqual(oIAnalyticsClient.testConnection.mock.calls[0].arguments, [tested, true]);
    });

    it('should test the connection with the secrets of the form encrypted, as they are saved', async () => {
      oIAnalyticsRegistrationRepository.get.mock.mockImplementation(() => testData.oIAnalytics.registration.completed);
      mockEncryptionService.encryptionService.encryptText.mock.mockImplementation(text => `encrypted ${text}`);

      await service.testConnection({ ...testData.oIAnalytics.registration.command, proxyPassword: 'pass', apiGatewayHeaderValue: 'key' });

      const [tested] = oIAnalyticsClient.testConnection.mock.calls[0].arguments;
      assert.strictEqual(tested.proxyPassword, 'encrypted pass');
      assert.strictEqual(tested.apiGatewayHeaderValue, 'encrypted key');
    });

    it('should not test the connection further with a certificate which does not validate', async () => {
      oIAnalyticsRegistrationRepository.get.mock.mockImplementation(() => testData.oIAnalytics.registration.completed);
      oIAnalyticsClient.retrieveServerIdentity.mock.mockImplementation(async () => ({ identity, status: 'unknown' }));

      assert.deepStrictEqual(await service.testConnection(testData.oIAnalytics.registration.command, true), {
        items: [],
        serverIdentity: { identity, status: 'unknown' }
      });
      await assert.rejects(service.testConnection(testData.oIAnalytics.registration.command, false));
      assert.strictEqual(oIAnalyticsClient.testConnection.mock.calls.length, 0);
    });

    it('should give the trusted certificate of the registration, and the identity refused', () => {
      const pending = { identity, status: 'unknown' as const };
      Object.assign(oIAnalyticsClient, { pendingServerIdentity: pending });
      oIAnalyticsRegistrationRepository.get.mock.mockImplementation(() => testData.oIAnalytics.registration.completed);

      assert.deepStrictEqual(service.getServerTrustState(), { identity: null, trustOnFirstUse: false, pending });
    });

    it('should give the certificate of the store the registration trusts', () => {
      const keys = forge.pki.rsa.generateKeyPair(1024);
      const forgeCertificate = forge.pki.createCertificate();
      forgeCertificate.publicKey = keys.publicKey;
      forgeCertificate.setSubject([{ shortName: 'CN', value: 'OIAnalytics' }]);
      forgeCertificate.setIssuer([{ shortName: 'CN', value: 'OIAnalytics' }]);
      forgeCertificate.sign(keys.privateKey, forge.md.sha256.create());
      const certificate = { ...testData.certificates.list[0], certificate: forge.pki.certificateToPem(forgeCertificate) };
      oIAnalyticsRegistrationRepository.get.mock.mockImplementation(() => ({
        ...testData.oIAnalytics.registration.completed,
        certificateValidation: 'trusted',
        trustedCertificateId: certificate.id
      }));
      certificateRepository.findById.mock.mockImplementation(() => certificate);

      const state = service.getServerTrustState();

      assert.strictEqual(state.identity!.fingerprint, new crypto.X509Certificate(certificate.certificate).fingerprint256);
      assert.strictEqual(state.identity!.trustedBy, certificate.createdBy);
      assert.deepStrictEqual(certificateRepository.findById.mock.calls[0].arguments, [certificate.id]);
    });

    it('should fail to give a trusted certificate missing from the store', () => {
      oIAnalyticsRegistrationRepository.get.mock.mockImplementation(() => ({
        ...testData.oIAnalytics.registration.completed,
        certificateValidation: 'trusted',
        trustedCertificateId: 'missing'
      }));

      assert.throws(() => service.getServerTrustState(), { message: 'Certificate "missing" not found' });
    });

    it('should retrieve the identity OIAnalytics presents with the saved settings', async () => {
      oIAnalyticsRegistrationRepository.get.mock.mockImplementation(() => testData.oIAnalytics.registration.completed);
      oIAnalyticsClient.retrieveServerIdentity.mock.mockImplementation(async () => ({ identity, status: 'unknown' }));

      assert.deepStrictEqual(await service.retrieveServerIdentity(), { identity, status: 'unknown' });
      assert.deepStrictEqual(oIAnalyticsClient.retrieveServerIdentity.mock.calls[0].arguments, [
        testData.oIAnalytics.registration.completed
      ]);
    });

    it('should trust the certificate OIAnalytics presents, adding it to the store', async () => {
      oIAnalyticsRegistrationRepository.get.mock.mockImplementation(() => testData.oIAnalytics.registration.completed);
      oIAnalyticsClient.retrieveServerIdentity.mock.mockImplementation(async () => ({ identity, status: 'unknown' }));
      const updated = mock.fn();
      service.registrationEvent.on('updated', updated);

      await service.trustServerIdentity('AB:CD', 'userId', trustCertificate);

      assert.deepStrictEqual(trustCertificate.mock.calls[0].arguments, ['pem']);
      assert.deepStrictEqual(oIAnalyticsRegistrationRepository.trustCertificate.mock.calls[0].arguments, [
        'trustedCertificateId',
        'userId'
      ]);
      assert.strictEqual(updated.mock.calls.length, 1);
    });

    it('should not trust another identity than the one reviewed, nor one without certificate', async () => {
      oIAnalyticsRegistrationRepository.get.mock.mockImplementation(() => testData.oIAnalytics.registration.completed);
      oIAnalyticsClient.retrieveServerIdentity.mock.mockImplementation(async () => ({ identity, status: 'unknown' }));
      await assert.rejects(service.trustServerIdentity('EF:01', 'userId', trustCertificate), /not the one to trust/);

      oIAnalyticsClient.retrieveServerIdentity.mock.mockImplementation(async () => ({
        identity: { ...identity, details: { keyType: 'rsa' } },
        status: 'unknown'
      }));
      await assert.rejects(service.trustServerIdentity('AB:CD', 'userId', trustCertificate), {
        message: 'OIAnalytics does not present a certificate to trust'
      });
      assert.strictEqual(oIAnalyticsRegistrationRepository.trustCertificate.mock.calls.length, 0);
    });

    const awaitingCertificate = {
      ...testData.oIAnalytics.registration.completed,
      certificateValidation: 'trusted' as const,
      trustOnFirstUse: true
    };

    it('should add the certificate trusted at the first connection to the store, and select it', () => {
      oIAnalyticsRegistrationRepository.get.mock.mockImplementation(() => awaitingCertificate);
      const updated = mock.fn();
      service.registrationEvent.on('updated', updated);

      service.trustCertificateOnFirstUse(identity, trustCertificate);

      assert.deepStrictEqual(trustCertificate.mock.calls[0].arguments, ['pem']);
      assert.deepStrictEqual(oIAnalyticsRegistrationRepository.trustCertificate.mock.calls[0].arguments, [
        'trustedCertificateId',
        'system'
      ]);
      assert.strictEqual(updated.mock.calls.length, 1);
    });

    it('should not trust a certificate at the first connection once the registration no longer awaits one', () => {
      for (const registration of [
        { ...awaitingCertificate, trustOnFirstUse: false },
        { ...awaitingCertificate, trustedCertificateId: 'alreadyTrusted' },
        { ...awaitingCertificate, certificateValidation: 'standard' as const }
      ]) {
        oIAnalyticsRegistrationRepository.get.mock.mockImplementation(() => registration);

        service.trustCertificateOnFirstUse(identity, trustCertificate);
      }

      assert.strictEqual(trustCertificate.mock.calls.length, 0);
      assert.strictEqual(oIAnalyticsRegistrationRepository.trustCertificate.mock.calls.length, 0);
    });

    it('should log an error when the certificate trusted at the first connection cannot be saved', () => {
      oIAnalyticsRegistrationRepository.get.mock.mockImplementation(() => awaitingCertificate);
      service.trustCertificateOnFirstUse({ ...identity, details: { keyType: 'rsa' } }, trustCertificate);

      assert.strictEqual(oIAnalyticsRegistrationRepository.trustCertificate.mock.calls.length, 0);
      assert.ok(logger.error.mock.calls.some(c => String(c.arguments[0]).includes('no certificate presented')));
    });

    it('should tell the registration trusts the certificate of the first connection', () => {
      oIAnalyticsRegistrationRepository.get.mock.mockImplementation(() => ({
        ...testData.oIAnalytics.registration.completed,
        certificateValidation: 'trusted',
        trustOnFirstUse: true
      }));

      assert.deepStrictEqual(service.getServerTrustState(), { identity: null, trustOnFirstUse: true, pending: null });
    });

    it('should save the registration trusting the certificate trusted in its form', async () => {
      oIAnalyticsRegistrationRepository.get.mock.mockImplementation(() => testData.oIAnalytics.registration.completed);
      const command = { ...testData.oIAnalytics.registration.command, serverTrust: { identity, trustOnFirstUse: false } };

      await service.editRegistrationSettings(command, 'userId', trustCertificate);

      assert.deepStrictEqual(trustCertificate.mock.calls[0].arguments, ['pem']);
      const saved = oIAnalyticsRegistrationRepository.update.mock.calls[0].arguments[0];
      assert.strictEqual(saved.certificateValidation, 'trusted');
      assert.strictEqual(saved.trustedCertificateId, 'trustedCertificateId');
      assert.ok(!('serverTrust' in saved));
    });
  });

  it('should give the current private key, then the previous one, to decrypt the secrets from OIAnalytics', () => {
    mockEncryptionService.encryptionService.decryptText.mock.mockImplementation(key => `decrypted ${key}`);

    assert.deepStrictEqual(
      getPrivateCipherKeys({
        ...testData.oIAnalytics.registration.completed,
        privateCipherKey: 'current',
        previousPrivateCipherKey: 'previous'
      }),
      ['decrypted current', 'decrypted previous']
    );
    assert.deepStrictEqual(getPrivateCipherKeys(testData.oIAnalytics.registration.completed), ['decrypted private key']);
  });

  it('should properly convert to DTO', () => {
    const getUserInfo = (id: string) => ({ id, friendlyName: id });

    const registration = testData.oIAnalytics.registration.completed;
    assert.deepStrictEqual(toOIAnalyticsRegistrationDTO(registration, getUserInfo), {
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
      useApiGateway: registration.useApiGateway,
      apiGatewayHeaderKey: registration.apiGatewayHeaderKey,
      apiGatewayBaseEndpoint: registration.apiGatewayBaseEndpoint,
      certificateValidation: registration.certificateValidation,
      trustedCertificateId: registration.trustedCertificateId,
      commandRefreshInterval: registration.commandRefreshInterval,
      commandRetryInterval: registration.commandRetryInterval,
      messageRetryInterval: registration.messageRetryInterval,
      commandPermissions: registration.commandPermissions,
      createdBy: { id: '', friendlyName: '' },
      updatedBy: { id: '', friendlyName: '' },
      createdAt: registration.createdAt,
      updatedAt: registration.updatedAt
    });
  });
});
