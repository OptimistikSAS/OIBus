import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { ReadStream } from 'node:fs';
import testData from '../../tests/utils/test-data';
import { mockModule, reloadModule, buildNorthEntity } from '../../tests/utils/test-utils';
import CacheServiceMock from '../../tests/__mocks__/service/cache/cache-service.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import CertificateRepositoryMock from '../../tests/__mocks__/repository/config/certificate-repository.mock';
import type { NorthAzureDataExplorerSettings } from '../../../shared/model/north-settings.model';
import type { CacheMetadata } from '../../../shared/model/engine.model';
import type NorthAzureDataExplorerClass from './north-azure-data-explorer';

const nodeRequire = createRequire(import.meta.url);

describe('NorthAzureDataExplorer', () => {
  let NorthAzureDataExplorer: typeof NorthAzureDataExplorerClass;
  let north: NorthAzureDataExplorerClass;

  const logger = new PinoLogger();
  const cacheService = new CacheServiceMock();
  const encryptionServiceMock = new EncryptionServiceMock('', '');
  const certificateRepository = new CertificateRepositoryMock();

  const transformerExports = {
    createTransformer: mock.fn(() => ({}))
  };

  const utilsExports = {
    streamToString: mock.fn(async () => '[]'),
    checkAge: mock.fn(() => true),
    compress: mock.fn(async () => undefined),
    delay: mock.fn(async () => undefined),
    generateIntervals: mock.fn(() => []),
    groupItemsByGroup: mock.fn(() => []),
    validateCronExpression: mock.fn(() => ({ expression: '' }))
  };

  // Kusto data client mock
  const kustoClientInstance = {
    executeMgmt: mock.fn(async () => undefined),
    close: mock.fn(),
    axiosInstance: { defaults: {} as Record<string, unknown> }
  };
  const ClientMock = mock.fn(function (..._args: Array<unknown>) {
    return kustoClientInstance;
  });
  const withTokenCredentialMock = mock.fn((_clusterUrl: string, _credential: unknown) => ({}));

  // Kusto ingest client mock
  const ingestResourceManagerKustoClient = { axiosInstance: { defaults: {} as Record<string, unknown> } };
  const ingestClientInstance = {
    ingestFromFile: mock.fn(async () => undefined),
    close: mock.fn(),
    resourceManager: { kustoClient: ingestResourceManagerKustoClient }
  };
  const IngestClientMock = mock.fn(function (..._args: Array<unknown>) {
    return ingestClientInstance;
  });
  const IngestionPropertiesMock = mock.fn(function (this: Record<string, unknown>, props: Record<string, unknown>) {
    Object.assign(this, props);
    return this;
  });
  const dataFormatMappingKindMock = mock.fn((format: string) => (format === 'csv' ? 'Csv' : 'Json'));

  // @azure/identity mocks
  const ClientSecretCredentialMock = mock.fn(function (..._args: Array<unknown>) {
    return {};
  });
  const ClientCertificateCredentialMock = mock.fn(function (..._args: Array<unknown>) {
    return {};
  });
  const DefaultAzureCredentialMock = mock.fn(function (..._args: Array<unknown>) {
    return {};
  });

  const HttpsProxyAgentMock = mock.fn(function (..._args: Array<unknown>) {
    return {};
  });

  const azureKustoDataExports = {
    __esModule: true,
    Client: ClientMock,
    KustoConnectionStringBuilder: { withTokenCredential: withTokenCredentialMock }
  };

  const azureKustoIngestExports = {
    __esModule: true,
    IngestClient: IngestClientMock,
    IngestionProperties: IngestionPropertiesMock,
    DataFormat: { CSV: 'csv', JSON: 'json', MULTIJSON: 'multijson' },
    dataFormatMappingKind: dataFormatMappingKindMock
  };

  const azureIdentityExports = {
    __esModule: true,
    ClientSecretCredential: ClientSecretCredentialMock,
    ClientCertificateCredential: ClientCertificateCredentialMock,
    DefaultAzureCredential: DefaultAzureCredentialMock
  };

  const cronMockInstance = { stop: mock.fn(), start: mock.fn() };
  const cronExports = {
    CronJob: mock.fn(function () {
      return cronMockInstance;
    })
  };

  before(() => {
    mockModule(nodeRequire, 'cron', cronExports);
    mockModule(nodeRequire, '../../service/transformer.service', transformerExports);
    mockModule(nodeRequire, '../../service/utils', utilsExports);
    mockModule(nodeRequire, '../../service/encryption.service', {
      __esModule: true,
      encryptionService: encryptionServiceMock
    });
    mockModule(nodeRequire, '../../service/cache/cache.service', {
      __esModule: true,
      default: function () {
        return cacheService;
      }
    });
    mockModule(nodeRequire, 'azure-kusto-data', azureKustoDataExports);
    mockModule(nodeRequire, 'azure-kusto-ingest', azureKustoIngestExports);
    mockModule(nodeRequire, '@azure/identity', azureIdentityExports);
    mockModule(nodeRequire, 'https-proxy-agent', { __esModule: true, HttpsProxyAgent: HttpsProxyAgentMock });
    mockModule(nodeRequire, 'node:fs/promises', { __esModule: true });
    mockModule(nodeRequire, '../../service/logger/logger.service', {
      loggerService: { createChildLogger: mock.fn(() => logger) },
      default: class {}
    });

    NorthAzureDataExplorer = reloadModule<{ default: typeof NorthAzureDataExplorerClass }>(
      nodeRequire,
      './north-azure-data-explorer'
    ).default;
  });

  beforeEach(() => {
    transformerExports.createTransformer.mock.resetCalls();
    logger.trace.mock.resetCalls();
    logger.debug.mock.resetCalls();
    logger.info.mock.resetCalls();
    logger.warn.mock.resetCalls();
    logger.error.mock.resetCalls();
    ClientMock.mock.resetCalls();
    withTokenCredentialMock.mock.resetCalls();
    IngestClientMock.mock.resetCalls();
    IngestionPropertiesMock.mock.resetCalls();
    dataFormatMappingKindMock.mock.resetCalls();
    ClientSecretCredentialMock.mock.resetCalls();
    ClientCertificateCredentialMock.mock.resetCalls();
    DefaultAzureCredentialMock.mock.resetCalls();
    HttpsProxyAgentMock.mock.resetCalls();
    kustoClientInstance.executeMgmt.mock.resetCalls();
    kustoClientInstance.close.mock.resetCalls();
    kustoClientInstance.axiosInstance.defaults = {};
    ingestClientInstance.ingestFromFile.mock.resetCalls();
    ingestClientInstance.close.mock.resetCalls();
    ingestResourceManagerKustoClient.axiosInstance.defaults = {};
    encryptionServiceMock.decryptText.mock.resetCalls();
    certificateRepository.findById.mock.resetCalls();
    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });

    north = new NorthAzureDataExplorer(
      buildNorthEntity<NorthAzureDataExplorerSettings>('azure-data-explorer', {
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
        useProxy: false
      }),
      cacheService,
      certificateRepository
    );
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
    cacheService.cacheSizeEventEmitter.removeAllListeners();
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
    const settings: NorthAzureDataExplorerSettings = {
      clusterUrl: 'https://mycluster.westeurope.kusto.windows.net',
      database: 'mydatabase',
      table: 'mytable',
      authentication: 'aad-app-secret',
      tenantId: 'tenantId',
      clientId: 'clientId',
      clientSecret: 'mySecret',
      certificateId: null,
      dataFormat: 'csv',
      ingestionMappingName: null,
      useProxy: false
    };
    north.connectorConfiguration = buildNorthEntity<NorthAzureDataExplorerSettings>('azure-data-explorer', settings);
    await north.prepareConnection(settings);
    assert.strictEqual(ClientSecretCredentialMock.mock.calls.length, 1);
    assert.deepStrictEqual(ClientSecretCredentialMock.mock.calls[0].arguments, ['tenantId', 'clientId', 'mySecret']);
  });

  it('should build credential with aad-app-certificate authentication', async () => {
    certificateRepository.findById.mock.mockImplementationOnce(() => testData.certificates.list[0]);
    const settings: NorthAzureDataExplorerSettings = {
      clusterUrl: 'https://mycluster.westeurope.kusto.windows.net',
      database: 'mydatabase',
      table: 'mytable',
      authentication: 'aad-app-certificate',
      tenantId: 'tenantId',
      clientId: 'clientId',
      certificateId: 'certificate1',
      dataFormat: 'csv',
      ingestionMappingName: null,
      useProxy: false
    };
    north.connectorConfiguration = buildNorthEntity<NorthAzureDataExplorerSettings>('azure-data-explorer', settings);
    await north.prepareConnection(settings);
    assert.strictEqual(certificateRepository.findById.mock.calls.length, 1);
    assert.deepStrictEqual(certificateRepository.findById.mock.calls[0].arguments, ['certificate1']);
    assert.strictEqual(ClientCertificateCredentialMock.mock.calls.length, 1);
    assert.deepStrictEqual(ClientCertificateCredentialMock.mock.calls[0].arguments, [
      'tenantId',
      'clientId',
      { certificate: `${testData.certificates.list[0].certificate}\n${testData.certificates.list[0].privateKey}` }
    ]);
  });

  it('should reject with aad-app-certificate authentication when certificate is not found', async () => {
    certificateRepository.findById.mock.mockImplementationOnce(() => null);
    const settings: NorthAzureDataExplorerSettings = {
      clusterUrl: 'https://mycluster.westeurope.kusto.windows.net',
      database: 'mydatabase',
      table: 'mytable',
      authentication: 'aad-app-certificate',
      tenantId: 'tenantId',
      clientId: 'clientId',
      certificateId: 'unknownCertificate',
      dataFormat: 'csv',
      ingestionMappingName: null,
      useProxy: false
    };
    north.connectorConfiguration = buildNorthEntity<NorthAzureDataExplorerSettings>('azure-data-explorer', settings);
    await assert.rejects(async () => north.prepareConnection(settings), new Error('Could not find certificate "unknownCertificate"'));
  });

  it('should build credential with managed-identity authentication', async () => {
    const settings: NorthAzureDataExplorerSettings = {
      clusterUrl: 'https://mycluster.westeurope.kusto.windows.net',
      database: 'mydatabase',
      table: 'mytable',
      authentication: 'managed-identity',
      certificateId: null,
      dataFormat: 'csv',
      ingestionMappingName: null,
      useProxy: false
    };
    north.connectorConfiguration = buildNorthEntity<NorthAzureDataExplorerSettings>('azure-data-explorer', settings);
    await north.prepareConnection(settings);
    assert.strictEqual(DefaultAzureCredentialMock.mock.calls.length, 1);
    assert.strictEqual(encryptionServiceMock.decryptText.mock.calls.length, 0);
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
    const settings = north.connectorConfiguration.settings;
    await north.prepareConnection(settings);
    assert.strictEqual(HttpsProxyAgentMock.mock.calls.length, 0);
    assert.strictEqual(kustoClientInstance.axiosInstance.defaults.httpsAgent, undefined);
    assert.strictEqual(ingestResourceManagerKustoClient.axiosInstance.defaults.httpsAgent, undefined);
    for (const call of logger.info.mock.calls) {
      assert.ok(!(call.arguments[0] as string).toLowerCase().includes('proxy'));
    }
  });

  it('should build and apply a proxy agent on both clients, logging only the host, when useProxy is true with credentials', async () => {
    const settings: NorthAzureDataExplorerSettings = {
      clusterUrl: 'https://mycluster.westeurope.kusto.windows.net',
      database: 'mydatabase',
      table: 'mytable',
      authentication: 'managed-identity',
      certificateId: null,
      dataFormat: 'csv',
      ingestionMappingName: null,
      useProxy: true,
      proxyUrl: 'http://myproxy:8080',
      proxyUsername: 'proxyUser',
      proxyPassword: 'proxySecret'
    };
    north.connectorConfiguration = buildNorthEntity<NorthAzureDataExplorerSettings>('azure-data-explorer', settings);
    await north.prepareConnection(settings);

    assert.strictEqual(HttpsProxyAgentMock.mock.calls.length, 1);
    const authenticatedUrl = HttpsProxyAgentMock.mock.calls[0].arguments[0] as string;
    assert.ok(authenticatedUrl.includes('proxyUser'));
    assert.ok(authenticatedUrl.includes('proxySecret'));

    const agent = HttpsProxyAgentMock.mock.calls[0].result;
    assert.strictEqual(kustoClientInstance.axiosInstance.defaults.httpsAgent, agent);
    assert.strictEqual(kustoClientInstance.axiosInstance.defaults.proxy, false);
    assert.strictEqual(ingestResourceManagerKustoClient.axiosInstance.defaults.httpsAgent, agent);
    assert.strictEqual(ingestResourceManagerKustoClient.axiosInstance.defaults.proxy, false);

    const proxyLog = logger.info.mock.calls.find(call => (call.arguments[0] as string).toLowerCase().includes('proxy'));
    assert.ok(proxyLog !== undefined);
    const message = proxyLog!.arguments[0] as string;
    assert.ok(message.includes('myproxy:8080'));
    assert.ok(!message.includes('proxySecret'));
    assert.ok(!message.includes('proxyUser'));
  });

  it('should build a proxy agent from a credential-less url when useProxy is true without username/password', async () => {
    const settings: NorthAzureDataExplorerSettings = {
      clusterUrl: 'https://mycluster.westeurope.kusto.windows.net',
      database: 'mydatabase',
      table: 'mytable',
      authentication: 'managed-identity',
      certificateId: null,
      dataFormat: 'csv',
      ingestionMappingName: null,
      useProxy: true,
      proxyUrl: 'http://myproxy:8080',
      proxyUsername: null,
      proxyPassword: null
    };
    north.connectorConfiguration = buildNorthEntity<NorthAzureDataExplorerSettings>('azure-data-explorer', settings);
    await north.prepareConnection(settings);
    assert.strictEqual(HttpsProxyAgentMock.mock.calls.length, 1);
    const authenticatedUrl = HttpsProxyAgentMock.mock.calls[0].arguments[0] as string;
    assert.strictEqual(authenticatedUrl, 'http://myproxy:8080/');
  });

  it('should properly test connection', async () => {
    const prepareConnectionMock = mock.method(north, 'prepareConnection', async () => undefined);
    north['kustoClient'] = kustoClientInstance as unknown as (typeof north)['kustoClient'];
    const testResult = await north.testConnection();
    assert.strictEqual(prepareConnectionMock.mock.calls.length, 1);
    assert.strictEqual(kustoClientInstance.executeMgmt.mock.calls.length, 1);
    assert.deepStrictEqual(kustoClientInstance.executeMgmt.mock.calls[0].arguments, ['mydatabase', '.show table mytable cslschema']);
    assert.deepStrictEqual(testResult, {
      items: [
        { key: 'Cluster', value: 'https://mycluster.westeurope.kusto.windows.net' },
        { key: 'Database', value: 'mydatabase' },
        { key: 'Table', value: 'mytable' },
        { key: 'Data format', value: 'csv' }
      ]
    });
  });

  it('should properly fail testing connection when executeMgmt rejects', async () => {
    mock.method(north, 'prepareConnection', async () => undefined);
    north['kustoClient'] = {
      executeMgmt: mock.fn(async () => {
        throw new Error('connection error');
      }),
      close: mock.fn()
    } as unknown as (typeof north)['kustoClient'];
    await assert.rejects(async () => north.testConnection(), new Error('Error testing Azure Data Explorer connection: connection error'));
  });

  it('should reject testing connection with invalid table name without connecting', async () => {
    const prepareConnectionMock = mock.method(north, 'prepareConnection', async () => undefined);
    const settings: NorthAzureDataExplorerSettings = {
      ...north.connectorConfiguration.settings,
      table: 'bad name; .drop table'
    };
    north.connectorConfiguration = buildNorthEntity<NorthAzureDataExplorerSettings>('azure-data-explorer', settings);
    await assert.rejects(async () => north.testConnection(), new Error('Invalid table name "bad name; .drop table"'));
    assert.strictEqual(prepareConnectionMock.mock.calls.length, 0);
    assert.strictEqual(kustoClientInstance.executeMgmt.mock.calls.length, 0);
  });

  it('should properly handle content', async () => {
    const fileStream = { path: '/cache/content/file.csv' } as unknown as ReadStream;
    const cacheMetadata = { contentFile: 'file.csv', contentSize: 123 } as CacheMetadata;
    north['ingestClient'] = ingestClientInstance as unknown as (typeof north)['ingestClient'];
    await north.handleContent(fileStream, cacheMetadata);
    assert.strictEqual(ingestClientInstance.ingestFromFile.mock.calls.length, 1);
    assert.strictEqual(ingestClientInstance.ingestFromFile.mock.calls[0].arguments[0], '/cache/content/file.csv');
    const ingestionProperties = ingestClientInstance.ingestFromFile.mock.calls[0].arguments[1] as Record<string, unknown>;
    assert.strictEqual(ingestionProperties.database, 'mydatabase');
    assert.strictEqual(ingestionProperties.table, 'mytable');
    assert.strictEqual(ingestionProperties.format, 'csv');
  });

  it('should build ingestion properties without a mapping', () => {
    const properties = north['buildIngestionProperties']() as unknown as Record<string, unknown>;
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
      const settings: NorthAzureDataExplorerSettings = {
        ...north.connectorConfiguration.settings,
        dataFormat,
        ingestionMappingName: 'myMapping'
      };
      north.connectorConfiguration = buildNorthEntity<NorthAzureDataExplorerSettings>('azure-data-explorer', settings);
      const properties = north['buildIngestionProperties']() as unknown as Record<string, unknown>;
      assert.strictEqual(properties.ingestionMappingReference, 'myMapping');
      assert.strictEqual(properties.ingestionMappingKind, expectedKind);
    }
  });

  it('should propagate errors from handleContent', async () => {
    const fileStream = { path: '/cache/content/file.csv' } as unknown as ReadStream;
    const cacheMetadata = { contentFile: 'file.csv', contentSize: 123 } as CacheMetadata;
    north['ingestClient'] = {
      ingestFromFile: mock.fn(async () => {
        throw new Error('ingest error');
      }),
      close: mock.fn()
    } as unknown as (typeof north)['ingestClient'];
    await assert.rejects(async () => north.handleContent(fileStream, cacheMetadata), new Error('ingest error'));
  });

  it('should properly disconnect and close both clients', async () => {
    north['ingestClient'] = ingestClientInstance as unknown as (typeof north)['ingestClient'];
    north['kustoClient'] = kustoClientInstance as unknown as (typeof north)['kustoClient'];
    await north.disconnect();
    assert.strictEqual(ingestClientInstance.close.mock.calls.length, 1);
    assert.strictEqual(kustoClientInstance.close.mock.calls.length, 1);
    assert.strictEqual(north['ingestClient'], null);
    assert.strictEqual(north['kustoClient'], null);
  });

  it('should resolve disconnect even when close throws', async () => {
    north['ingestClient'] = {
      ingestFromFile: mock.fn(),
      close: mock.fn(() => {
        throw new Error('ingest close error');
      })
    } as unknown as (typeof north)['ingestClient'];
    north['kustoClient'] = {
      executeMgmt: mock.fn(),
      close: mock.fn(() => {
        throw new Error('kusto close error');
      })
    } as unknown as (typeof north)['kustoClient'];
    await north.disconnect();
    assert.strictEqual(north['ingestClient'], null);
    assert.strictEqual(north['kustoClient'], null);
    assert.ok(logger.error.mock.calls.some(call => (call.arguments[0] as string).includes('ingest close error')));
    assert.ok(logger.error.mock.calls.some(call => (call.arguments[0] as string).includes('kusto close error')));
  });
});
