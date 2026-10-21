import assert from 'node:assert/strict';
import type { ReadStream } from 'node:fs';
import { createRequire } from 'node:module';
import { afterEach, before, beforeEach, describe, it, type Mock, mock } from 'node:test';

import type { Client as KustoClient } from 'azure-kusto-data';
import type { IngestClient } from 'azure-kusto-ingest';

import type { NorthAzureDataExplorerSettings } from '../../../shared/model/connector/north-settings.model';
import type { CacheMetadata } from '../../../shared/model/domain/engine.model';

import type CertificateRepository from '../../repository/config/certificate.repository';
import type EncryptionService from '../../service/encryption.service';
import type * as Utils from '../../service/utils';
import { createCacheServiceMock } from '../../tests/__mocks__/service/cache/cache-service.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../tests/utils/test-data';
import { assertContains, buildNorthEntity, createMock, type Mocked, mockModule, reloadModule } from '../../tests/utils/test-utils';
import type NorthAzureDataExplorerClass from './north-azure-data-explorer';

const nodeRequire = createRequire(import.meta.url);

const fileStream = createMock<ReadStream>({ path: '/cache/content/file.csv' });
const cacheMetadata: CacheMetadata = {
  contentFile: 'file.csv',
  contentSize: 123,
  numberOfElement: 0,
  createdAt: '',
  contentType: 'any'
};
const proxyWithCredentials: Partial<NorthAzureDataExplorerSettings> = {
  useProxy: true,
  proxyUrl: 'http://myproxy:8080',
  proxyUsername: 'proxyUser',
  proxyPassword: 'proxySecret'
};
const expectedProxyOptions = { proxyOptions: { host: 'http://myproxy', port: 8080, username: 'proxyUser', password: 'proxySecret' } };
const expectedCertificate = { certificate: `${testData.certificates.list[0].certificate}\n${testData.certificates.list[0].privateKey}` };

type ConstructorMock = Mock<(...args: Array<unknown>) => object>;
// The SDK classes are called with `new`: the mocks must be regular functions
const constructorMock = (instance: () => object = () => ({})): ConstructorMock =>
  mock.fn(function (..._args: Array<unknown>) {
    return instance();
  });

type AxiosInstance = KustoClient['axiosInstance'];
/** A Kusto client whose axios instance can receive the proxy agent */
const createKustoClient = (overrides: Partial<Record<'executeMgmt' | 'close', () => unknown>> = {}) =>
  createMock<KustoClient>({ axiosInstance: createMock<AxiosInstance>({ defaults: {} as AxiosInstance['defaults'] }), ...overrides });

