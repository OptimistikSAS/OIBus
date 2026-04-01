import { Database } from 'better-sqlite3';
import { emptyDatabase, initDatabase, stripAuditFields } from '../../tests/utils/test-utils';
import testData from '../../tests/utils/test-data';
import { generateRandomId } from '../../service/utils';
import OianalyticsRegistrationRepository from './oianalytics-registration.repository';
import { OIAnalyticsRegistration } from '../../model/oianalytics-registration.model';

jest.mock('../../service/utils');

const TEST_DB_PATH = 'src/tests/test-config-registration.db';

let database: Database;
describe('OianalyticsRegistrationRepository with populated database', () => {
  beforeAll(async () => {
    database = await initDatabase('config', true, TEST_DB_PATH);
  });

  afterAll(async () => {
    database.close();
    await emptyDatabase('config', TEST_DB_PATH);
  });

  let repository: OianalyticsRegistrationRepository;

  beforeEach(() => {
    jest.resetAllMocks();
    repository = new OianalyticsRegistrationRepository(database);
  });

  it('should properly get the registration settings', () => {
    expect(repository.get()).toEqual(testData.oIAnalytics.registration.completed);
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

    expect(stripAuditFields(repository.get())).toEqual(stripAuditFields(expectedResult));
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

    expect(stripAuditFields(repository.get())).toEqual(stripAuditFields(expectedResult));
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

    expect(stripAuditFields(repository.get())).toEqual(stripAuditFields(expectedResult));
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
    expect(result.useProxy).toEqual(specificCommand.useProxy);
    expect(result.proxyUrl).toEqual(specificCommand.proxyUrl);
    expect(result.proxyUsername).toEqual(specificCommand.proxyUsername);
    expect(result.proxyPassword).toEqual(specificCommand.proxyPassword);
  });

  it('should update keys', () => {
    repository.updateKeys('private key', 'public key');

    const result = repository.get()!;
    expect(result.privateCipherKey).toEqual('private key');
    expect(result.publicCipherKey).toEqual('public key');
  });
});

describe('OianalyticsRegistrationRepository with empty database', () => {
  beforeAll(async () => {
    database = await initDatabase('config', false, TEST_DB_PATH);
  });

  afterAll(async () => {
    database.close();
    await emptyDatabase('config', TEST_DB_PATH);
  });

  let repository: OianalyticsRegistrationRepository;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should properly init registration settings table', () => {
    (generateRandomId as jest.Mock).mockReturnValueOnce('registrationId1');
    repository = new OianalyticsRegistrationRepository(database);

    expect(stripAuditFields(repository.get())).toEqual({
      id: 'registrationId1',
      host: '',
      activationCode: null,
      token: null,
      checkUrl: null,
      status: 'NOT_REGISTERED',
      activationExpirationDate: null,
      activationDate: null,
      acceptUnauthorized: false,
      privateCipherKey: null,
      publicCipherKey: null,
      useProxy: false,
      proxyUrl: null,
      proxyUsername: null,
      proxyPassword: null,
      useApiGateway: false,
      apiGatewayHeaderKey: null,
      apiGatewayHeaderValue: null,
      apiGatewayBaseEndpoint: null,
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
      }
    });
  });
});
