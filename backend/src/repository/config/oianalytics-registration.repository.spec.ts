import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import { Database } from 'better-sqlite3';

import { OIAnalyticsRegistration } from '../../model/oianalytics-registration.model';
import AuditService from '../../service/audit.service';
import { emptyDatabase, initDatabase } from '../../tests/utils/database-utils';
import testData from '../../tests/utils/test-data';
import { createAuditServiceMock, Mocked, stripAuditFields } from '../../tests/utils/test-utils';
import OianalyticsRegistrationRepository from './oianalytics-registration.repository';

const TEST_DB_PATH = 'src/tests/test-config-registration.db';

/** The registration fixture once `overrides` are applied. */
const expectedRegistration = (overrides: Partial<OIAnalyticsRegistration>): OIAnalyticsRegistration => ({
  ...JSON.parse(JSON.stringify(testData.oIAnalytics.registration.completed)),
  ...overrides
});

let database: Database;
describe('OianalyticsRegistrationRepository with populated database', () => {
  before(async () => {
    database = await initDatabase('config', true, TEST_DB_PATH);
  });

  after(async () => {
    database.close();
    await emptyDatabase('config', TEST_DB_PATH);
  });

  let repository: OianalyticsRegistrationRepository;
  let auditService: Mocked<AuditService>;

  beforeEach(() => {
    auditService = createAuditServiceMock();
    repository = new OianalyticsRegistrationRepository(database, auditService);
  });

  /** Checks the test recorded a single update of the registration, and returns its snapshots. */
  const onlyRegistrationUpdate = (registrationId: string) => {
    assert.strictEqual(auditService.record.mock.callCount(), 1);
    const [entityType, entityId, action, previousState, newState, userId] = auditService.record.mock.calls[0].arguments;
    assert.strictEqual(entityType, 'oianalytics_registration');
    assert.strictEqual(entityId, registrationId);
    assert.strictEqual(action, 'UPDATE');
    assert.strictEqual(userId, testData.users.list[0].id);
    return { previousState: previousState!, newState: newState! };
  };

  it('should properly get the registration settings', () => {
    assert.deepStrictEqual(repository.get(), testData.oIAnalytics.registration.completed);
  });

  it('should properly register', () => {
    const expectedResult = expectedRegistration({
      status: 'PENDING',
      activationCode: '123ABC',
      checkUrl: 'http://localhost:4200/api/oianalytics/oibus/registration?id=id',
      activationExpirationDate: testData.constants.dates.FAKE_NOW,
      token: ''
    });

    repository.register(
      testData.oIAnalytics.registration.command,
      '123ABC',
      'http://localhost:4200/api/oianalytics/oibus/registration?id=id',
      testData.constants.dates.FAKE_NOW,
      'public key',
      'private key',
      testData.users.list[0].id
    );

    assert.deepStrictEqual(stripAuditFields(repository.get()), stripAuditFields(expectedResult));
  });

  it('should activate registration', () => {
    const expectedResult = expectedRegistration({
      status: 'REGISTERED',
      activationExpirationDate: '',
      checkUrl: '',
      activationDate: testData.constants.dates.FAKE_NOW,
      activationCode: '',
      token: 'token'
    });

    repository.activate(testData.constants.dates.FAKE_NOW, 'token');

    assert.deepStrictEqual(stripAuditFields(repository.get()), stripAuditFields(expectedResult));
  });

  it('should unregister', () => {
    const expectedResult = expectedRegistration({
      status: 'NOT_REGISTERED',
      activationExpirationDate: '',
      checkUrl: '',
      activationDate: '',
      activationCode: '',
      token: ''
    });

    repository.unregister();

    assert.deepStrictEqual(stripAuditFields(repository.get()), stripAuditFields(expectedResult));
  });

  it('should update registration', () => {
    const specificCommand = {
      ...testData.oIAnalytics.registration.command,
      acceptUnauthorized: false,
      useProxy: true,
      proxyUrl: 'http://localhost:9000',
      proxyUsername: 'oibus',
      proxyPassword: 'pass'
    };
    repository.update(specificCommand, testData.users.list[0].id);

    const result = repository.get()!;
    assert.strictEqual(result.useProxy, specificCommand.useProxy);
    assert.strictEqual(result.proxyUrl, specificCommand.proxyUrl);
    assert.strictEqual(result.proxyUsername, specificCommand.proxyUsername);
    assert.strictEqual(result.proxyPassword, specificCommand.proxyPassword);

    const { previousState, newState } = onlyRegistrationUpdate(result.id);
    assert.strictEqual(previousState.publicCipherKey, '');
    assert.strictEqual(previousState.privateCipherKey, '');
    assert.strictEqual(newState.publicCipherKey, '');
    assert.strictEqual(newState.privateCipherKey, '');
    // The token, proxy password and api gateway header value must never be persisted in the audit trail:
    // only a change of the proxy password is recorded
    assert.strictEqual(previousState.token, '');
    assert.strictEqual(previousState.proxyPassword, '');
    assert.strictEqual(previousState.apiGatewayHeaderValue, '');
    assert.strictEqual(newState.token, '');
    assert.strictEqual(newState.proxyPassword, '<changed>');
    assert.strictEqual(newState.apiGatewayHeaderValue, '');
    // Unrelated fields pass through unchanged
    assert.strictEqual(newState.useProxy, specificCommand.useProxy);
    assert.strictEqual(newState.proxyUrl, specificCommand.proxyUrl);
    assert.strictEqual(newState.proxyUsername, specificCommand.proxyUsername);
  });

  it('should update keys', () => {
    repository.updateKeys('new private key', 'new public key', testData.users.list[0].id);

    const result = repository.get()!;
    assert.strictEqual(result.privateCipherKey, 'new private key');
    assert.strictEqual(result.publicCipherKey, 'new public key');

    const { previousState, newState } = onlyRegistrationUpdate(result.id);
    assert.strictEqual(previousState.publicCipherKey, '');
    assert.strictEqual(previousState.privateCipherKey, '');
    assert.strictEqual(newState.publicCipherKey, '<changed>');
    assert.strictEqual(newState.privateCipherKey, '<changed>');
  });
});