describe('NorthAzureDataExplorer', () => {
  let NorthAzureDataExplorer: typeof NorthAzureDataExplorerClass;
  let north: NorthAzureDataExplorerClass;

  let logger: PinoLogger;
  let encryptionService: Mocked<EncryptionService>;
  let certificateRepository: Mocked<CertificateRepository>;
  let kustoClient: Mocked<KustoClient>;
  let ingestResourceManagerKustoClient: Mocked<KustoClient>;
  let ingestClient: Mocked<IngestClient>;
  let ClientMock: ConstructorMock;
  let withTokenCredentialMock: Mock<(clusterUrl: string, credential: unknown) => object>;
  let IngestClientMock: ConstructorMock;
  let ClientSecretCredentialMock: ConstructorMock;
  let ClientCertificateCredentialMock: ConstructorMock;
  let DefaultAzureCredentialMock: ConstructorMock;
  let HttpsProxyAgentMock: ConstructorMock;

  const azureKustoDataExports: Record<string, unknown> = { __esModule: true };
  const azureKustoIngestExports = {
    __esModule: true,
    IngestionProperties: class {
      constructor(props: Record<string, unknown>) {
        Object.assign(this, props);
      }
    },
    DataFormat: { CSV: 'csv', JSON: 'json', MULTIJSON: 'multijson' },
    dataFormatMappingKind: (format: string) => (format === 'csv' ? 'Csv' : 'Json')
  };
  const azureIdentityExports: Record<string, unknown> = { __esModule: true };
  const httpsProxyAgentExports: Record<string, unknown> = { __esModule: true };
  const encryptionExports: Record<string, unknown> = { __esModule: true };
  const utilsExports: typeof Utils = { ...nodeRequire('../../service/utils') };

  const buildSettings = (settings: Partial<NorthAzureDataExplorerSettings> = {}): NorthAzureDataExplorerSettings => ({
    clusterUrl: 'https://mycluster.westeurope.kusto.windows.net',
    database: 'mydatabase',
    table: 'mytable',
    authentication: 'aad-app-secret',
    tenantId: 'tenantId',
    clientId: 'clientId',
    clientSecret: 'clientSecret',
    certificateId: null,
    dataFormat: 'csv',
    ingestionMappingName: null,
    useProxy: false,
    ...settings
  });

  const createNorth = (settings: Partial<NorthAzureDataExplorerSettings> = {}) => {
    north = new NorthAzureDataExplorer(
      buildNorthEntity<NorthAzureDataExplorerSettings>('azure-data-explorer', buildSettings(settings)),
      createCacheServiceMock(),
      certificateRepository
    );
  };

  /** Creates the connector with these settings and prepares its connection */
  const prepareConnection = async (settings: Partial<NorthAzureDataExplorerSettings>) => {
    createNorth(settings);
    await north.prepareConnection(north.connectorConfiguration.settings);
  };

  before(() => {
    mockModule(nodeRequire, 'azure-kusto-data', azureKustoDataExports);
    mockModule(nodeRequire, 'azure-kusto-ingest', azureKustoIngestExports);
    mockModule(nodeRequire, '@azure/identity', azureIdentityExports);
    mockModule(nodeRequire, 'https-proxy-agent', httpsProxyAgentExports);
    mockModule(nodeRequire, '../../service/encryption.service', encryptionExports);
    mockModule(nodeRequire, '../../service/utils', utilsExports);
    // No transformation here: don't pay for loading every transformer
    mockModule(nodeRequire, '../../service/transformer.service', {});
    mockModule(nodeRequire, '../../service/logger/logger.service', {
      loggerService: { createChildLogger: () => logger },
      default: class {}
    });

    NorthAzureDataExplorer = reloadModule<{ default: typeof NorthAzureDataExplorerClass }>(
      nodeRequire,
      './north-azure-data-explorer'
    ).default;
  });

  beforeEach(() => {
    logger = new PinoLogger();
    encryptionService = createMock<EncryptionService>({ decryptText: async text => text });
    certificateRepository = createMock<CertificateRepository>();
    kustoClient = createKustoClient();
    ingestResourceManagerKustoClient = createKustoClient();
    ingestClient = createMock<IngestClient>({
      resourceManager: createMock<IngestClient['resourceManager']>({ kustoClient: ingestResourceManagerKustoClient })
    });
    ClientMock = constructorMock(() => kustoClient);
    withTokenCredentialMock = mock.fn(() => ({}));
    IngestClientMock = constructorMock(() => ingestClient);
    ClientSecretCredentialMock = constructorMock();
    ClientCertificateCredentialMock = constructorMock();
    DefaultAzureCredentialMock = constructorMock();
    HttpsProxyAgentMock = constructorMock();

    Object.assign(azureKustoDataExports, {
      Client: ClientMock,
      KustoConnectionStringBuilder: { withTokenCredential: withTokenCredentialMock }
    });
    Object.assign(azureKustoIngestExports, { IngestClient: IngestClientMock });
    Object.assign(azureIdentityExports, {
      ClientSecretCredential: ClientSecretCredentialMock,
      ClientCertificateCredential: ClientCertificateCredentialMock,
      DefaultAzureCredential: DefaultAzureCredentialMock
    });
    httpsProxyAgentExports.HttpsProxyAgent = HttpsProxyAgentMock;
    encryptionExports.encryptionService = encryptionService;
    // start() waits for runMinDelay before checking the cache
    Object.assign(utilsExports, { delay: async () => undefined });
    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });

    createNorth();
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  it('should retrieve supported types', () => {
    assert.deepStrictEqual(north.supportedTypes(), ['any']);
  });

  it('should properly start', async () => {
    const prepareConnectionMock = mock.method(north, 'prepareConnection', async () => undefined);
    await north.start();
    assert.strictEqual(prepareConnectionMock.mock.calls.length, 1);
    assert.deepStrictEqual(prepareConnectionMock.mock.calls[0].arguments, [north.connectorConfiguration.settings]);
  });

  it('should build credential with aad-app-secret authentication', async () => {
    await prepareConnection({ clientSecret: 'mySecret' });
    assert.strictEqual(ClientSecretCredentialMock.mock.calls.length, 1);
    assert.deepStrictEqual(ClientSecretCredentialMock.mock.calls[0].arguments, ['tenantId', 'clientId', 'mySecret']);
  });

  it('should build credential with aad-app-secret authentication and proxyOptions when useProxy is true', async () => {
    await prepareConnection({ clientSecret: 'mySecret', ...proxyWithCredentials });
    assert.strictEqual(ClientSecretCredentialMock.mock.calls.length, 1);
    assert.deepStrictEqual(ClientSecretCredentialMock.mock.calls[0].arguments, ['tenantId', 'clientId', 'mySecret', expectedProxyOptions]);
  });

  it('should build credential with aad-app-secret authentication and proxyOptions using default https port', async () => {
    await prepareConnection({
      clientSecret: 'mySecret',
      useProxy: true,
      proxyUrl: 'https://myproxy',
      proxyUsername: '',
      proxyPassword: ''
    });
    assert.strictEqual(ClientSecretCredentialMock.mock.calls.length, 1);
    assert.deepStrictEqual(ClientSecretCredentialMock.mock.calls[0].arguments, [
      'tenantId',
      'clientId',
      'mySecret',
      { proxyOptions: { host: 'https://myproxy', port: 443, username: undefined, password: undefined } }
    ]);
  });

  it('should build credential with aad-app-secret authentication and proxyOptions using default http port', async () => {
    await prepareConnection({ clientSecret: 'mySecret', useProxy: true, proxyUrl: 'http://myproxy', proxyUsername: '', proxyPassword: '' });
    assert.strictEqual(ClientSecretCredentialMock.mock.calls.length, 1);
    assert.deepStrictEqual(ClientSecretCredentialMock.mock.calls[0].arguments, [
      'tenantId',
      'clientId',
      'mySecret',
      { proxyOptions: { host: 'http://myproxy', port: 80, username: undefined, password: undefined } }
    ]);
  });

  it('should build credential with aad-app-certificate authentication', async () => {
    certificateRepository.findById.mock.mockImplementationOnce(() => testData.certificates.list[0]);
    await prepareConnection({ authentication: 'aad-app-certificate', clientSecret: undefined, certificateId: 'certificate1' });
    assert.strictEqual(certificateRepository.findById.mock.calls.length, 1);
    assert.deepStrictEqual(certificateRepository.findById.mock.calls[0].arguments, ['certificate1']);
    assert.strictEqual(ClientCertificateCredentialMock.mock.calls.length, 1);
    assert.deepStrictEqual(ClientCertificateCredentialMock.mock.calls[0].arguments, ['tenantId', 'clientId', expectedCertificate]);
  });

  it('should build credential with aad-app-certificate authentication and proxyOptions when useProxy is true', async () => {
    certificateRepository.findById.mock.mockImplementationOnce(() => testData.certificates.list[0]);
    await prepareConnection({
      authentication: 'aad-app-certificate',
      clientSecret: undefined,
      certificateId: 'certificate1',
      ...proxyWithCredentials
    });
    assert.strictEqual(ClientCertificateCredentialMock.mock.calls.length, 1);
    assert.deepStrictEqual(ClientCertificateCredentialMock.mock.calls[0].arguments, [
      'tenantId',
      'clientId',
      expectedCertificate,
      expectedProxyOptions
    ]);
  });

  it('should reject with aad-app-certificate authentication when certificate is not found', async () => {
    certificateRepository.findById.mock.mockImplementationOnce(() => null);
    await assert.rejects(
      prepareConnection({ authentication: 'aad-app-certificate', clientSecret: undefined, certificateId: 'unknownCertificate' }),
      new Error('Could not find certificate "unknownCertificate"')
    );
  });

  const managedIdentity: Partial<NorthAzureDataExplorerSettings> = {
    authentication: 'managed-identity',
    tenantId: undefined,
    clientId: undefined,
    clientSecret: undefined
  };

  it('should build credential with managed-identity authentication', async () => {
    await prepareConnection(managedIdentity);
    assert.strictEqual(DefaultAzureCredentialMock.mock.calls.length, 1);
    assert.deepStrictEqual(DefaultAzureCredentialMock.mock.calls[0].arguments, []);
    assert.strictEqual(encryptionService.decryptText.mock.calls.length, 0);
  });

  it('should build credential with managed-identity authentication and proxyOptions when useProxy is true', async () => {
    await prepareConnection({ ...managedIdentity, ...proxyWithCredentials });
    assert.strictEqual(DefaultAzureCredentialMock.mock.calls.length, 1);
    assert.deepStrictEqual(DefaultAzureCredentialMock.mock.calls[0].arguments, [expectedProxyOptions]);
  });

  it('should build credential without proxyOptions when useProxy is false', async () => {
    await prepareConnection(managedIdentity);
    assert.strictEqual(DefaultAzureCredentialMock.mock.calls.length, 1);
    assert.deepStrictEqual(DefaultAzureCredentialMock.mock.calls[0].arguments, []);
  });

  it('should build two distinct connection string builders for management and ingest clients', async () => {
    const settings = north.connectorConfiguration.settings;
    await north.prepareConnection(settings);
    assert.strictEqual(withTokenCredentialMock.mock.calls.length, 2);
    assert.strictEqual(withTokenCredentialMock.mock.calls[0].arguments[0], settings.clusterUrl);
    assert.strictEqual(withTokenCredentialMock.mock.calls[1].arguments[0], settings.clusterUrl);
    const firstKcsb = withTokenCredentialMock.mock.calls[0].result;
    const secondKcsb = withTokenCredentialMock.mock.calls[1].result;
    assert.notStrictEqual(firstKcsb, secondKcsb);
    assert.strictEqual(ClientMock.mock.calls.length, 1);
    assert.strictEqual(IngestClientMock.mock.calls.length, 1);
  });

  it('should not build or apply a proxy agent when useProxy is false', async () => {
    await north.prepareConnection(north.connectorConfiguration.settings);
    assert.strictEqual(HttpsProxyAgentMock.mock.calls.length, 0);
    assert.strictEqual(kustoClient.axiosInstance.defaults.httpsAgent, undefined);
    assert.strictEqual(ingestResourceManagerKustoClient.axiosInstance.defaults.httpsAgent, undefined);
    for (const call of logger.info.mock.calls) {
      assert.ok(!(call.arguments[0] as string).toLowerCase().includes('proxy'));
    }
  });

  it('should build and apply a proxy agent on both clients, logging only the host, when useProxy is true with credentials', async () => {
    await prepareConnection({ ...managedIdentity, ...proxyWithCredentials });

    assert.strictEqual(HttpsProxyAgentMock.mock.calls.length, 1);
    const authenticatedUrl = HttpsProxyAgentMock.mock.calls[0].arguments[0] as string;
    assert.ok(authenticatedUrl.includes('proxyUser'));
    assert.ok(authenticatedUrl.includes('proxySecret'));

    const agent = HttpsProxyAgentMock.mock.calls[0].result;
    assert.strictEqual(kustoClient.axiosInstance.defaults.httpsAgent, agent);
    assert.strictEqual(kustoClient.axiosInstance.defaults.proxy, false);
    assert.strictEqual(ingestResourceManagerKustoClient.axiosInstance.defaults.httpsAgent, agent);
    assert.strictEqual(ingestResourceManagerKustoClient.axiosInstance.defaults.proxy, false);

    const proxyLog = logger.info.mock.calls.find(call => (call.arguments[0] as string).toLowerCase().includes('proxy'));
    assert.ok(proxyLog !== undefined);
    const message = proxyLog.arguments[0] as string;
    assert.ok(message.includes('myproxy:8080'));
    assert.ok(!message.includes('proxySecret'));
    assert.ok(!message.includes('proxyUser'));
  });

  it('should build a proxy agent from a credential-less url when useProxy is true without username/password', async () => {
    await prepareConnection({
      ...managedIdentity,
      useProxy: true,
      proxyUrl: 'http://myproxy:8080',
      proxyUsername: null,
      proxyPassword: null
    });
    assert.strictEqual(HttpsProxyAgentMock.mock.calls.length, 1);
    assert.strictEqual(HttpsProxyAgentMock.mock.calls[0].arguments[0], 'http://myproxy:8080/');
  });

  it('should properly test connection', async () => {
    const prepareConnectionMock = mock.method(north, 'prepareConnection', async () => undefined);
    north['kustoClient'] = kustoClient;
    const testResult = await north.testConnection();
    assert.strictEqual(prepareConnectionMock.mock.calls.length, 1);
    assert.strictEqual(kustoClient.executeMgmt.mock.calls.length, 1);
    assert.deepStrictEqual(kustoClient.executeMgmt.mock.calls[0].arguments, ['mydatabase', ".show table ['mytable'] cslschema"]);
    assert.deepStrictEqual(testResult, {
      items: [
        { key: 'Cluster', value: 'https://mycluster.westeurope.kusto.windows.net' },
        { key: 'Database', value: 'mydatabase' },
        { key: 'Table', value: 'mytable' },
        { key: 'Data format', value: 'csv' }
      ]
    });
    // both clients are closed at the end of testConnection, on the success path
    assert.strictEqual(kustoClient.close.mock.calls.length, 1);
    assert.strictEqual(north['kustoClient'], null);
    assert.strictEqual(north['ingestClient'], null);
  });

  it('should build the bracket-quoted mgmt command for a table name containing hyphens', async () => {
    createNorth({ table: 'raw-events' });
    mock.method(north, 'prepareConnection', async () => undefined);
    north['kustoClient'] = kustoClient;
    await north.testConnection();
    assert.deepStrictEqual(kustoClient.executeMgmt.mock.calls[0].arguments, ['mydatabase', ".show table ['raw-events'] cslschema"]);
  });

  it('should properly fail testing connection when executeMgmt rejects', async () => {
    mock.method(north, 'prepareConnection', async () => undefined);
    const adHocKustoClient = createKustoClient({
      executeMgmt: async () => {
        throw new Error('connection error');
      }
    });
    north['kustoClient'] = adHocKustoClient;
    await assert.rejects(north.testConnection(), new Error('Error testing Azure Data Explorer connection: connection error'));
    // both clients are closed even when the mgmt command fails
    assert.strictEqual(adHocKustoClient.close.mock.calls.length, 1);
    assert.strictEqual(north['kustoClient'], null);
    assert.strictEqual(north['ingestClient'], null);
  });

  it('should reject testing connection with invalid table name without connecting', async () => {
    createNorth({ table: 'bad name; .drop table' });
    const prepareConnectionMock = mock.method(north, 'prepareConnection', async () => undefined);
    await assert.rejects(north.testConnection(), new Error('Invalid table name "bad name; .drop table"'));
    assert.strictEqual(prepareConnectionMock.mock.calls.length, 0);
    assert.strictEqual(kustoClient.executeMgmt.mock.calls.length, 0);
  });

  it('should properly handle content', async () => {
    north['ingestClient'] = ingestClient;
    await north.handleContent(fileStream, cacheMetadata);
    assert.strictEqual(ingestClient.ingestFromFile.mock.calls.length, 1);
    assert.strictEqual(ingestClient.ingestFromFile.mock.calls[0].arguments[0], '/cache/content/file.csv');
    assertContains(ingestClient.ingestFromFile.mock.calls[0].arguments[1], { database: 'mydatabase', table: 'mytable', format: 'csv' });
  });

  it('should build ingestion properties without a mapping', () => {
    const properties = north['buildIngestionProperties']();
    assert.strictEqual(properties.database, 'mydatabase');
    assert.strictEqual(properties.table, 'mytable');
    assert.strictEqual(properties.format, 'csv');
    assert.strictEqual('ingestionMappingReference' in properties, false);
    assert.strictEqual('ingestionMappingKind' in properties, false);
  });

  it('should build ingestion properties with a mapping for each data format', () => {
    const cases: Array<{ dataFormat: 'csv' | 'json' | 'multijson'; expectedKind: string }> = [
      { dataFormat: 'csv', expectedKind: 'Csv' },
      { dataFormat: 'json', expectedKind: 'Json' },
      { dataFormat: 'multijson', expectedKind: 'Json' }
    ];
    for (const { dataFormat, expectedKind } of cases) {
      createNorth({ dataFormat, ingestionMappingName: 'myMapping' });
      const properties = north['buildIngestionProperties']();
      assert.strictEqual(properties.ingestionMappingReference, 'myMapping');
      assert.strictEqual(properties.ingestionMappingKind, expectedKind);
    }
  });

  it('should propagate errors from handleContent', async () => {
    north['ingestClient'] = createMock<IngestClient>({
      ingestFromFile: async () => {
        throw new Error('ingest error');
      }
    });
    await assert.rejects(north.handleContent(fileStream, cacheMetadata), new Error('ingest error'));
  });

  it('should properly disconnect and close both clients', async () => {
    north['ingestClient'] = ingestClient;
    north['kustoClient'] = kustoClient;
    await north.disconnect();
    assert.strictEqual(ingestClient.close.mock.calls.length, 1);
    assert.strictEqual(kustoClient.close.mock.calls.length, 1);
    assert.strictEqual(north['ingestClient'], null);
    assert.strictEqual(north['kustoClient'], null);
  });

  it('should resolve disconnect even when close throws', async () => {
    north['ingestClient'] = createMock<IngestClient>({
      close: () => {
        throw new Error('ingest close error');
      }
    });
    north['kustoClient'] = createKustoClient({
      close: () => {
        throw new Error('kusto close error');
      }
    });
    await north.disconnect();
    assert.strictEqual(north['ingestClient'], null);
    assert.strictEqual(north['kustoClient'], null);
    assert.ok(logger.error.mock.calls.some(call => (call.arguments[0] as string).includes('ingest close error')));
    assert.ok(logger.error.mock.calls.some(call => (call.arguments[0] as string).includes('kusto close error')));
  });
});
