import assert from 'node:assert/strict';
import type { ReadStream } from 'node:fs';
import { createRequire } from 'node:module';
import { afterEach, before, beforeEach, describe, it, type Mock, mock } from 'node:test';

import type { BlobServiceClient, BlockBlobClient, ContainerClient } from '@azure/storage-blob';
import type { DataLakeFileClient, DataLakeFileSystemClient, DataLakeServiceClient } from '@azure/storage-file-datalake';

import type { NorthAzureBlobSettings } from '../../../shared/model/connector/north-settings.model';
import type { CacheMetadata } from '../../../shared/model/domain/engine.model';

import type * as Utils from '../../service/utils';
import { createCacheServiceMock } from '../../tests/__mocks__/service/cache/cache-service.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../tests/utils/test-data';
import { buildNorthEntity, createMock, type Mocked, mockModule, reloadModule } from '../../tests/utils/test-utils';
import type NorthAzureBlobClass from './north-azure-blob';

const nodeRequire = createRequire(import.meta.url);

// The stream is only handed to the (mocked) Azure clients
const readStream = {} as ReadStream;
const metadata = (contentSize: number): CacheMetadata => ({
  contentFile: 'file.csv',
  contentSize,
  numberOfElement: 0,
  createdAt: '',
  contentType: 'any'
});

const buildSettings = (settings: Partial<NorthAzureBlobSettings> = {}): NorthAzureBlobSettings => ({
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
  useProxy: false,
  ...settings
});

type ConstructorMock = Mock<(...args: Array<unknown>) => object>;
// The Azure SDK classes are called with `new`: the mocks must be regular functions
const constructorMock = (): ConstructorMock =>
  mock.fn(function (..._args: Array<unknown>) {
    return {};
  });

