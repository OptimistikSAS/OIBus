import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import NorthAzureBlob from './north-azure-blob';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import { DataLakeServiceClient, StorageSharedKeyCredential as DataLakeStorageSharedKeyCredential } from '@azure/storage-file-datalake';
import CacheServiceMock from '../../tests/__mocks__/service/cache/cache-service.mock';
import { NorthAzureBlobSettings } from '../../../shared/model/north-settings.model';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import testData from '../../tests/utils/test-data';
import CacheService from '../../service/cache/cache.service';
import { createTransformer } from '../../service/transformer.service';
import OIBusTransformer from '../../transformers/oibus-transformer';
import OIBusTransformerMock from '../../tests/__mocks__/service/transformers/oibus-transformer.mock';
import { buildNorthConfiguration } from '../../tests/utils/test-utils';
import { ClientSecretCredential, DefaultAzureCredential } from '@azure/identity';
import { ReadStream } from 'node:fs';
import { CacheMetadata } from '../../../shared/model/engine.model';

jest.mock('@azure/storage-blob');
jest.mock('@azure/storage-file-datalake');
jest.mock('@azure/identity');
jest.mock('node:fs/promises');
jest.mock('../../service/utils');
jest.mock('../../service/transformer.service');
jest.mock('../../service/encryption.service', () => ({
  encryptionService: new EncryptionServiceMock('', '')
}));

const logger: pino.Logger = new PinoLogger();
const cacheService: CacheService = new CacheServiceMock();
const oiBusTransformer: OIBusTransformer = new OIBusTransformerMock() as unknown as OIBusTransformer;

jest.mock(
  '../../service/cache/cache.service',
  () =>
    function () {
      return cacheService;
    }
);

