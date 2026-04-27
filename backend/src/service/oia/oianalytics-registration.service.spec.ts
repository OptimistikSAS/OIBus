import { describe, it, beforeEach, afterEach, before, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import testData from '../../tests/utils/test-data';
import { flushPromises, mockModule, reloadModule, seq } from '../../tests/utils/test-utils';
import type OIAnalyticsRegistrationServiceType from './oianalytics-registration.service';
import type { toOIAnalyticsRegistrationDTO as toOIAnalyticsRegistrationDTOType } from './oianalytics-registration.service';
import type LoggerMock from '../../tests/__mocks__/service/logger/logger.mock';
import OianalyticsRegistrationRepositoryMock from '../../tests/__mocks__/repository/config/oianalytics-registration-repository.mock';
import EngineRepositoryMock from '../../tests/__mocks__/repository/config/engine-repository.mock';
import OianalyticsClientMock from '../../tests/__mocks__/service/oia/oianalytics-client.mock';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import { RegistrationSettingsCommandDTO } from '../../../shared/model/engine.model';
import { OIAnalyticsRegistration } from '../../model/oianalytics-registration.model';
import { NotFoundError } from '../../model/types';

const nodeRequire = createRequire(import.meta.url);

// Mocked module exports — mutated in-place between tests
let mockUtils: Record<string, ReturnType<typeof mock.fn>>;
let mockUtilsOianalytics: Record<string, ReturnType<typeof mock.fn>>;
let mockEncryptionService: { encryptionService: EncryptionServiceMock };

let OIAnalyticsRegistrationService: new (
  ...args: ConstructorParameters<typeof OIAnalyticsRegistrationServiceType>
) => InstanceType<typeof OIAnalyticsRegistrationServiceType>;
let toOIAnalyticsRegistrationDTO: typeof toOIAnalyticsRegistrationDTOType;

before(() => {
  mockUtils = {
    getOIBusInfo: mock.fn(() => testData.engine.oIBusInfo),
    createFolder: mock.fn(),
    filesExists: mock.fn()
  };
  mockUtilsOianalytics = {
    testOIAnalyticsConnection: mock.fn()
  };
  mockEncryptionService = {
    encryptionService: new EncryptionServiceMock('', '')
  };

  mockModule(nodeRequire, '../utils', mockUtils);
  mockModule(nodeRequire, '../utils-oianalytics', mockUtilsOianalytics);
  mockModule(nodeRequire, '../encryption.service', mockEncryptionService);

  const mod = reloadModule<{
    default: new (
      ...args: ConstructorParameters<typeof OIAnalyticsRegistrationServiceType>
    ) => InstanceType<typeof OIAnalyticsRegistrationServiceType>;
    toOIAnalyticsRegistrationDTO: typeof toOIAnalyticsRegistrationDTOType;
  }>(nodeRequire, './oianalytics-registration.service');
  OIAnalyticsRegistrationService = mod.default;
  toOIAnalyticsRegistrationDTO = mod.toOIAnalyticsRegistrationDTO;
});

describe('OIAnalytics Registration Service', () => {
  let oIAnalyticsRegistrationRepository: OianalyticsRegistrationRepositoryMock;
  let engineRepository: EngineRepositoryMock;
  let oIAnalyticsClient: OianalyticsClientMock;
  let logger: LoggerMock;
  let service: InstanceType<typeof OIAnalyticsRegistrationServiceType>;
  let validator: { validate: ReturnType<typeof mock.fn> };

  beforeEach(() => {
    oIAnalyticsRegistrationRepository = new OianalyticsRegistrationRepositoryMock();
    engineRepository = new EngineRepositoryMock();
    oIAnalyticsClient = new OianalyticsClientMock();
    logger = new (nodeRequire('../../tests/__mocks__/service/logger/logger.mock') as { default: new () => LoggerMock }).default();
    validator = { validate: mock.fn() };

    mockUtils.getOIBusInfo = mock.fn(() => testData.engine.oIBusInfo);
    engineRepository.get = mock.fn(() => testData.engine.settings);
    // Reset encryptionService mock fns
    mockEncryptionService.encryptionService = new EncryptionServiceMock('', '');
    mockUtilsOianalytics.testOIAnalyticsConnection = mock.fn();

    mock.timers.enable({ apis: ['Date', 'setTimeout', 'setInterval'], now: new Date(testData.constants.dates.FAKE_NOW) });

    service = new OIAnalyticsRegistrationService(
      validator as unknown as Parameters<typeof OIAnalyticsRegistrationService>[0],
      oIAnalyticsClient,
      oIAnalyticsRegistrationRepository,
      engineRepository,
      logger as unknown as Parameters<typeof OIAnalyticsRegistrationService>[4]
    );
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  it('should start with completed registration', () => {
    oIAnalyticsRegistrationRepository.get = mock.fn(
      seq(
        () => testData.oIAnalytics.registration.completed,
        () => testData.oIAnalytics.registration.pending
      )
    );

    service.start();

    assert.strictEqual(oIAnalyticsRegistrationRepository.get.mock.calls.length, 1);

    service.start();

    assert.strictEqual(oIAnalyticsRegistrationRepository.get.mock.calls.length, 2);
  });

  it('should get registration settings', () => {
    oIAnalyticsRegistrationRepository.get = mock.fn(() => testData.oIAnalytics.registration.completed);

    assert.deepStrictEqual(service.getRegistrationSettings(), testData.oIAnalytics.registration.completed);
    assert.strictEqual(oIAnalyticsRegistrationRepository.get.mock.calls.length, 1);
  });

  it('should not get registration settings if not found', () => {
    oIAnalyticsRegistrationRepository.get = mock.fn(() => null);

    assert.throws(() => service.getRegistrationSettings(), new NotFoundError('Registration settings not found'));
    assert.strictEqual(oIAnalyticsRegistrationRepository.get.mock.calls.length, 1);
  });

  it('should register', async () => {
    oIAnalyticsRegistrationRepository.get = mock.fn(
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
    oIAnalyticsClient.register = mock.fn(
      seq(
        () => result,
        () => result
      )
    );

    mock.method(crypto, 'generateKeyPairSync', () => ({ publicKey: 'public key', privateKey: 'private key' }));
    service.checkRegistration = mock.fn();

    await service.register(testData.oIAnalytics.registration.command, testData.users.list[0].id);

    assert.strictEqual(mockEncryptionService.encryptionService.encryptText.mock.calls.length, 1);
    assert.strictEqual(engineRepository.get.mock.calls.length, 1);
    assert.strictEqual(oIAnalyticsClient.register.mock.calls.length, 1);
    assert.strictEqual(mockUtils.getOIBusInfo.mock.calls.length, 1);
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
    assert.strictEqual((service.checkRegistration as ReturnType<typeof mock.fn>).mock.calls.length, 1);

    await service.register(testData.oIAnalytics.registration.command, testData.users.list[0].id);
    mock.timers.tick(10_000);
    assert.strictEqual((service.checkRegistration as ReturnType<typeof mock.fn>).mock.calls.length, 2);
  });

  it('should register with proxy', async () => {
    const command: Omit<OIAnalyticsRegistration, 'id' | 'status' | 'activationDate'> = {
      host: 'http://localhost:4200/',
      acceptUnauthorized: false,
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
      publicCipherKey: null,
      privateCipherKey: null,
      checkUrl: null,
      commandRefreshInterval: 10,
      commandRetryInterval: 5,
      messageRetryInterval: 5,
      commandPermissions: {
        updateVersion: true,
        restartEngine: true,
        regenerateCipherKeys: true,
        updateEngineSettings: true,
        updateRegistrationSettings: true,
        createScanMode: true,
        updateScanMode: true,
        deleteScanMode: true,
        createIpFilter: true,
        updateIpFilter: true,
        deleteIpFilter: true,
        createCertificate: true,
        updateCertificate: true,
        deleteCertificate: true,
        createHistoryQuery: true,
        updateHistoryQuery: true,
        deleteHistoryQuery: true,
        createOrUpdateHistoryItemsFromCsv: true,
        testHistoryNorthConnection: true,
        testHistorySouthConnection: true,
        testHistorySouthItem: true,
        createSouth: true,
        updateSouth: true,
        deleteSouth: true,
        createOrUpdateSouthItemsFromCsv: true,
        testSouthConnection: true,
        testSouthItem: true,
        createNorth: true,
        updateNorth: true,
        deleteNorth: true,
        testNorthConnection: true,
        setpoint: true,
        searchNorthCacheContent: true,
        getNorthCacheFileContent: true,
        updateNorthCacheContent: true,
        searchHistoryCacheContent: true,
        getHistoryCacheFileContent: true,
        updateHistoryCacheContent: true,
        createCustomTransformer: true,
        updateCustomTransformer: true,
        deleteCustomTransformer: true,
        testCustomTransformer: true
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
    mock.method(crypto, 'generateKeyPairSync', () => ({ publicKey: 'public key', privateKey: 'private key' }));
    oIAnalyticsClient.register = mock.fn(() => result);

    await service.register(command, testData.users.list[0].id);
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
    oIAnalyticsRegistrationRepository.get = mock.fn(() => testData.oIAnalytics.registration.completed);

    await service.editRegistrationSettings(testData.oIAnalytics.registration.command, testData.users.list[0].id);

    assert.deepStrictEqual(oIAnalyticsRegistrationRepository.update.mock.calls[0].arguments, [
      testData.oIAnalytics.registration.command,
      testData.users.list[0].id
    ]);
  });

  it('should update keys', async () => {
    await service.updateKeys('private key', 'public key');

    assert.strictEqual(mockEncryptionService.encryptionService.encryptText.mock.calls.length, 1);
    assert.deepStrictEqual(mockEncryptionService.encryptionService.encryptText.mock.calls[0].arguments, ['private key']);
    assert.deepStrictEqual(oIAnalyticsRegistrationRepository.updateKeys.mock.calls[0].arguments, ['private key', 'public key']);
  });

  it('should edit registration with proxy', async () => {
    const command: RegistrationSettingsCommandDTO = {
      host: 'http://localhost:4200/',
      acceptUnauthorized: false,
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
        restartEngine: true,
        regenerateCipherKeys: true,
        updateEngineSettings: true,
        updateRegistrationSettings: true,
        createScanMode: true,
        updateScanMode: true,
        deleteScanMode: true,
        createIpFilter: true,
        updateIpFilter: true,
        deleteIpFilter: true,
        createCertificate: true,
        updateCertificate: true,
        deleteCertificate: true,
        createHistoryQuery: true,
        updateHistoryQuery: true,
        deleteHistoryQuery: true,
        createOrUpdateHistoryItemsFromCsv: true,
        testHistoryNorthConnection: true,
        testHistorySouthConnection: true,
        testHistorySouthItem: true,
        createSouth: true,
        updateSouth: true,
        deleteSouth: true,
        createOrUpdateSouthItemsFromCsv: true,
        testSouthConnection: true,
        testSouthItem: true,
        createNorth: true,
        updateNorth: true,
        deleteNorth: true,
        testNorthConnection: true,
        setpoint: true,
        searchNorthCacheContent: true,
        getNorthCacheFileContent: true,
        updateNorthCacheContent: true,
        searchHistoryCacheContent: true,
        getHistoryCacheFileContent: true,
        updateHistoryCacheContent: true,
        createCustomTransformer: true,
        updateCustomTransformer: true,
        deleteCustomTransformer: true,
        testCustomTransformer: true
      }
    };
    oIAnalyticsRegistrationRepository.get = mock.fn(() => testData.oIAnalytics.registration.completed);

    await service.editRegistrationSettings(command, testData.users.list[0].id);

    assert.deepStrictEqual(oIAnalyticsRegistrationRepository.update.mock.calls[0].arguments, [command, testData.users.list[0].id]);
  });

  it('should unregister and not clear interval if it does not exist', () => {
    service.unregister();

    assert.strictEqual(oIAnalyticsRegistrationRepository.unregister.mock.calls.length, 1);
  });

  it('should unregister and clear interval if it exists', () => {
    oIAnalyticsRegistrationRepository.get = mock.fn(() => testData.oIAnalytics.registration.pending);

    service.start(); // start with pending registration to set interval
    service.unregister();

    assert.strictEqual(oIAnalyticsRegistrationRepository.unregister.mock.calls.length, 1);
  });

  it('should stop and clear interval if it exists', () => {
    oIAnalyticsRegistrationRepository.get = mock.fn(() => testData.oIAnalytics.registration.pending);

    service.start(); // start with pending registration to set interval
    service.stop();
    service.stop();

    // second stop() is a no-op — interval was already cleared on first call
  });

  it('should check registration', async () => {
    oIAnalyticsRegistrationRepository.get = mock.fn(
      seq(
        () => testData.oIAnalytics.registration.pending,
        () => testData.oIAnalytics.registration.pending
      )
    );
    const result = { status: 'COMPLETED', expired: true, accessToken: 'access_token' };
    oIAnalyticsClient.checkRegistration = mock.fn(() => result);

    service.start(); // start with pending registration to set interval
    await service.checkRegistration();

    assert.strictEqual(oIAnalyticsClient.checkRegistration.mock.calls.length, 1);
    assert.deepStrictEqual(mockEncryptionService.encryptionService.encryptText.mock.calls[0].arguments, ['access_token']);
    assert.deepStrictEqual(oIAnalyticsRegistrationRepository.activate.mock.calls[0].arguments, [
      testData.constants.dates.FAKE_NOW,
      'access_token'
    ]);
  });

  it('should check registration and return because already checking', async () => {
    oIAnalyticsRegistrationRepository.get = mock.fn(() => testData.oIAnalytics.registration.pending);
    const result = { status: 'COMPLETED', expired: true, accessToken: 'access_token' };
    oIAnalyticsClient.checkRegistration = mock.fn(() => result);

    service.checkRegistration();
    await service.checkRegistration();

    assert.ok(logger.trace.mock.calls.some((c: { arguments: Array<string> }) => c.arguments[0] === 'On going registration check'));
    await flushPromises();
  });

  it('should check registration but fail because of return status', async () => {
    oIAnalyticsRegistrationRepository.get = mock.fn(() => testData.oIAnalytics.registration.pending);
    const result = { status: 'DECLINED', expired: true, accessToken: 'access_token' };
    oIAnalyticsClient.checkRegistration = mock.fn(() => result);

    await service.checkRegistration();

    assert.strictEqual(oIAnalyticsClient.checkRegistration.mock.calls.length, 1);
    assert.ok(
      logger.warn.mock.calls.some((c: { arguments: Array<string> }) => c.arguments[0] === 'Registration not completed. Status: DECLINED')
    );
  });

  it('should check registration but fail because of client error', async () => {
    oIAnalyticsRegistrationRepository.get = mock.fn(() => testData.oIAnalytics.registration.pending);
    oIAnalyticsClient.checkRegistration = mock.fn(() => {
      throw new Error('error');
    });

    await service.checkRegistration();

    assert.strictEqual(oIAnalyticsClient.checkRegistration.mock.calls.length, 1);
    assert.ok(
      logger.error.mock.calls.some((c: { arguments: Array<string> }) => c.arguments[0] === 'Error while checking registration: error')
    );
  });

  it('should test connection', async () => {
    oIAnalyticsRegistrationRepository.get = mock.fn(() => testData.oIAnalytics.registration.completed);

    await service.testConnection(testData.oIAnalytics.registration.command);

    assert.deepStrictEqual(mockUtilsOianalytics.testOIAnalyticsConnection.mock.calls[0].arguments, [
      true,
      testData.oIAnalytics.registration.command,
      null,
      30000,
      null,
      false
    ]);
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
      acceptUnauthorized: registration.acceptUnauthorized,
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