describe('NorthAzureBlob', () => {
  let NorthAzureBlob: typeof NorthAzureBlobClass;
  let north: NorthAzureBlobClass;
  let logger: PinoLogger;

  let BlobServiceClientMock: ConstructorMock;
  let StorageSharedKeyCredentialMock: ConstructorMock;
  let DataLakeServiceClientMock: ConstructorMock;
  let DataLakeStorageSharedKeyCredentialMock: ConstructorMock;
  let ClientSecretCredentialMock: ConstructorMock;
  let DefaultAzureCredentialMock: ConstructorMock;

  const azureStorageBlobExports: Record<string, unknown> = {};
  const azureStorageFileDatalakeExports: Record<string, unknown> = {};
  const azureIdentityExports: Record<string, unknown> = {};
  const utilsExports: typeof Utils = { ...nodeRequire('../../service/utils') };

  const createNorth = (settings: Partial<NorthAzureBlobSettings> = {}) => {
    north = new NorthAzureBlob(buildNorthEntity<NorthAzureBlobSettings>('azure-blob', buildSettings(settings)), createCacheServiceMock());
  };

  before(() => {
    mockModule(nodeRequire, '@azure/storage-blob', azureStorageBlobExports);
    mockModule(nodeRequire, '@azure/storage-file-datalake', azureStorageFileDatalakeExports);
    mockModule(nodeRequire, '@azure/identity', azureIdentityExports);
    mockModule(nodeRequire, '../../service/utils', utilsExports);
    mockModule(nodeRequire, '../../service/encryption.service', {
      __esModule: true,
      encryptionService: { decryptText: async (text: string) => text }
    });
    // No transformation here: don't pay for loading every transformer
    mockModule(nodeRequire, '../../service/transformer.service', {});
    mockModule(nodeRequire, '../../service/logger/logger.service', {
      loggerService: { createChildLogger: () => logger },
      default: class {}
    });

    NorthAzureBlob = reloadModule<{ default: typeof NorthAzureBlobClass }>(nodeRequire, './north-azure-blob').default;
  });

  beforeEach(() => {
    logger = new PinoLogger();
    BlobServiceClientMock = constructorMock();
    StorageSharedKeyCredentialMock = constructorMock();
    DataLakeServiceClientMock = constructorMock();
    DataLakeStorageSharedKeyCredentialMock = constructorMock();
    ClientSecretCredentialMock = constructorMock();
    DefaultAzureCredentialMock = constructorMock();
    Object.assign(azureStorageBlobExports, {
      BlobServiceClient: BlobServiceClientMock,
      StorageSharedKeyCredential: StorageSharedKeyCredentialMock
    });
    Object.assign(azureStorageFileDatalakeExports, {
      DataLakeServiceClient: DataLakeServiceClientMock,
      StorageSharedKeyCredential: DataLakeStorageSharedKeyCredentialMock
    });
    Object.assign(azureIdentityExports, {
      ClientSecretCredential: ClientSecretCredentialMock,
      DefaultAzureCredential: DefaultAzureCredentialMock
    });
    // start() waits for runMinDelay before checking the cache
    Object.assign(utilsExports, { delay: async () => undefined });
    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });

    createNorth();
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  /** Gives the connector a Blob Storage client whose containers return this block blob client */
  const setBlobClient = (blockBlobClient: Mocked<BlockBlobClient>) => {
    const containerClient = createMock<ContainerClient>({ getBlockBlobClient: () => blockBlobClient });
    const blobClient = createMock<BlobServiceClient>({ getContainerClient: () => containerClient });
    north['blobClient'] = blobClient;
    return blobClient;
  };

  /** Gives the connector a Data Lake client whose file systems return this file client */
  const setDataLakeClient = (fileClient: Mocked<DataLakeFileClient>) => {
    const fileSystemClient = createMock<DataLakeFileSystemClient>({ getFileClient: () => fileClient });
    const dataLakeClient = createMock<DataLakeServiceClient>({ getFileSystemClient: () => fileSystemClient });
    north['dataLakeClient'] = dataLakeClient;
    return { dataLakeClient, fileSystemClient };
  };

  const assertConnectingLog = (storage: string, settings: NorthAzureBlobSettings) => {
    assert.ok(
      (logger.info.mock.calls[0].arguments[0] as string).includes(
        `Connecting to ${storage} for the account ${settings.account} and the container ${settings.container} using ${settings.authentication} authentication`
      )
    );
  };

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
    const fileClient = createMock<BlockBlobClient>({
      exists: async () => true,
      deleteIfExists: async () => {
        throw new Error('delete error');
      }
    });
    const blobServiceClient = setBlobClient(fileClient);
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

  it('should properly test connection with Azure Blob Storage and successful delete', async () => {
    const prepareConnectionMock = mock.method(north, 'prepareConnection', async () => undefined);
    const fileClient = createMock<BlockBlobClient>({ exists: async () => true });
    setBlobClient(fileClient);
    const testResult = await north.testConnection();
    assert.strictEqual(prepareConnectionMock.mock.calls.length, 1);
    assert.strictEqual(fileClient.deleteIfExists.mock.calls.length, 1);
    assert.strictEqual(logger.error.mock.calls.length, 0);
    assert.deepStrictEqual(testResult, {
      items: [
        { key: 'Account', value: north.connectorConfiguration.settings.account },
        { key: 'Container', value: north.connectorConfiguration.settings.container },
        { key: 'Storage Type', value: 'Azure Blob Storage' }
      ]
    });
  });

  it('should properly test connection with Azure Data Lake Storage', async () => {
    createNorth({ useADLS: true, path: 'oibus' });
    const settings = north.connectorConfiguration.settings;
    const prepareConnectionMock = mock.method(north, 'prepareConnection', async () => undefined);
    const fileClient = createMock<DataLakeFileClient>({
      exists: async () => false,
      delete: async () => {
        throw new Error('delete error');
      }
    });
    const { dataLakeClient, fileSystemClient } = setDataLakeClient(fileClient);
    await assert.rejects(
      north.testConnection(),
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
    createNorth({ useADLS: true, account: undefined, container: 'mycontainer', authentication: 'external', sasToken: '' });
    mock.method(north, 'prepareConnection', async () => undefined);
    setDataLakeClient(createMock<DataLakeFileClient>({ exists: async () => true }));

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
    const settings = buildSettings({ sasToken: 'my token' });
    await north.prepareConnection(settings);
    assertConnectingLog('Azure Blob Storage', settings);
    assert.strictEqual(parseProxyUrlMock.mock.calls.length, 0);
    assert.strictEqual(BlobServiceClientMock.mock.calls.length, 1);
    assert.deepStrictEqual(
      BlobServiceClientMock.mock.calls[0].arguments[0],
      `https://${settings.account}.blob.core.windows.net?${settings.sasToken}`
    );
  });

  it('should properly prepare Azure Data Lake Storage connection with proxy and custom url', async () => {
    const parseProxyUrlMock = mock.method(north, 'parseProxyUrl', () => ({ proxyHost: 'localhost', proxyPort: 8080 }));
    const settings = buildSettings({
      useCustomUrl: true,
      useADLS: true,
      customUrl: 'https://custom-url',
      sasToken: 'my token',
      useProxy: true,
      proxyUrl: 'http://localhost:8080',
      proxyUsername: '',
      proxyPassword: ''
    });
    await north.prepareConnection(settings);
    assertConnectingLog('Azure Data Lake Storage', settings);
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
    const settings = buildSettings({
      useADLS: true,
      customUrl: 'custom-url',
      authentication: 'access-key',
      sasToken: '',
      accessKey: 'my access key',
      useProxy: true,
      proxyUrl: 'http://localhost:8080',
      proxyUsername: 'username',
      proxyPassword: 'password'
    });
    await north.prepareConnection(settings);
    assertConnectingLog('Azure Data Lake Storage', settings);
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
    const settings = buildSettings({
      useCustomUrl: true,
      customUrl: 'https://custom-url',
      authentication: 'access-key',
      sasToken: '',
      accessKey: 'my access key'
    });
    await north.prepareConnection(settings);
    assertConnectingLog('Azure Blob Storage', settings);
    assert.strictEqual(parseProxyUrlMock.mock.calls.length, 0);
    assert.strictEqual(StorageSharedKeyCredentialMock.mock.calls.length, 1);
    assert.deepStrictEqual(StorageSharedKeyCredentialMock.mock.calls[0].arguments, [settings.account, settings.accessKey]);
    assert.strictEqual(BlobServiceClientMock.mock.calls.length, 1);
    assert.deepStrictEqual(BlobServiceClientMock.mock.calls[0].arguments[0], `https://custom-url`);
  });

  const aadSettings: Partial<NorthAzureBlobSettings> = {
    customUrl: 'custom-url',
    authentication: 'aad',
    sasToken: '',
    tenantId: 'tenantId',
    clientId: 'clientId',
    clientSecret: 'secret'
  };

  it('should properly prepare Azure Blob Storage connection without proxy, standard url and aad', async () => {
    const parseProxyUrlMock = mock.method(north, 'parseProxyUrl', () => ({ proxyHost: '', proxyPort: 80 }));
    const settings = buildSettings(aadSettings);
    await north.prepareConnection(settings);
    assertConnectingLog('Azure Blob Storage', settings);
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
    const settings = buildSettings({ ...aadSettings, useADLS: true });
    await north.prepareConnection(settings);
    assertConnectingLog('Azure Data Lake Storage', settings);
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
    const settings = buildSettings({ customUrl: 'custom-url', authentication: 'external', sasToken: '' });
    await north.prepareConnection(settings);
    assertConnectingLog('Azure Blob Storage', settings);
    assert.strictEqual(parseProxyUrlMock.mock.calls.length, 0);
    assert.strictEqual(DefaultAzureCredentialMock.mock.calls.length, 1);
    assert.strictEqual(BlobServiceClientMock.mock.calls.length, 1);
    assert.deepStrictEqual(BlobServiceClientMock.mock.calls[0].arguments[0], `https://${settings.account}.blob.core.windows.net`);
  });

  it('should properly prepare Azure Data Lake Storage connection without proxy, standard url and external', async () => {
    const parseProxyUrlMock = mock.method(north, 'parseProxyUrl', () => ({ proxyHost: '', proxyPort: 80 }));
    const settings = buildSettings({ useADLS: true, customUrl: 'custom-url', authentication: 'external', sasToken: '' });
    await north.prepareConnection(settings);
    assertConnectingLog('Azure Data Lake Storage', settings);
    assert.strictEqual(parseProxyUrlMock.mock.calls.length, 0);
    assert.strictEqual(DefaultAzureCredentialMock.mock.calls.length, 1);
    assert.strictEqual(DataLakeServiceClientMock.mock.calls.length, 1);
    assert.deepStrictEqual(DataLakeServiceClientMock.mock.calls[0].arguments[0], `https://${settings.account}.dfs.core.windows.net`);
  });

  it('should properly handle content with Azure Blob Storage', async () => {
    const fileClient = createMock<BlockBlobClient>({ upload: async () => ({ requestId: 'requestId1' }) });
    const blobServiceClient = setBlobClient(fileClient);
    await north.handleContent(readStream, metadata(123));
    assert.strictEqual(blobServiceClient.getContainerClient.mock.calls.length, 1);
    assert.deepStrictEqual(blobServiceClient.getContainerClient.mock.calls[0].arguments, [north.connectorConfiguration.settings.container]);
    assert.strictEqual(fileClient.upload.mock.calls.length, 1);
    assert.deepStrictEqual(fileClient.upload.mock.calls[0].arguments, [readStream, 123]);
    assert.ok(logger.info.mock.calls.some(c => (c.arguments[0] as string).includes('requestId1')));
  });

  it('should properly handle content with Azure Data Lake Storage', async () => {
    createNorth({ useADLS: true, path: 'oibus' });
    const fileClient = createMock<DataLakeFileClient>({
      createIfNotExists: async () => ({ requestId: 'requestId1' }),
      flush: async () => ({ requestId: 'requestId2' })
    });
    const { dataLakeClient, fileSystemClient } = setDataLakeClient(fileClient);
    await north.handleContent(readStream, metadata(123));
    assert.strictEqual(dataLakeClient.getFileSystemClient.mock.calls.length, 1);
    assert.deepStrictEqual(dataLakeClient.getFileSystemClient.mock.calls[0].arguments, ['container']);
    assert.strictEqual(fileSystemClient.getFileClient.mock.calls.length, 1);
    assert.deepStrictEqual(fileSystemClient.getFileClient.mock.calls[0].arguments, ['oibus/file.csv']);
    assert.strictEqual(fileClient.createIfNotExists.mock.calls.length, 1);
    assert.strictEqual(fileClient.append.mock.calls.length, 1);
    assert.strictEqual(fileClient.flush.mock.calls.length, 1);
    assert.ok(logger.info.mock.calls.some(c => (c.arguments[0] as string).includes('requestId2')));
  });

  it('should properly handle content with Azure Data Lake Storage with empty content', async () => {
    createNorth({ useADLS: true });
    const fileClient = createMock<DataLakeFileClient>({ createIfNotExists: async () => ({ requestId: 'requestId1' }) });
    const { dataLakeClient, fileSystemClient } = setDataLakeClient(fileClient);
    await north.handleContent(readStream, metadata(0));
    assert.strictEqual(dataLakeClient.getFileSystemClient.mock.calls.length, 1);
    assert.deepStrictEqual(dataLakeClient.getFileSystemClient.mock.calls[0].arguments, ['container']);
    assert.strictEqual(fileSystemClient.getFileClient.mock.calls.length, 1);
    assert.deepStrictEqual(fileSystemClient.getFileClient.mock.calls[0].arguments, ['file.csv']);
    assert.strictEqual(fileClient.createIfNotExists.mock.calls.length, 1);
    assert.strictEqual(fileClient.append.mock.calls.length, 0);
    assert.strictEqual(fileClient.flush.mock.calls.length, 0);
    assert.ok(logger.info.mock.calls.some(c => (c.arguments[0] as string).includes('requestId1')));
  });
});
