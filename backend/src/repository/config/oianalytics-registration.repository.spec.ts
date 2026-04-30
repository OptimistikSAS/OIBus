import { before, after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Database } from 'better-sqlite3';
import { emptyDatabase, initDatabase, stripAuditFields } from '../../tests/utils/test-utils';
import testData from '../../tests/utils/test-data';
import OianalyticsRegistrationRepository from './oianalytics-registration.repository';
import { OIAnalyticsRegistration } from '../../model/oianalytics-registration.model';

const TEST_DB_PATH = 'src/tests/test-config-registration.db';

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

  beforeEach(() => {
    repository = new OianalyticsRegistrationRepository(database);
  });

  it('should properly get the registration settings', () => {
    assert.deepStrictEqual(repository.get(), testData.oIAnalytics.registration.completed);
  });

  it('should properly register', () => {
    const expectedResult: OIAnalyticsRegistration = JSON.parse(JSON.stringify(testData.oIAnalytics.registration.completed));
    expectedResult.status = 'PENDING';
    expectedResult.activationCode = '123ABC';
    expectedResult.checkUrl = 'http://localhost:4200/api/oianalytics/oibus/registration?id=id';
    expectedResult.activationExpirationDate = testData.constants.dates.FAKE_NOW;
    expectedResult.token = '';

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
    const expectedResult: OIAnalyticsRegistration = JSON.parse(JSON.stringify(testData.oIAnalytics.registration.completed));
    expectedResult.status = 'REGISTERED';
    expectedResult.activationExpirationDate = '';
    expectedResult.checkUrl = '';
    expectedResult.activationDate = testData.constants.dates.FAKE_NOW;
    expectedResult.activationCode = '';
    expectedResult.token = 'token';

    repository.activate(testData.constants.dates.FAKE_NOW, 'token');

    assert.deepStrictEqual(stripAuditFields(repository.get()), stripAuditFields(expectedResult));
  });

  it('should unregister', () => {
    const expectedResult: OIAnalyticsRegistration = JSON.parse(JSON.stringify(testData.oIAnalytics.registration.completed));
    expectedResult.status = 'NOT_REGISTERED';
    expectedResult.activationExpirationDate = '';
    expectedResult.checkUrl = '';
    expectedResult.activationDate = '';
    expectedResult.activationCode = '';
    expectedResult.token = '';

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
  });

  it('should update keys', () => {
    repository.updateKeys('private key', 'public key');

    const result = repository.get()!;
    assert.strictEqual(result.privateCipherKey, 'private key');
    assert.strictEqual(result.publicCipherKey, 'public key');
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
    const repository = new OianalyticsRegistrationRepository(database);
    const result = stripAuditFields(repository.get());

    assert.ok(result);
    assert.strictEqual(result.host, '');
    assert.strictEqual(result.status, 'NOT_REGISTERED');
    assert.strictEqual(result.acceptUnauthorized, false);
    assert.strictEqual(result.useProxy, false);
    assert.strictEqual(result.commandRefreshInterval, 10);
    assert.strictEqual(result.commandRetryInterval, 5);
    assert.strictEqual(result.messageRetryInterval, 5);
    assert.deepStrictEqual(result.commandPermissions, {
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