let configuration: NorthConnectorEntity<NorthAzureBlobSettings>;
let north: NorthAzureBlob;
describe('NorthAzureBlob', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    (createTransformer as jest.Mock).mockImplementation(() => oiBusTransformer);

    configuration = buildNorthConfiguration<NorthAzureBlobSettings>('azure-blob', {
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
    });
    north = new NorthAzureBlob(configuration, logger, cacheService);
  });

  afterEach(() => {
    jest.useRealTimers();
    cacheService.cacheSizeEventEmitter.removeAllListeners();
  });

  it('should retrieve supported types', () => {
    expect(north.supportedTypes()).toEqual(['any']);
  });

  it('should properly start', async () => {
    north.prepareConnection = jest.fn();
    await north.start();
    expect(north.prepareConnection).toHaveBeenCalledWith(configuration.settings);
  });

  it('should properly test connection with Azure Blob Storage', async () => {
    north.prepareConnection = jest.fn();
    const fileClient = {
      upload: jest.fn(),
      exists: jest.fn().mockReturnValue(true),
      deleteIfExists: jest.fn().mockRejectedValueOnce(new Error('delete error'))
    };
    const blobServiceClient = {
      getContainerClient: jest.fn().mockImplementation(() => ({ getBlockBlobClient: jest.fn().mockImplementation(() => fileClient) }))
    } as unknown as BlobServiceClient;
    north['blobClient'] = blobServiceClient;
    await north.testConnection();
    expect(north.prepareConnection).toHaveBeenCalledWith(configuration.settings);
    expect(blobServiceClient.getContainerClient).toHaveBeenCalledWith(configuration.settings.container);
    expect(fileClient.upload).toHaveBeenCalledTimes(1);
    expect(fileClient.exists).toHaveBeenCalledTimes(1);
    expect(fileClient.deleteIfExists).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith('Could not delete file "oibus-azure-test.txt": delete error');
  });

  it('should properly test connection with Azure Data Lake Storage', async () => {
    north.prepareConnection = jest.fn();
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
    north.connectorConfiguration = buildNorthConfiguration<NorthAzureBlobSettings>('azure-blob', settings);
    const fileClient = {
      createIfNotExists: jest.fn(),
      exists: jest.fn().mockReturnValue(false),
      delete: jest.fn().mockRejectedValueOnce(new Error('delete error'))
    };
    const fileSystemClient = { getFileClient: jest.fn().mockImplementation(() => fileClient) };
    const dataLakeClient = {
      getFileSystemClient: jest.fn().mockImplementation(() => fileSystemClient)
    } as unknown as DataLakeServiceClient;
    north['dataLakeClient'] = dataLakeClient;
    await expect(north.testConnection()).rejects.toThrow(
      new Error(`Container ${settings.container} and path "oibus/oibus-azure-test.txt" does not exist`)
    );
    expect(north.prepareConnection).toHaveBeenCalledWith(settings);
    expect(dataLakeClient.getFileSystemClient).toHaveBeenCalledWith(settings.container);
    expect(fileSystemClient.getFileClient).toHaveBeenCalledWith('oibus/oibus-azure-test.txt');
    expect(fileClient.createIfNotExists).toHaveBeenCalledTimes(1);
    expect(fileClient.exists).toHaveBeenCalledTimes(1);
    expect(fileClient.delete).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith('Could not delete file "oibus/oibus-azure-test.txt": delete error');
  });

  it('should properly parse proxy url', async () => {
    const proxy1 = north.parseProxyUrl('127.0.0.1');
    expect(proxy1.proxyHost).toBe('127.0.0.1');
    expect(proxy1.proxyPort).toBe(80);

    const proxy2 = north.parseProxyUrl('http://127.0.0.1');
    expect(proxy2.proxyHost).toBe('http://127.0.0.1');
    expect(proxy2.proxyPort).toBe(80);

    const proxy3 = north.parseProxyUrl('127.0.0.1:3128');
    expect(proxy3.proxyHost).toBe('http://127.0.0.1');
    expect(proxy3.proxyPort).toBe(3128);

    const proxy4 = north.parseProxyUrl('http://127.0.0.1:3128');
    expect(proxy4.proxyHost).toBe('http://127.0.0.1');
    expect(proxy4.proxyPort).toBe(3128);

    const proxy5 = north.parseProxyUrl('https://proxy:3128');
    expect(proxy5.proxyHost).toBe('https://proxy');
    expect(proxy5.proxyPort).toBe(3128);

    const proxy6 = north.parseProxyUrl('https://proxy');
    expect(proxy6.proxyHost).toBe('https://proxy');
    expect(proxy6.proxyPort).toBe(443);

    expect(() => north.parseProxyUrl('http://127.0.0.1:3128:3128')).toThrow('Bad proxy url http://127.0.0.1:3128:3128');
  });

  it('should properly prepare Azure Blob Storage connection without proxy and standard url', async () => {
    north.parseProxyUrl = jest.fn();
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
    expect(logger.info).toHaveBeenCalledWith(
      `Connecting to Azure Blob Storage for the account ${settings.account} and the container ${settings.container} using ${settings.authentication} authentication`
    );
    expect(north.parseProxyUrl).not.toHaveBeenCalled();
    expect(BlobServiceClient).toHaveBeenCalledWith(`https://${settings.account}.blob.core.windows.net?${settings.sasToken}`, undefined, {
      proxyOptions: undefined
    });
  });

  it('should properly prepare Azure Data Lake Storage connection with proxy and custom url', async () => {
    north.parseProxyUrl = jest.fn().mockReturnValueOnce({ proxyHost: 'localhost', proxyPort: 8080 });
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
    expect(logger.info).toHaveBeenCalledWith(
      `Connecting to Azure Data Lake Storage for the account ${settings.account} and the container ${settings.container} using ${settings.authentication} authentication`
    );
    expect(north.parseProxyUrl).toHaveBeenCalledWith(settings.proxyUrl);
    expect(DataLakeServiceClient).toHaveBeenCalledWith(`${settings.customUrl}?${settings.sasToken}`, undefined, {
      proxyOptions: {
        host: 'localhost',
        port: 8080,
        username: undefined,
        password: undefined
      }
    });
  });

  it('should properly prepare Azure Data Lake Storage connection with proxy, standard url and access token', async () => {
    north.parseProxyUrl = jest.fn().mockReturnValueOnce({ proxyHost: 'localhost', proxyPort: 8080 });
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
    expect(logger.info).toHaveBeenCalledWith(
      `Connecting to Azure Data Lake Storage for the account ${settings.account} and the container ${settings.container} using ${settings.authentication} authentication`
    );
    expect(north.parseProxyUrl).toHaveBeenCalledWith(settings.proxyUrl);
    expect(DataLakeStorageSharedKeyCredential).toHaveBeenCalledWith(settings.account, settings.accessKey);
    expect(DataLakeServiceClient).toHaveBeenCalledWith(`https://${settings.account}.dfs.core.windows.net`, expect.anything(), {
      proxyOptions: {
        host: 'localhost',
        port: 8080,
        username: 'username',
        password: 'password'
      }
    });
  });

  it('should properly prepare Azure Blob Storage connection without proxy, custom url and access token', async () => {
    north.parseProxyUrl = jest.fn();
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
    expect(logger.info).toHaveBeenCalledWith(
      `Connecting to Azure Blob Storage for the account ${settings.account} and the container ${settings.container} using ${settings.authentication} authentication`
    );
    expect(north.parseProxyUrl).not.toHaveBeenCalled();
    expect(StorageSharedKeyCredential).toHaveBeenCalledWith(settings.account, settings.accessKey);
    expect(BlobServiceClient).toHaveBeenCalledWith(`https://custom-url`, expect.anything(), {});
  });

  it('should properly prepare Azure Blob Storage connection without proxy, standard url and aad', async () => {
    north.parseProxyUrl = jest.fn();
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
    expect(logger.info).toHaveBeenCalledWith(
      `Connecting to Azure Blob Storage for the account ${settings.account} and the container ${settings.container} using ${settings.authentication} authentication`
    );
    expect(north.parseProxyUrl).not.toHaveBeenCalled();
    expect(ClientSecretCredential).toHaveBeenCalledWith(settings.tenantId, settings.clientId, settings.clientSecret);
    expect(BlobServiceClient).toHaveBeenCalledWith(`https://${settings.account}.blob.core.windows.net`, expect.anything(), {});
  });

  it('should properly prepare Azure Data Lake Storage connection without proxy, standard url and aad', async () => {
    north.parseProxyUrl = jest.fn();
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
    expect(logger.info).toHaveBeenCalledWith(
      `Connecting to Azure Data Lake Storage for the account ${settings.account} and the container ${settings.container} using ${settings.authentication} authentication`
    );
    expect(north.parseProxyUrl).not.toHaveBeenCalled();
    expect(ClientSecretCredential).toHaveBeenCalledWith(settings.tenantId, settings.clientId, settings.clientSecret);
    expect(DataLakeServiceClient).toHaveBeenCalledWith(`https://${settings.account}.dfs.core.windows.net`, expect.anything(), {});
  });

  it('should properly prepare Azure Blob Storage connection without proxy, standard url and external', async () => {
    north.parseProxyUrl = jest.fn();
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
    expect(logger.info).toHaveBeenCalledWith(
      `Connecting to Azure Blob Storage for the account ${settings.account} and the container ${settings.container} using ${settings.authentication} authentication`
    );
    expect(north.parseProxyUrl).not.toHaveBeenCalled();
    expect(DefaultAzureCredential).toHaveBeenCalled();
    expect(BlobServiceClient).toHaveBeenCalledWith(`https://${settings.account}.blob.core.windows.net`, expect.anything(), {});
  });

  it('should properly prepare Azure Data Lake Storage connection without proxy, standard url and aad', async () => {
    north.parseProxyUrl = jest.fn();
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
    expect(logger.info).toHaveBeenCalledWith(
      `Connecting to Azure Data Lake Storage for the account ${settings.account} and the container ${settings.container} using ${settings.authentication} authentication`
    );
    expect(north.parseProxyUrl).not.toHaveBeenCalled();
    expect(DefaultAzureCredential).toHaveBeenCalled();
    expect(DataLakeServiceClient).toHaveBeenCalledWith(`https://${settings.account}.dfs.core.windows.net`, expect.anything(), {});
  });

  it('should properly handle content with Azure Blob Storage', async () => {
    const readStream = {} as ReadStream;
    const metadata = { contentFile: 'file.csv', contentSize: 123 } as CacheMetadata;
    const fileClient = {
      upload: jest.fn().mockReturnValueOnce({ requestId: 'requestId1' })
    };
    const blobServiceClient = {
      getContainerClient: jest.fn().mockImplementation(() => ({ getBlockBlobClient: jest.fn().mockImplementation(() => fileClient) }))
    } as unknown as BlobServiceClient;
    north['blobClient'] = blobServiceClient;
    await north.handleContent(readStream, metadata);
    expect(blobServiceClient.getContainerClient).toHaveBeenCalledWith(configuration.settings.container);
    expect(fileClient.upload).toHaveBeenCalledWith(readStream, metadata.contentSize);
    expect(logger.info).toHaveBeenCalledWith(
      `Uploaded successfully "${metadata.contentFile}" to Azure Blob Storage with requestId: requestId1`
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
    north.connectorConfiguration = buildNorthConfiguration<NorthAzureBlobSettings>('azure-blob', settings);
    const fileClient = {
      createIfNotExists: jest.fn().mockReturnValueOnce({ requestId: 'requestId1' }),
      append: jest.fn(),
      flush: jest.fn().mockReturnValueOnce({ requestId: 'requestId2' })
    };
    const fileSystemClient = { getFileClient: jest.fn().mockImplementation(() => fileClient) };
    const dataLakeClient = {
      getFileSystemClient: jest.fn().mockImplementation(() => fileSystemClient)
    } as unknown as DataLakeServiceClient;
    north['dataLakeClient'] = dataLakeClient;

    await north.handleContent(readStream, metadata);
    expect(dataLakeClient.getFileSystemClient).toHaveBeenCalledWith(settings.container);
    expect(fileSystemClient.getFileClient).toHaveBeenCalledWith(`oibus/${metadata.contentFile}`);
    expect(fileClient.createIfNotExists).toHaveBeenCalledTimes(1);
    expect(fileClient.append).toHaveBeenCalledTimes(1);
    expect(fileClient.flush).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      `Uploaded successfully "oibus/${metadata.contentFile}" to Azure Data Lake Storage with requestId: requestId2`
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
    north.connectorConfiguration = buildNorthConfiguration<NorthAzureBlobSettings>('azure-blob', settings);
    const fileClient = {
      createIfNotExists: jest.fn().mockReturnValueOnce({ requestId: 'requestId1' }),
      append: jest.fn(),
      flush: jest.fn()
    };
    const fileSystemClient = { getFileClient: jest.fn().mockImplementation(() => fileClient) };
    const dataLakeClient = {
      getFileSystemClient: jest.fn().mockImplementation(() => fileSystemClient)
    } as unknown as DataLakeServiceClient;
    north['dataLakeClient'] = dataLakeClient;

    await north.handleContent(readStream, metadata);
    expect(dataLakeClient.getFileSystemClient).toHaveBeenCalledWith(settings.container);
    expect(fileSystemClient.getFileClient).toHaveBeenCalledWith(metadata.contentFile);
    expect(fileClient.createIfNotExists).toHaveBeenCalledTimes(1);
    expect(fileClient.append).not.toHaveBeenCalled();
    expect(fileClient.flush).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      `Uploaded successfully "${metadata.contentFile}" to Azure Data Lake Storage with requestId: requestId1`
    );
  });
});