describe('OianalyticsRegistrationRepository with empty database', () => {
  before(async () => {
    database = await initDatabase('config', false, TEST_DB_PATH);
  });

  after(async () => {
    database.close();
    await emptyDatabase('config', TEST_DB_PATH);
  });

  it('should properly init registration settings table', () => {
    const repository = new OianalyticsRegistrationRepository(database, createAuditServiceMock());
    const result = stripAuditFields(repository.get());

    assert.ok(result);
    assert.strictEqual(result.host, '');
    assert.strictEqual(result.status, 'NOT_REGISTERED');
    assert.strictEqual(result.acceptUnauthorized, false);
    assert.strictEqual(result.useProxy, false);
    assert.strictEqual(result.commandRefreshInterval, 60);
    assert.strictEqual(result.commandRetryInterval, 5);
    assert.strictEqual(result.messageRetryInterval, 5);
    assert.deepStrictEqual(result.commandPermissions, {
      updateVersion: true,
      restartEngine: true,
      regenerateCipherKeys: true,
      updateEngineSettings: true,
      importConfiguration: true,
      dumpMemory: true,
      retrieveLogsDatabase: true,
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
      searchHistoryCacheContent: true,
      getHistoryCacheFileContent: true,
      updateHistoryCacheContent: true,
      searchNorthCacheContent: true,
      getNorthCacheFileContent: true,
      updateNorthCacheContent: true,
      createCustomTransformer: true,
      updateCustomTransformer: true,
      deleteCustomTransformer: true,
      testCustomTransformer: true
    });
  });
});
