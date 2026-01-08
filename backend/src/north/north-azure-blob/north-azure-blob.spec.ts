import fs from 'node:fs/promises';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import NorthAzureBlob from './north-azure-blob';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import { DataLakeServiceClient, StorageSharedKeyCredential as DataLakeStorageSharedKeyCredential } from '@azure/storage-file-datalake';
import { ClientSecretCredential, DefaultAzureCredential } from '@azure/identity';
import CacheServiceMock from '../../tests/__mocks__/service/cache/cache-service.mock';
import { NorthAzureBlobSettings } from '../../../shared/model/north-settings.model';
import csv from 'papaparse';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import testData from '../../tests/utils/test-data';
import CacheService from '../../service/cache/cache.service';
import { createTransformer } from '../../service/transformer.service';
import OIBusTransformer from '../../service/transformers/oibus-transformer';
import OIBusTransformerMock from '../../tests/__mocks__/service/transformers/oibus-transformer.mock';
import { getFilenameWithoutRandomId } from '../../service/utils';

const uploadMock = jest.fn().mockReturnValue(Promise.resolve({ requestId: 'requestId' }));
const deleteMock = jest.fn();
const existsMock = jest.fn();
const getBlockBlobClientMock = jest.fn().mockImplementation(() => ({
  upload: uploadMock,
  exists: existsMock,
  deleteIfExists: deleteMock
}));
const getContainerClientMock = jest.fn().mockImplementation(() => ({
  getBlockBlobClient: getBlockBlobClientMock
}));
jest.mock('@azure/storage-blob', () => ({
  BlobServiceClient: jest.fn().mockImplementation(() => ({
    getContainerClient: getContainerClientMock
  })),
  StorageSharedKeyCredential: jest.fn()
}));
const bufferFlushMock = jest.fn().mockReturnValue(Promise.resolve({ requestId: 'requestId' }));
const getFileClientMock = jest.fn().mockImplementation(() => ({
  createIfNotExists: jest.fn().mockReturnValue(Promise.resolve({ requestId: 'requestId' })),
  append: jest.fn(),
  flush: bufferFlushMock,
  exists: existsMock,
  delete: deleteMock
}));
const getFileSystemClientMock = jest.fn().mockImplementation(() => ({
  getFileClient: getFileClientMock
}));
jest.mock('@azure/storage-file-datalake', () => ({
  DataLakeServiceClient: jest.fn().mockImplementation(() => ({
    getFileSystemClient: getFileSystemClientMock
  })),
  StorageSharedKeyCredential: jest.fn()
}));
jest.mock('@azure/identity', () => ({
  DefaultAzureCredential: jest.fn(),
  ClientSecretCredential: jest.fn()
}));
jest.mock('papaparse');
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
describe('NorthAzureBlob without proxy', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    (csv.unparse as jest.Mock).mockReturnValue('csv content');
    (createTransformer as jest.Mock).mockImplementation(() => oiBusTransformer);
    (getFilenameWithoutRandomId as jest.Mock).mockReturnValue('example.file');

    configuration = JSON.parse(JSON.stringify(testData.north.list[0]));
    configuration.settings = {
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
    };
  });

  afterEach(() => {
    cacheService.cacheSizeEventEmitter.removeAllListeners();
  });

  it('should properly handle files using Shared Access Signature authentication', async () => {
    (fs.stat as jest.Mock).mockImplementationOnce(() => Promise.resolve({ size: 666 }));
    (fs.readFile as jest.Mock).mockImplementationOnce(() => Promise.resolve('content'));

    configuration.settings.authentication = 'sas-token';
    configuration.settings.sasToken = 'sas token';
    north = new NorthAzureBlob(configuration, logger, 'cacheFolder', cacheService);

    await north.start();
    await north.handleContent({
      contentFile: '/path/to/file/example-123.file',
      contentSize: 1234,
      numberOfElement: 0,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'any'
    });

    expect(fs.stat).toHaveBeenCalledWith('/path/to/file/example-123.file');
    expect(fs.readFile).toHaveBeenCalledWith('/path/to/file/example-123.file');

    expect(BlobServiceClient).toHaveBeenCalledWith(
      `https://${configuration.settings.account}.blob.core.windows.net?${configuration.settings.sasToken}`,
      undefined,
      { proxyOptions: undefined }
    );
    expect(getContainerClientMock).toHaveBeenCalledWith(configuration.settings.container);
    expect(getBlockBlobClientMock).toHaveBeenCalledWith('example.file');
    expect(uploadMock).toHaveBeenCalledWith('content', 666);
  });

  it('should properly handle files on Azure Data Lake Storage using Shared Access Signature authentication', async () => {
    (fs.stat as jest.Mock).mockImplementationOnce(() => Promise.resolve({ size: 666 }));
    (fs.readFile as jest.Mock).mockImplementationOnce(() => Promise.resolve('content'));
    configuration.settings.authentication = 'sas-token';
    configuration.settings.sasToken = 'sas token';
    configuration.settings.useADLS = true;
    north = new NorthAzureBlob(configuration, logger, 'cacheFolder', cacheService);
    await north.start();
    await north.handleContent({
      contentFile: '/path/to/file/example-123.file',
      contentSize: 1234,
      numberOfElement: 0,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'any'
    });
    expect(fs.stat).toHaveBeenCalledWith('/path/to/file/example-123.file');
    expect(fs.readFile).toHaveBeenCalledWith('/path/to/file/example-123.file');
    expect(DataLakeServiceClient).toHaveBeenCalledWith(
      `https://${configuration.settings.account}.dfs.core.windows.net?${configuration.settings.sasToken}`,
      undefined,
      { proxyOptions: undefined }
    );
    expect(getFileSystemClientMock).toHaveBeenCalledWith(configuration.settings.container);
    expect(getFileClientMock).toHaveBeenCalledWith('example.file');
    expect(bufferFlushMock).toHaveBeenCalledWith('content'.length);
  });

  it('should properly handle files using Access Key authentication', async () => {
    const filePath = '/path/to/file/example-123.file';
    (fs.stat as jest.Mock).mockImplementationOnce(() => Promise.resolve({ size: 666 }));
    (fs.readFile as jest.Mock).mockImplementationOnce(() => Promise.resolve('content'));
    const sharedKeyCredential = jest.fn();
    (StorageSharedKeyCredential as jest.Mock).mockImplementationOnce(() => sharedKeyCredential);

    configuration.settings.authentication = 'access-key';
    configuration.settings.accessKey = 'access key';
    north = new NorthAzureBlob(configuration, logger, 'cacheFolder', cacheService);

    await north.start();
    await north.handleContent({
      contentFile: filePath,
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'any'
    });

    expect(fs.stat).toHaveBeenCalledWith(filePath);
    expect(fs.readFile).toHaveBeenCalledWith(filePath);
    expect(StorageSharedKeyCredential).toHaveBeenCalledWith(configuration.settings.account, configuration.settings.accessKey);
    expect(BlobServiceClient).toHaveBeenCalledWith(`https://${configuration.settings.account}.blob.core.windows.net`, sharedKeyCredential, {
      proxyOptions: undefined
    });
    expect(getContainerClientMock).toHaveBeenCalledWith(configuration.settings.container);
    expect(getBlockBlobClientMock).toHaveBeenCalledWith('example.file');
    expect(uploadMock).toHaveBeenCalledWith('content', 666);
  });

  it('should properly handle files on Azure Data Lake Storage using Access Key authentication', async () => {
    const filePath = '/path/to/file/example-123.file';
    (fs.stat as jest.Mock).mockImplementationOnce(() => Promise.resolve({ size: 666 }));
    (fs.readFile as jest.Mock).mockImplementationOnce(() => Promise.resolve('content'));
    const sharedKeyCredential = jest.fn();
    (DataLakeStorageSharedKeyCredential as jest.Mock).mockImplementationOnce(() => sharedKeyCredential);
    configuration.settings.authentication = 'access-key';
    configuration.settings.accessKey = 'access key';
    configuration.settings.useADLS = true;
    north = new NorthAzureBlob(configuration, logger, 'cacheFolder', cacheService);
    await north.start();
    await north.handleContent({
      contentFile: filePath,
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'any'
    });
    expect(fs.stat).toHaveBeenCalledWith(filePath);
    expect(fs.readFile).toHaveBeenCalledWith(filePath);
    expect(DataLakeStorageSharedKeyCredential).toHaveBeenCalledWith(configuration.settings.account, configuration.settings.accessKey);
    expect(DataLakeServiceClient).toHaveBeenCalledWith(
      `https://${configuration.settings.account}.dfs.core.windows.net`,
      sharedKeyCredential,
      {
        proxyOptions: undefined
      }
    );
    expect(getFileSystemClientMock).toHaveBeenCalledWith(configuration.settings.container);
    expect(getFileClientMock).toHaveBeenCalledWith('example.file');
    expect(bufferFlushMock).toHaveBeenCalledWith('content'.length);
  });
  it('should properly handle files using Azure Active Directory authentication', async () => {
    const filePath = '/path/to/file/example-123.file';
    (fs.stat as jest.Mock).mockImplementationOnce(() => Promise.resolve({ size: 666 }));
    (fs.readFile as jest.Mock).mockImplementationOnce(() => Promise.resolve('content'));
    const clientSecretCredential = jest.fn();
    (ClientSecretCredential as jest.Mock).mockImplementationOnce(() => clientSecretCredential);

    configuration.settings.authentication = 'aad';
    configuration.settings.tenantId = 'tenantId';
    configuration.settings.clientId = 'clientId';
    configuration.settings.clientSecret = 'clientSecret';
    north = new NorthAzureBlob(configuration, logger, 'cacheFolder', cacheService);

    await north.start();
    await north.handleContent({
      contentFile: filePath,
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'any'
    });

    expect(fs.stat).toHaveBeenCalledWith(filePath);
    expect(fs.readFile).toHaveBeenCalledWith(filePath);
    expect(ClientSecretCredential).toHaveBeenCalled();
    expect(BlobServiceClient).toHaveBeenCalledWith(
      `https://${configuration.settings.account}.blob.core.windows.net`,
      clientSecretCredential,
      { proxyOptions: undefined }
    );
    expect(getContainerClientMock).toHaveBeenCalledWith(configuration.settings.container);
    expect(getBlockBlobClientMock).toHaveBeenCalledWith('example.file');
    expect(uploadMock).toHaveBeenCalledWith('content', 666);
  });

  it('should properly handle files on Azure Data Lake Storage using Azure Active Directory authentication', async () => {
    const filePath = '/path/to/file/example-123.file';
    (fs.stat as jest.Mock).mockImplementationOnce(() => Promise.resolve({ size: 666 }));
    (fs.readFile as jest.Mock).mockImplementationOnce(() => Promise.resolve(''));
    const clientSecretCredential = jest.fn();
    (ClientSecretCredential as jest.Mock).mockImplementationOnce(() => clientSecretCredential);
    configuration.settings.useADLS = true;
    configuration.settings.authentication = 'aad';
    configuration.settings.tenantId = 'tenantId';
    configuration.settings.clientId = 'clientId';
    configuration.settings.clientSecret = 'clientSecret';
    north = new NorthAzureBlob(configuration, logger, 'cacheFolder', cacheService);
    await north.start();
    await north.handleContent({
      contentFile: filePath,
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'any'
    });
    expect(fs.stat).toHaveBeenCalledWith(filePath);
    expect(fs.readFile).toHaveBeenCalledWith(filePath);
    expect(ClientSecretCredential).toHaveBeenCalled();
    expect(DataLakeServiceClient).toHaveBeenCalledWith(
      `https://${configuration.settings.account}.dfs.core.windows.net`,
      clientSecretCredential,
      { proxyOptions: undefined }
    );
    expect(getFileSystemClientMock).toHaveBeenCalledWith(configuration.settings.container);
    expect(getFileClientMock).toHaveBeenCalledWith('example.file');
    expect(bufferFlushMock).not.toHaveBeenCalled();
  });

  it('should properly handle files using external auth', async () => {
    const filePath = '/path/to/file/example-123.file';
    (fs.stat as jest.Mock).mockImplementationOnce(() => Promise.resolve({ size: 666 }));
    (fs.readFile as jest.Mock).mockImplementationOnce(() => Promise.resolve('content'));
    const defaultAzureCredential = jest.fn();
    (DefaultAzureCredential as jest.Mock).mockImplementationOnce(() => defaultAzureCredential);

    configuration.settings.authentication = 'external';
    configuration.settings.path = 'my path';

    north = new NorthAzureBlob(configuration, logger, 'cacheFolder', cacheService);

    await north.start();
    await north.handleContent({
      contentFile: filePath,
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'any'
    });

    expect(fs.stat).toHaveBeenCalledWith(filePath);
    expect(fs.readFile).toHaveBeenCalledWith(filePath);
    expect(DefaultAzureCredential).toHaveBeenCalled();
    expect(BlobServiceClient).toHaveBeenCalledWith(
      `https://${configuration.settings.account}.blob.core.windows.net`,
      defaultAzureCredential,
      { proxyOptions: undefined }
    );
    expect(getContainerClientMock).toHaveBeenCalledWith(configuration.settings.container);
    expect(getBlockBlobClientMock).toHaveBeenCalledWith('my path/example.file');
    expect(uploadMock).toHaveBeenCalledWith('content', 666);
  });

  it('should properly handle files on Azure Data Lake Storage using external auth', async () => {
    const filePath = '/path/to/file/example-123.file';
    (fs.stat as jest.Mock).mockImplementationOnce(() => Promise.resolve({ size: 666 }));
    (fs.readFile as jest.Mock).mockImplementationOnce(() => Promise.resolve('content'));
    const defaultAzureCredential = jest.fn();
    (DefaultAzureCredential as jest.Mock).mockImplementationOnce(() => defaultAzureCredential);
    configuration.settings.authentication = 'external';
    configuration.settings.path = 'my path';
    configuration.settings.useADLS = true;
    north = new NorthAzureBlob(configuration, logger, 'cacheFolder', cacheService);
    await north.start();
    await north.handleContent({
      contentFile: filePath,
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'any'
    });
    expect(fs.stat).toHaveBeenCalledWith(filePath);
    expect(fs.readFile).toHaveBeenCalledWith(filePath);
    expect(DefaultAzureCredential).toHaveBeenCalled();
    expect(DataLakeServiceClient).toHaveBeenCalledWith(
      `https://${configuration.settings.account}.dfs.core.windows.net`,
      defaultAzureCredential,
      { proxyOptions: undefined }
    );
    expect(getFileSystemClientMock).toHaveBeenCalledWith(configuration.settings.container);
    expect(getFileClientMock).toHaveBeenCalledWith('my path/example.file');
    expect(bufferFlushMock).toHaveBeenCalledWith('content'.length);
  });

  it('should successfully test', async () => {
    const defaultAzureCredential = jest.fn();
    (DefaultAzureCredential as jest.Mock).mockImplementationOnce(() => defaultAzureCredential);
    existsMock.mockImplementationOnce(() => true).mockImplementationOnce(() => false);
    configuration.settings.authentication = 'external';
    configuration.settings.path = 'my path';
    north = new NorthAzureBlob(configuration, logger, 'cacheFolder', cacheService);
    await north.testConnection();
    expect(DefaultAzureCredential).toHaveBeenCalled();
    expect(BlobServiceClient).toHaveBeenCalledWith(
      `https://${configuration.settings.account}.blob.core.windows.net`,
      defaultAzureCredential,
      { proxyOptions: undefined }
    );
    expect(getContainerClientMock).toHaveBeenCalledWith(configuration.settings.container);
    await expect(north.testConnection()).rejects.toThrow(
      new Error(`Container ${configuration.settings.container} and path my path/oibus-azure-test.txt does not exist`)
    );
  });

  it('should successfully test but not delete', async () => {
    const defaultAzureCredential = jest.fn();
    (DefaultAzureCredential as jest.Mock).mockImplementationOnce(() => defaultAzureCredential);
    existsMock.mockImplementationOnce(() => true);
    deleteMock.mockImplementationOnce(() => {
      throw new Error('delete error');
    });
    configuration.settings.authentication = 'external';
    configuration.settings.path = 'my path';
    north = new NorthAzureBlob(configuration, logger, 'cacheFolder', cacheService);
    await north.testConnection();
    expect(DefaultAzureCredential).toHaveBeenCalled();
    expect(BlobServiceClient).toHaveBeenCalledWith(
      `https://${configuration.settings.account}.blob.core.windows.net`,
      defaultAzureCredential,
      { proxyOptions: undefined }
    );
    expect(getContainerClientMock).toHaveBeenCalledWith(configuration.settings.container);
    expect(logger.error).toHaveBeenCalledWith(`Could not delete file "my path/oibus-azure-test.txt"`);
  });
  it('should successfully test but not delete on Azure Data Lake Storage', async () => {
    const defaultAzureCredential = jest.fn();
    (DefaultAzureCredential as jest.Mock).mockImplementationOnce(() => defaultAzureCredential);
    existsMock.mockImplementationOnce(() => true);
    deleteMock.mockImplementationOnce(() => {
      throw new Error('delete error');
    });
    configuration.settings.authentication = 'external';
    configuration.settings.path = 'my path';
    configuration.settings.useADLS = true;
    north = new NorthAzureBlob(configuration, logger, 'cacheFolder', cacheService);
    await north.testConnection();
    expect(DefaultAzureCredential).toHaveBeenCalled();
    expect(DataLakeServiceClient).toHaveBeenCalledWith(
      `https://${configuration.settings.account}.dfs.core.windows.net`,
      defaultAzureCredential,
      { proxyOptions: undefined }
    );
    expect(getFileSystemClientMock).toHaveBeenCalledWith(configuration.settings.container);
    expect(logger.error).toHaveBeenCalledWith(`Could not delete file "my path/oibus-azure-test.txt"`);
  });
  it('should successfully test on Azure Data Lake Storage', async () => {
    const defaultAzureCredential = jest.fn();
    (DefaultAzureCredential as jest.Mock).mockImplementationOnce(() => defaultAzureCredential);
    existsMock.mockImplementationOnce(() => true).mockImplementationOnce(() => false);
    configuration.settings.authentication = 'external';
    configuration.settings.path = 'my path';
    configuration.settings.useADLS = true;
    north = new NorthAzureBlob(configuration, logger, 'cacheFolder', cacheService);
    await north.testConnection();
    expect(DefaultAzureCredential).toHaveBeenCalled();
    expect(DataLakeServiceClient).toHaveBeenCalledWith(
      `https://${configuration.settings.account}.dfs.core.windows.net`,
      defaultAzureCredential,
      { proxyOptions: undefined }
    );
    expect(getFileSystemClientMock).toHaveBeenCalledWith(configuration.settings.container);
    await expect(north.testConnection()).rejects.toThrow(
      new Error(`Container ${configuration.settings.container} and path my path/oibus-azure-test.txt does not exist`)
    );
  });
  it('should successfully test on root', async () => {
    const defaultAzureCredential = jest.fn();
    (DefaultAzureCredential as jest.Mock).mockImplementationOnce(() => defaultAzureCredential);
    existsMock.mockImplementationOnce(() => true);
    configuration.settings.path = '';
    configuration.settings.authentication = 'external';
    north = new NorthAzureBlob(configuration, logger, 'cacheFolder', cacheService);
    await north.testConnection();
    expect(DefaultAzureCredential).toHaveBeenCalled();
    expect(BlobServiceClient).toHaveBeenCalledWith(
      `https://${configuration.settings.account}.blob.core.windows.net`,
      defaultAzureCredential,
      { proxyOptions: undefined }
    );
    expect(getContainerClientMock).toHaveBeenCalledWith(configuration.settings.container);
  });

  it('should manage test error', async () => {
    const defaultAzureCredential = jest.fn();
    (DefaultAzureCredential as jest.Mock).mockImplementationOnce(() => defaultAzureCredential);
    (getContainerClientMock as jest.Mock).mockImplementationOnce(() => {
      throw new Error('connection error');
    });
    north = new NorthAzureBlob(configuration, logger, 'cacheFolder', cacheService);

    await expect(north.testConnection()).rejects.toThrow(
      new Error('Connection could not establish. Check path and authentication. Error: connection error')
    );
    expect(getContainerClientMock).toHaveBeenCalledWith(configuration.settings.container);
    expect(logger.error).toHaveBeenCalledWith('Connection could not establish. Check path and authentication. Error: connection error');
  });

  it('should manage bad authentication type', async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    configuration.settings.authentication = 'bad';
    north = new NorthAzureBlob(configuration, logger, 'cacheFolder', cacheService);

    await expect(north.start()).rejects.toThrow(
      new Error(`Authentication "${configuration.settings.authentication}" not supported for North "${configuration.name}"`)
    );
  });
});

