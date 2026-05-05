import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { ReadStream } from 'node:fs';
import testData from '../../tests/utils/test-data';
import { mockModule, reloadModule, buildNorthEntity } from '../../tests/utils/test-utils';
import CacheServiceMock from '../../tests/__mocks__/service/cache/cache-service.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import OIBusTransformerMock from '../../tests/__mocks__/service/transformers/oibus-transformer.mock';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import type { NorthAzureBlobSettings } from '../../../shared/model/north-settings.model';
import type { CacheMetadata } from '../../../shared/model/engine.model';
import type NorthAzureBlobClass from './north-azure-blob';

const nodeRequire = createRequire(import.meta.url);

describe('NorthAzureBlob', () => {
  let NorthAzureBlob: typeof NorthAzureBlobClass;
  let north: NorthAzureBlobClass;

  const logger = new PinoLogger();
  const cacheService = new CacheServiceMock();
  const oiBusTransformer = new OIBusTransformerMock();
  const encryptionServiceMock = new EncryptionServiceMock('', '');

  const transformerExports = {
    createTransformer: mock.fn(() => oiBusTransformer)
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

  // Azure SDK mock classes (need to be real constructors)
  const BlobServiceClientMock = mock.fn(function () {
    return {};
  });
  const StorageSharedKeyCredentialMock = mock.fn(function () {
    return {};
  });
  const DataLakeServiceClientMock = mock.fn(function () {
    return {};
  });
  const DataLakeStorageSharedKeyCredentialMock = mock.fn(function () {
    return {};
  });
  const ClientSecretCredentialMock = mock.fn(function () {
    return {};
  });
  const DefaultAzureCredentialMock = mock.fn(function () {
    return {};
  });

  const azureStorageBlobExports = {
    __esModule: true,
    BlobServiceClient: BlobServiceClientMock,
    StorageSharedKeyCredential: StorageSharedKeyCredentialMock
  };

  const azureStorageFileDatalakeExports = {
    __esModule: true,
    DataLakeServiceClient: DataLakeServiceClientMock,
    StorageSharedKeyCredential: DataLakeStorageSharedKeyCredentialMock
  };

  const azureIdentityExports = {
    __esModule: true,
    ClientSecretCredential: ClientSecretCredentialMock,
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
    mockModule(nodeRequire, '@azure/storage-blob', azureStorageBlobExports);
    mockModule(nodeRequire, '@azure/storage-file-datalake', azureStorageFileDatalakeExports);
    mockModule(nodeRequire, '@azure/identity', azureIdentityExports);
    mockModule(nodeRequire, 'node:fs/promises', { __esModule: true });
    NorthAzureBlob = reloadModule<{ default: typeof NorthAzureBlobClass }>(nodeRequire, './north-azure-blob').default;
  });

  beforeEach(() => {
    transformerExports.createTransformer.mock.resetCalls();
    logger.trace.mock.resetCalls();
    logger.debug.mock.resetCalls();
    logger.info.mock.resetCalls();
    logger.warn.mock.resetCalls();
    logger.error.mock.resetCalls();
    BlobServiceClientMock.mock.resetCalls();
    StorageSharedKeyCredentialMock.mock.resetCalls();
    DataLakeServiceClientMock.mock.resetCalls();
    DataLakeStorageSharedKeyCredentialMock.mock.resetCalls();
    ClientSecretCredentialMock.mock.resetCalls();
    DefaultAzureCredentialMock.mock.resetCalls();
    encryptionServiceMock.decryptText.mock.resetCalls();
    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });

    north = new NorthAzureBlob(
      buildNorthEntity<NorthAzureBlobSettings>('azure-blob', {
        useCustomUrl: false,
        useADLS: false,
        account: 'account',
        container: 'container',
        path: '',
        authentication: 'sas-token',
        sasToken: 'sas',
        accessKey: '',
        tenantId: '',
        clientId: '',
        clientSecret: '',
        useProxy: false
      }),
      logger,
      cacheService
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

  it('should properly test connection with Azure Blob Storage', async () => {
    const prepareConnectionMock = mock.method(north, 'prepareConnection', async () => undefined);
    const fileClient = {
      upload: mock.fn(async () => undefined),
      exists: mock.fn(async () => true),
      deleteIfExists: mock.fn(async () => {
        throw new Error('delete error');
      })
    };
    const blobServiceClient = {
      getContainerClient: mock.fn(() => ({ getBlockBlobClient: mock.fn(() => fileClient) }))
    };
    north['blobClient'] = blobServiceClient as unknown as (typeof north)['blobClient'];
    const testResult = await north.testConnection();
    assert.strictEqual(prepareConnectionMock.mock.calls.length, 1);
    assert.deepStrictEqual(prepareConnectionMock.mock.calls[0].arguments, [north.connectorConfiguration.settings]);
    assert.strictEqual(blobServiceClient.getContainerClient.mock.calls.length, 1);
    assert.deepStrictEqual(blobServiceClient.getContainerClient.mock.calls[0].arguments, [north.connectorConfiguration.settings.container]);
    assert.strictEqual(fileClient.upload.mock.calls.length, 1);
    assert.strictEqual(fileClient.exists.mock.calls.length, 1);
    assert.strictEqual(fileClient.deleteIfExists.mock.calls.length, 1);
    assert.strictEqual(logger.error.mock.calls.length, 1);
    assert.ok((logger.error.mock.calls[0].arguments[0] as string).includes('Could not delete file "oibus-azure-test.txt": delete error'));
    assert.deepStrictEqual(testResult, {
      items: [
        { key: 'Account', value: north.connectorConfiguration.settings.account },
        { key: 'Container', value: north.connectorConfiguration.settings.container },
        { key: 'Storage Type', value: 'Azure Blob Storage' }
      ]
    });
  });

  it('should properly test connection with Azure Data Lake Storage', async () => {
    const settings: NorthAzureBlobSettings = {
      useCustomUrl: false,
      useADLS: true,
      account: 'account',
      container: 'container',
      path: 'oibus',
      authentication: 'sas-token',
      sasToken: 'sas',
      accessKey: '',
      tenantId: '',
      clientId: '',
      clientSecret: '',
      useProxy: false
    };
    north.connectorConfiguration = buildNorthEntity<NorthAzureBlobSettings>('azure-blob', settings);
    const prepareConnectionMock = mock.method(north, 'prepareConnection', async () => undefined);
    const fileClient = {
      createIfNotExists: mock.fn(async () => undefined),
      exists: mock.fn(async () => false),
      delete: mock.fn(async () => {
        throw new Error('delete error');
      })
    };
    const fileSystemClient = { getFileClient: mock.fn(() => fileClient) };
    const dataLakeClient = {
      getFileSystemClient: mock.fn(() => fileSystemClient)
    };
    north['dataLakeClient'] = dataLakeClient as unknown as (typeof north)['dataLakeClient'];
    await assert.rejects(
      async () => north.testConnection(),
      new Error(`Container ${settings.container} and path "oibus/oibus-azure-test.txt" does not exist`)
    );
    assert.strictEqual(prepareConnectionMock.mock.calls.length, 1);
    assert.deepStrictEqual(prepareConnectionMock.mock.calls[0].arguments, [settings]);
    assert.strictEqual(dataLakeClient.getFileSystemClient.mock.calls.length, 1);
    assert.deepStrictEqual(dataLakeClient.getFileSystemClient.mock.calls[0].arguments, [settings.container]);
    assert.strictEqual(fileSystemClient.getFileClient.mock.calls.length, 1);
    assert.deepStrictEqual(fileSystemClient.getFileClient.mock.calls[0].arguments, ['oibus/oibus-azure-test.txt']);
    assert.strictEqual(fileClient.createIfNotExists.mock.calls.length, 1);
    assert.strictEqual(fileClient.exists.mock.calls.length, 1);
    assert.strictEqual(fileClient.delete.mock.calls.length, 1);
    assert.ok(
      (logger.error.mock.calls[0].arguments[0] as string).includes('Could not delete file "oibus/oibus-azure-test.txt": delete error')
    );
  });

  it('should properly test connection with Azure Data Lake Storage success and undefined account', async () => {
    const settings: NorthAzureBlobSettings = {
      useCustomUrl: false,
      useADLS: true,
      account: undefined,
      container: 'mycontainer',
      path: '',
      authentication: 'external',
      sasToken: '',
      accessKey: '',
      tenantId: '',
      clientId: '',
      clientSecret: '',
      useProxy: false
    };
    north.connectorConfiguration = buildNorthEntity<NorthAzureBlobSettings>('azure-blob', settings);
    mock.method(north, 'prepareConnection', async () => undefined);
    const fileClient = {
      createIfNotExists: mock.fn(async () => undefined),
      exists: mock.fn(async () => true),
      delete: mock.fn(async () => undefined)
    };
    const fileSystemClient = { getFileClient: mock.fn(() => fileClient) };
    const dataLakeClient = {
      getFileSystemClient: mock.fn(() => fileSystemClient)
    };
    north['dataLakeClient'] = dataLakeClient as unknown as (typeof north)['dataLakeClient'];

    const testResult = await north.testConnection();

    assert.deepStrictEqual(testResult, {
      items: [
        { key: 'Account', value: '' },
        { key: 'Container', value: 'mycontainer' },
        { key: 'Storage Type', value: 'Azure Data Lake Storage' }
      ]
    });
  });

  it('should properly parse proxy url', () => {
    const proxy1 = north.parseProxyUrl('127.0.0.1');
    assert.strictEqual(proxy1.proxyHost, '127.0.0.1');
    assert.strictEqual(proxy1.proxyPort, 80);

    const proxy2 = north.parseProxyUrl('http://127.0.0.1');
    assert.strictEqual(proxy2.proxyHost, 'http://127.0.0.1');
    assert.strictEqual(proxy2.proxyPort, 80);

    const proxy3 = north.parseProxyUrl('127.0.0.1:3128');
    assert.strictEqual(proxy3.proxyHost, 'http://127.0.0.1');
    assert.strictEqual(proxy3.proxyPort, 3128);

    const proxy4 = north.parseProxyUrl('http://127.0.0.1:3128');
    assert.strictEqual(proxy4.proxyHost, 'http://127.0.0.1');
    assert.strictEqual(proxy4.proxyPort, 3128);

    const proxy5 = north.parseProxyUrl('https://proxy:3128');
    assert.strictEqual(proxy5.proxyHost, 'https://proxy');
    assert.strictEqual(proxy5.proxyPort, 3128);

    const proxy6 = north.parseProxyUrl('https://proxy');
    assert.strictEqual(proxy6.proxyHost, 'https://proxy');
    assert.strictEqual(proxy6.proxyPort, 443);

    assert.throws(() => north.parseProxyUrl('http://127.0.0.1:3128:3128'), /Bad proxy url http:\/\/127\.0\.0\.1:3128:3128/);
  });

  it('should properly prepare Azure Blob Storage connection without proxy and standard url', async () => {
    const parseProxyUrlMock = mock.method(north, 'parseProxyUrl', () => ({ proxyHost: '', proxyPort: 80 }));
    const settings: NorthAzureBlobSettings = {
      useCustomUrl: false,
      useADLS: false,
      account: 'account',
      container: 'container',
      path: '',
      authentication: 'sas-token',
      sasToken: 'my token',
      accessKey: '',
      tenantId: '',
      clientId: '',
      clientSecret: '',
      useProxy: false
    };
    await north.prepareConnection(settings);
    assert.ok(
      (logger.info.mock.calls[0].arguments[0] as string).includes(
        `Connecting to Azure Blob Storage for the account ${settings.account} and the container ${settings.container} using ${settings.authentication} authentication`
      )
    );
    assert.strictEqual(parseProxyUrlMock.mock.calls.length, 0);
    assert.strictEqual(BlobServiceClientMock.mock.calls.length, 1);
    assert.deepStrictEqual(
      BlobServiceClientMock.mock.calls[0].arguments[0],
      `https://${settings.account}.blob.core.windows.net?${settings.sasToken}`
    );
  });

  it('should properly prepare Azure Data Lake Storage connection with proxy and custom url', async () => {
    const parseProxyUrlMock = mock.method(north, 'parseProxyUrl', () => ({ proxyHost: 'localhost', proxyPort: 8080 }));
    const settings: NorthAzureBlobSettings = {
      useCustomUrl: true,
      useADLS: true,
      account: 'account',
      container: 'container',
      customUrl: 'https://custom-url',
      path: '',
      authentication: 'sas-token',
      sasToken: 'my token',
      accessKey: '',
      tenantId: '',
      clientId: '',
      clientSecret: '',
      useProxy: true,
      proxyUrl: 'http://localhost:8080',
      proxyUsername: '',
      proxyPassword: ''
    };
    await north.prepareConnection(settings);
    assert.ok(
      (logger.info.mock.calls[0].arguments[0] as string).includes(
        `Connecting to Azure Data Lake Storage for the account ${settings.account} and the container ${settings.container} using ${settings.authentication} authentication`
      )
    );
    assert.strictEqual(parseProxyUrlMock.mock.calls.length, 1);
    assert.deepStrictEqual(parseProxyUrlMock.mock.calls[0].arguments, [settings.proxyUrl]);
    assert.strictEqual(DataLakeServiceClientMock.mock.calls.length, 1);
    assert.deepStrictEqual(DataLakeServiceClientMock.mock.calls[0].arguments[0], `${settings.customUrl}?${settings.sasToken}`);
    assert.deepStrictEqual(DataLakeServiceClientMock.mock.calls[0].arguments[2], {
      proxyOptions: {
        host: 'localhost',
        port: 8080,
        username: undefined,
        password: undefined
      }
    });
  });

  it('should properly prepare Azure Data Lake Storage connection with proxy, standard url and access token', async () => {
    const parseProxyUrlMock = mock.method(north, 'parseProxyUrl', () => ({ proxyHost: 'localhost', proxyPort: 8080 }));
    const settings: NorthAzureBlobSettings = {
      useCustomUrl: false,
      useADLS: true,
      account: 'account',
      container: 'container',
      customUrl: 'custom-url',
      path: '',
      authentication: 'access-key',
      sasToken: '',
      accessKey: 'my access key',
      tenantId: '',
      clientId: '',
      clientSecret: '',
      useProxy: true,
      proxyUrl: 'http://localhost:8080',
      proxyUsername: 'username',
      proxyPassword: 'password'
    };
    await north.prepareConnection(settings);
    assert.ok(
      (logger.info.mock.calls[0].arguments[0] as string).includes(
        `Connecting to Azure Data Lake Storage for the account ${settings.account} and the container ${settings.container} using ${settings.authentication} authentication`
      )
    );
    assert.strictEqual(parseProxyUrlMock.mock.calls.length, 1);
    assert.deepStrictEqual(parseProxyUrlMock.mock.calls[0].arguments, [settings.proxyUrl]);
    assert.strictEqual(DataLakeStorageSharedKeyCredentialMock.mock.calls.length, 1);
    assert.deepStrictEqual(DataLakeStorageSharedKeyCredentialMock.mock.calls[0].arguments, [settings.account, settings.accessKey]);
    assert.strictEqual(DataLakeServiceClientMock.mock.calls.length, 1);
    assert.deepStrictEqual(DataLakeServiceClientMock.mock.calls[0].arguments[0], `https://${settings.account}.dfs.core.windows.net`);
    assert.deepStrictEqual(DataLakeServiceClientMock.mock.calls[0].arguments[2], {
      proxyOptions: {
        host: 'localhost',
        port: 8080,
        username: 'username',
        password: 'password'
      }
    });
  });

  it('should properly prepare Azure Blob Storage connection without proxy, custom url and access token', async () => {
    const parseProxyUrlMock = mock.method(north, 'parseProxyUrl', () => ({ proxyHost: '', proxyPort: 80 }));
    const settings: NorthAzureBlobSettings = {
      useCustomUrl: true,
      useADLS: false,
      account: 'account',
      container: 'container',
      customUrl: 'https://custom-url',
      path: '',
      authentication: 'access-key',
      sasToken: '',
      accessKey: 'my access key',
      tenantId: '',
      clientId: '',
      clientSecret: '',
      useProxy: false
    };
    await north.prepareConnection(settings);
    assert.ok(
      (logger.info.mock.calls[0].arguments[0] as string).includes(
        `Connecting to Azure Blob Storage for the account ${settings.account} and the container ${settings.container} using ${settings.authentication} authentication`
      )
    );
    assert.strictEqual(parseProxyUrlMock.mock.calls.length, 0);
    assert.strictEqual(StorageSharedKeyCredentialMock.mock.calls.length, 1);
    assert.deepStrictEqual(StorageSharedKeyCredentialMock.mock.calls[0].arguments, [settings.account, settings.accessKey]);
    assert.strictEqual(BlobServiceClientMock.mock.calls.length, 1);
    assert.deepStrictEqual(BlobServiceClientMock.mock.calls[0].arguments[0], `https://custom-url`);
  });

  it('should properly prepare Azure Blob Storage connection without proxy, standard url and aad', async () => {
    const parseProxyUrlMock = mock.method(north, 'parseProxyUrl', () => ({ proxyHost: '', proxyPort: 80 }));
    const settings: NorthAzureBlobSettings = {
      useCustomUrl: false,
      useADLS: false,
      account: 'account',
      container: 'container',
      customUrl: 'custom-url',
      path: '',
      authentication: 'aad',
      sasToken: '',
      accessKey: '',
      tenantId: 'tenantId',
      clientId: 'clientId',
      clientSecret: 'secret',
      useProxy: false
    };
    await north.prepareConnection(settings);
    assert.ok(
      (logger.info.mock.calls[0].arguments[0] as string).includes(
        `Connecting to Azure Blob Storage for the account ${settings.account} and the container ${settings.container} using ${settings.authentication} authentication`
      )
    );
    assert.strictEqual(parseProxyUrlMock.mock.calls.length, 0);
    assert.strictEqual(ClientSecretCredentialMock.mock.calls.length, 1);
    assert.deepStrictEqual(ClientSecretCredentialMock.mock.calls[0].arguments, [
      settings.tenantId,
      settings.clientId,
      settings.clientSecret
    ]);
    assert.strictEqual(BlobServiceClientMock.mock.calls.length, 1);
    assert.deepStrictEqual(BlobServiceClientMock.mock.calls[0].arguments[0], `https://${settings.account}.blob.core.windows.net`);
  });

  it('should properly prepare Azure Data Lake Storage connection without proxy, standard url and aad', async () => {
    const parseProxyUrlMock = mock.method(north, 'parseProxyUrl', () => ({ proxyHost: '', proxyPort: 80 }));
    const settings: NorthAzureBlobSettings = {
      useCustomUrl: false,
      useADLS: true,
      account: 'account',
      container: 'container',
      customUrl: 'custom-url',
      path: '',
      authentication: 'aad',
      sasToken: '',
      accessKey: '',
      tenantId: 'tenantId',
      clientId: 'clientId',
      clientSecret: 'secret',
      useProxy: false
    };
    await north.prepareConnection(settings);
    assert.ok(
      (logger.info.mock.calls[0].arguments[0] as string).includes(
        `Connecting to Azure Data Lake Storage for the account ${settings.account} and the container ${settings.container} using ${settings.authentication} authentication`
      )
    );
    assert.strictEqual(parseProxyUrlMock.mock.calls.length, 0);
    assert.strictEqual(ClientSecretCredentialMock.mock.calls.length, 1);
    assert.deepStrictEqual(ClientSecretCredentialMock.mock.calls[0].arguments, [
      settings.tenantId,
      settings.clientId,
      settings.clientSecret
    ]);
    assert.strictEqual(DataLakeServiceClientMock.mock.calls.length, 1);
    assert.deepStrictEqual(DataLakeServiceClientMock.mock.calls[0].arguments[0], `https://${settings.account}.dfs.core.windows.net`);
  });

  it('should properly prepare Azure Blob Storage connection without proxy, standard url and external', async () => {
    const parseProxyUrlMock = mock.method(north, 'parseProxyUrl', () => ({ proxyHost: '', proxyPort: 80 }));
    const settings: NorthAzureBlobSettings = {
      useCustomUrl: false,
      useADLS: false,
      account: 'account',
      container: 'container',
      customUrl: 'custom-url',
      path: '',
      authentication: 'external',
      sasToken: '',
      accessKey: '',
      tenantId: '',
      clientId: '',
      clientSecret: '',
      useProxy: false
    };
    await north.prepareConnection(settings);
    assert.ok(
      (logger.info.mock.calls[0].arguments[0] as string).includes(
        `Connecting to Azure Blob Storage for the account ${settings.account} and the container ${settings.container} using ${settings.authentication} authentication`
      )
    );
    assert.strictEqual(parseProxyUrlMock.mock.calls.length, 0);
    assert.strictEqual(DefaultAzureCredentialMock.mock.calls.length, 1);
    assert.strictEqual(BlobServiceClientMock.mock.calls.length, 1);
    assert.deepStrictEqual(BlobServiceClientMock.mock.calls[0].arguments[0], `https://${settings.account}.blob.core.windows.net`);
  });

  it('should properly prepare Azure Data Lake Storage connection without proxy, standard url and external', async () => {
    const parseProxyUrlMock = mock.method(north, 'parseProxyUrl', () => ({ proxyHost: '', proxyPort: 80 }));
    const settings: NorthAzureBlobSettings = {
      useCustomUrl: false,
      useADLS: true,
      account: 'account',
      container: 'container',
      customUrl: 'custom-url',
      path: '',
      authentication: 'external',
      sasToken: '',
      accessKey: '',
      tenantId: '',
      clientId: '',
      clientSecret: '',
      useProxy: false
    };
    await north.prepareConnection(settings);
    assert.ok(
      (logger.info.mock.calls[0].arguments[0] as string).includes(
        `Connecting to Azure Data Lake Storage for the account ${settings.account} and the container ${settings.container} using ${settings.authentication} authentication`
      )
    );
    assert.strictEqual(parseProxyUrlMock.mock.calls.length, 0);
    assert.strictEqual(DefaultAzureCredentialMock.mock.calls.length, 1);
    assert.strictEqual(DataLakeServiceClientMock.mock.calls.length, 1);
    assert.deepStrictEqual(DataLakeServiceClientMock.mock.calls[0].arguments[0], `https://${settings.account}.dfs.core.windows.net`);
  });

  it('should properly handle content with Azure Blob Storage', async () => {
    const readStream = {} as ReadStream;
    const metadata = { contentFile: 'file.csv', contentSize: 123 } as CacheMetadata;
    const fileClient = {
      upload: mock.fn(async () => ({ requestId: 'requestId1' }))
    };
    const blobServiceClient = {
      getContainerClient: mock.fn(() => ({ getBlockBlobClient: mock.fn(() => fileClient) }))
    };
    north['blobClient'] = blobServiceClient as unknown as (typeof north)['blobClient'];
    await north.handleContent(readStream, metadata);
    assert.strictEqual(blobServiceClient.getContainerClient.mock.calls.length, 1);
    assert.deepStrictEqual(blobServiceClient.getContainerClient.mock.calls[0].arguments, [north.connectorConfiguration.settings.container]);
    assert.strictEqual(fileClient.upload.mock.calls.length, 1);
    assert.deepStrictEqual(fileClient.upload.mock.calls[0].arguments, [readStream, metadata.contentSize]);
    assert.ok(
      (logger.info.mock.calls.find(c => (c.arguments[0] as string).includes('requestId1')) as { arguments: Array<unknown> } | undefined) !==
        undefined
    );
  });

  it('should properly handle content with Azure Data Lake Storage', async () => {
    const readStream = {} as ReadStream;
    const metadata = { contentFile: 'file.csv', contentSize: 123 } as CacheMetadata;
    const settings: NorthAzureBlobSettings = {
      useCustomUrl: false,
      useADLS: true,
      account: 'account',
      container: 'container',
      path: 'oibus',
      authentication: 'sas-token',
      sasToken: 'sas',
      accessKey: '',
      tenantId: '',
      clientId: '',
      clientSecret: '',
      useProxy: false
    };
    north.connectorConfiguration = buildNorthEntity<NorthAzureBlobSettings>('azure-blob', settings);
    const fileClient = {
      createIfNotExists: mock.fn(async () => ({ requestId: 'requestId1' })),
      append: mock.fn(async () => undefined),
      flush: mock.fn(async () => ({ requestId: 'requestId2' }))
    };
    const fileSystemClient = { getFileClient: mock.fn(() => fileClient) };
    const dataLakeClient = {
      getFileSystemClient: mock.fn(() => fileSystemClient)
    };
    north['dataLakeClient'] = dataLakeClient as unknown as (typeof north)['dataLakeClient'];
    await north.handleContent(readStream, metadata);
    assert.strictEqual(dataLakeClient.getFileSystemClient.mock.calls.length, 1);
    assert.deepStrictEqual(dataLakeClient.getFileSystemClient.mock.calls[0].arguments, [settings.container]);
    assert.strictEqual(fileSystemClient.getFileClient.mock.calls.length, 1);
    assert.deepStrictEqual(fileSystemClient.getFileClient.mock.calls[0].arguments, [`oibus/${metadata.contentFile}`]);
    assert.strictEqual(fileClient.createIfNotExists.mock.calls.length, 1);
    assert.strictEqual(fileClient.append.mock.calls.length, 1);
    assert.strictEqual(fileClient.flush.mock.calls.length, 1);
    assert.ok(
      (logger.info.mock.calls.find(c => (c.arguments[0] as string).includes('requestId2')) as { arguments: Array<unknown> } | undefined) !==
        undefined
    );
  });

  it('should properly handle content with Azure Data Lake Storage with empty content', async () => {
    const readStream = {} as ReadStream;
    const metadata = { contentFile: 'file.csv', contentSize: 0 } as CacheMetadata;
    const settings: NorthAzureBlobSettings = {
      useCustomUrl: false,
      useADLS: true,
      account: 'account',
      container: 'container',
      path: '',
      authentication: 'sas-token',
      sasToken: 'sas',
      accessKey: '',
      tenantId: '',
      clientId: '',
      clientSecret: '',
      useProxy: false
    };
    north.connectorConfiguration = buildNorthEntity<NorthAzureBlobSettings>('azure-blob', settings);
    const fileClient = {
      createIfNotExists: mock.fn(async () => ({ requestId: 'requestId1' })),
      append: mock.fn(async () => undefined),
      flush: mock.fn(async () => undefined)
    };
    const fileSystemClient = { getFileClient: mock.fn(() => fileClient) };
    const dataLakeClient = {
      getFileSystemClient: mock.fn(() => fileSystemClient)
    };
    north['dataLakeClient'] = dataLakeClient as unknown as (typeof north)['dataLakeClient'];
    await north.handleContent(readStream, metadata);
    assert.strictEqual(dataLakeClient.getFileSystemClient.mock.calls.length, 1);
    assert.deepStrictEqual(dataLakeClient.getFileSystemClient.mock.calls[0].arguments, [settings.container]);
    assert.strictEqual(fileSystemClient.getFileClient.mock.calls.length, 1);
    assert.deepStrictEqual(fileSystemClient.getFileClient.mock.calls[0].arguments, [metadata.contentFile]);
    assert.strictEqual(fileClient.createIfNotExists.mock.calls.length, 1);
    assert.strictEqual(fileClient.append.mock.calls.length, 0);
    assert.strictEqual(fileClient.flush.mock.calls.length, 0);
    assert.ok(
      (logger.info.mock.calls.find(c => (c.arguments[0] as string).includes('requestId1')) as { arguments: Array<unknown> } | undefined) !==
        undefined
    );
  });
});