describe('NorthAzureBlob with proxy', () => {
  beforeEach(async () => {
    jest.clearAllMocks();

    configuration = JSON.parse(JSON.stringify(testData.north.list[0]));
    configuration.settings = {
      useCustomUrl: true,
      customUrl: 'https://custom.url.blob.core.windows.net',
      useADLS: false,
      container: 'container',
      path: '',
      authentication: 'sas-token',
      sasToken: 'sas',
      accessKey: '',
      tenantId: '',
      clientId: '',
      clientSecret: '',
      useProxy: true,
      proxyUrl: 'http://localhost:3128',
      proxyUsername: 'oibus',
      proxyPassword: 'pass'
    };
    (createTransformer as jest.Mock).mockImplementation(() => oiBusTransformer);
    (getFilenameWithoutRandomId as jest.Mock).mockReturnValue('example.file');
  });

  afterEach(() => {
    cacheService.cacheSizeEventEmitter.removeAllListeners();
  });

  it('should properly handle files via proxy using Shared Access Signature authentication', async () => {
    const filePath = '/path/to/file/example-123.file';
    (fs.stat as jest.Mock).mockImplementationOnce(() => Promise.resolve({ size: 666 }));
    (fs.readFile as jest.Mock).mockImplementationOnce(() => Promise.resolve('content'));

    configuration.settings.authentication = 'sas-token';
    configuration.settings.sasToken = 'sas token';
    north = new NorthAzureBlob(configuration, logger, 'cacheFolder', cacheService);

    await north.start();
    await north.handleContent({
      contentFile: filePath,
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'any'
    });

    expect(fs.stat).toHaveBeenCalledWith(filePath);
    expect(fs.readFile).toHaveBeenCalledWith(filePath);
    expect(BlobServiceClient).toHaveBeenCalledWith(`${configuration.settings.customUrl}?${configuration.settings.sasToken}`, undefined, {
      proxyOptions: {
        host: 'http://localhost',
        password: 'pass',
        port: 3128,
        username: 'oibus'
      }
    });
    expect(getContainerClientMock).toHaveBeenCalledWith(configuration.settings.container);
    expect(getBlockBlobClientMock).toHaveBeenCalledWith('example.file');
    expect(uploadMock).toHaveBeenCalledWith('content', 666);
  });

  it('should properly handle files with Azure Data Lake Storage via proxy using Shared Access Signature authentication', async () => {
    const filePath = '/path/to/file/example-123.file';
    (fs.stat as jest.Mock).mockImplementationOnce(() => Promise.resolve({ size: 666 }));
    (fs.readFile as jest.Mock).mockImplementationOnce(() => Promise.resolve('content'));
    configuration.settings.authentication = 'sas-token';
    configuration.settings.sasToken = 'sas token';
    configuration.settings.useADLS = true;
    north = new NorthAzureBlob(configuration, logger, 'cacheFolder', cacheService);
    await north.start();
    await north.handleContent({
      contentFile: filePath,
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'any'
    });
    expect(fs.stat).toHaveBeenCalledWith(filePath);
    expect(fs.readFile).toHaveBeenCalledWith(filePath);
    expect(DataLakeServiceClient).toHaveBeenCalledWith(
      `${configuration.settings.customUrl}?${configuration.settings.sasToken}`,
      undefined,
      {
        proxyOptions: {
          host: 'http://localhost',
          password: 'pass',
          port: 3128,
          username: 'oibus'
        }
      }
    );
    expect(getFileSystemClientMock).toHaveBeenCalledWith(configuration.settings.container);
    expect(getFileClientMock).toHaveBeenCalledWith('example.file');
    expect(bufferFlushMock).toHaveBeenCalledWith('content'.length);
  });
  it('should properly handle files via proxy with blank credentials using Shared Access Signature authentication', async () => {
    const filePath = '/path/to/file/example-123.file';
    (fs.stat as jest.Mock).mockImplementationOnce(() => Promise.resolve({ size: 666 }));
    (fs.readFile as jest.Mock).mockImplementationOnce(() => Promise.resolve('content'));

    configuration.settings.proxyUsername = '';
    configuration.settings.proxyPassword = '';
    configuration.settings.proxyUrl = 'https://proxy.com';
    north = new NorthAzureBlob(configuration, logger, 'cacheFolder', cacheService);

    await north.start();
    await north.handleContent({
      contentFile: filePath,
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'any'
    });

    expect(fs.stat).toHaveBeenCalledWith(filePath);
    expect(fs.readFile).toHaveBeenCalledWith(filePath);
    expect(BlobServiceClient).toHaveBeenCalledWith(`${configuration.settings.customUrl}?${configuration.settings.sasToken}`, undefined, {
      proxyOptions: {
        host: 'https://proxy.com',
        port: 443
      }
    });
    expect(getContainerClientMock).toHaveBeenCalledWith(configuration.settings.container);
    expect(getBlockBlobClientMock).toHaveBeenCalledWith('example.file');
    expect(uploadMock).toHaveBeenCalledWith('content', 666);
  });

  it('should properly handle files with Azure Data Lake Storage via proxy with blank credentials using Shared Access Signature authentication', async () => {
    const filePath = '/path/to/file/example-123.file';
    (fs.stat as jest.Mock).mockImplementationOnce(() => Promise.resolve({ size: 666 }));
    (fs.readFile as jest.Mock).mockImplementationOnce(() => Promise.resolve('content'));
    configuration.settings.proxyUsername = '';
    configuration.settings.proxyPassword = '';
    configuration.settings.proxyUrl = 'https://proxy.com';
    configuration.settings.useADLS = true;
    north = new NorthAzureBlob(configuration, logger, 'cacheFolder', cacheService);
    await north.start();
    await north.handleContent({
      contentFile: filePath,
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'any'
    });
    expect(fs.stat).toHaveBeenCalledWith(filePath);
    expect(fs.readFile).toHaveBeenCalledWith(filePath);
    expect(DataLakeServiceClient).toHaveBeenCalledWith(
      `${configuration.settings.customUrl}?${configuration.settings.sasToken}`,
      undefined,
      {
        proxyOptions: {
          host: 'https://proxy.com',
          port: 443
        }
      }
    );
    expect(getFileSystemClientMock).toHaveBeenCalledWith(configuration.settings.container);
    expect(getFileClientMock).toHaveBeenCalledWith('example.file');
    expect(bufferFlushMock).toHaveBeenCalledWith('content'.length);
  });

  it('should properly parse proxy url', async () => {
    north = new NorthAzureBlob(configuration, logger, 'cacheFolder', cacheService);

    const proxy1 = north.parseProxyUrl('127.0.0.1');
    expect(proxy1.proxyHost).toBe('127.0.0.1');
    expect(proxy1.proxyPort).toBe(80);

    const proxy2 = north.parseProxyUrl('http://127.0.0.1');
    expect(proxy2.proxyHost).toBe('http://127.0.0.1');
    expect(proxy2.proxyPort).toBe(80);

    const proxy3 = north.parseProxyUrl('127.0.0.1:3128');
    expect(proxy3.proxyHost).toBe('http://127.0.0.1');
    expect(proxy3.proxyPort).toBe(3128);

    expect(() => north.parseProxyUrl('http://127.0.0.1:3128:3128')).toThrow('Bad proxy url http://127.0.0.1:3128:3128');
  });

  it('should ignore data if bad content type', async () => {
    await expect(
      north.handleContent({
        contentFile: 'path/to/file/example-123456789.file',
        contentSize: 1234,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'time-values'
      })
    ).rejects.toThrow(`Unsupported data type: time-values (file path/to/file/example-123456789.file)`);
  });
});
