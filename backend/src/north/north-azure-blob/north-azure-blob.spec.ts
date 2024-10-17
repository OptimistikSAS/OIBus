import fs from 'node:fs/promises';

import NorthAzureBlob from './north-azure-blob';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import EncryptionService from '../../service/encryption.service';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import { ClientSecretCredential, DefaultAzureCredential } from '@azure/identity';
import ValueCacheServiceMock from '../../tests/__mocks__/service/cache/value-cache-service.mock';
import FileCacheServiceMock from '../../tests/__mocks__/service/cache/file-cache-service.mock';
import { NorthAzureBlobSettings } from '../../../../shared/model/north-settings.model';
import ArchiveServiceMock from '../../tests/__mocks__/service/cache/archive-service.mock';
import csv from 'papaparse';
import NorthConnectorRepository from '../../repository/config/north-connector.repository';
import NorthConnectorRepositoryMock from '../../tests/__mocks__/repository/config/north-connector-repository.mock';
import ScanModeRepository from '../../repository/config/scan-mode.repository';
import ScanModeRepositoryMock from '../../tests/__mocks__/repository/config/scan-mode-repository.mock';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import testData from '../../tests/utils/test-data';

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
jest.mock('@azure/identity', () => ({
  DefaultAzureCredential: jest.fn(),
  ClientSecretCredential: jest.fn()
}));
jest.mock('papaparse');
jest.mock('node:fs/promises');
jest.mock('../../service/utils');

const logger: pino.Logger = new PinoLogger();
const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const northConnectorRepository: NorthConnectorRepository = new NorthConnectorRepositoryMock();
const scanModeRepository: ScanModeRepository = new ScanModeRepositoryMock();
const valueCacheService = new ValueCacheServiceMock();
const fileCacheService = new FileCacheServiceMock();
const archiveService = new ArchiveServiceMock();

jest.mock(
  '../../service/cache/value-cache.service',
  () =>
    function () {
      return valueCacheService;
    }
);
jest.mock(
  '../../service/cache/file-cache.service',
  () =>
    function () {
      return fileCacheService;
    }
);
jest.mock(
  '../../service/cache/archive.service',
  () =>
    function () {
      return archiveService;
    }
);

let configuration: NorthConnectorEntity<NorthAzureBlobSettings>;
let north: NorthAzureBlob;
describe('NorthAzureBlob without proxy', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    (csv.unparse as jest.Mock).mockReturnValue('csv content');
    configuration = JSON.parse(JSON.stringify(testData.north.list[0]));
    configuration.settings = {
      useCustomUrl: false,
      account: 'account',
      container: 'container',
      path: '',
      authentication: 'sasToken',
      sasToken: 'sas',
      accessKey: '',
      tenantId: '',
      clientId: '',
      clientSecret: '',
      useProxy: false
    };
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValue(configuration);
    (scanModeRepository.findById as jest.Mock).mockImplementation(id => testData.scanMode.list.find(element => element.id === id));
  });

  it('should properly handle files with Shared Access Signature authentication', async () => {
    const filePath = '/path/to/file/example-123.file';
    (fs.stat as jest.Mock).mockImplementationOnce(() => Promise.resolve({ size: 666 }));
    (fs.readFile as jest.Mock).mockImplementationOnce(() => Promise.resolve('content'));

    configuration.settings.authentication = 'sasToken';
    configuration.settings.sasToken = 'sas token';
    north = new NorthAzureBlob(configuration, encryptionService, northConnectorRepository, scanModeRepository, logger, 'baseFolder');

    await north.start();
    await north.handleContent({ type: 'raw', filePath });

    expect(fs.stat).toHaveBeenCalledWith(filePath);
    expect(fs.readFile).toHaveBeenCalledWith(filePath);
    expect(BlobServiceClient).toHaveBeenCalledWith(
      `https://${configuration.settings.account}.blob.core.windows.net?${configuration.settings.sasToken}`,
      undefined,
      { proxyOptions: undefined }
    );
    expect(getContainerClientMock).toHaveBeenCalledWith(configuration.settings.container);
    expect(getBlockBlobClientMock).toHaveBeenCalledWith('example.file');
    expect(uploadMock).toHaveBeenCalledWith('content', 666);

    await expect(north.handleContent({ type: 'time-values', content: [] })).rejects.toThrow(new Error(`Can not manage time values`));
  });

  it('should properly handle values with Shared Access Signature authentication', async () => {
    north = new NorthAzureBlob(configuration, encryptionService, northConnectorRepository, scanModeRepository, logger, 'baseFolder');

    await north.start();
    await north.handleValues([{ pointId: 'pointId', timestamp: '2020-02-02T02:02:02.222Z', data: { value: '123' } }]);

    expect(BlobServiceClient).toHaveBeenCalledWith(
      `https://${configuration.settings.account}.blob.core.windows.net?${configuration.settings.sasToken}`,
      undefined,
      { proxyOptions: undefined }
    );
    expect(getContainerClientMock).toHaveBeenCalledWith(configuration.settings.container);
    expect(getBlockBlobClientMock).toHaveBeenCalledWith(`${configuration.name}-2021_01_02_00_00_00_000.csv`);
    expect(uploadMock).toHaveBeenCalledWith('csv content', 11);
  });

  it('should properly handle files with Access Key authentication', async () => {
    const filePath = '/path/to/file/example-123.file';
    (fs.stat as jest.Mock).mockImplementationOnce(() => Promise.resolve({ size: 666 }));
    (fs.readFile as jest.Mock).mockImplementationOnce(() => Promise.resolve('content'));
    const sharedKeyCredential = jest.fn();
    (StorageSharedKeyCredential as jest.Mock).mockImplementationOnce(() => sharedKeyCredential);

    configuration.settings.authentication = 'accessKey';
    configuration.settings.accessKey = 'access key';
    north = new NorthAzureBlob(configuration, encryptionService, northConnectorRepository, scanModeRepository, logger, 'baseFolder');

    await north.start();
    await north.handleFile(filePath);

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

  it('should properly handle files with Azure Active Directory authentication', async () => {
    const filePath = '/path/to/file/example-123.file';
    (fs.stat as jest.Mock).mockImplementationOnce(() => Promise.resolve({ size: 666 }));
    (fs.readFile as jest.Mock).mockImplementationOnce(() => Promise.resolve('content'));
    const clientSecretCredential = jest.fn();
    (ClientSecretCredential as jest.Mock).mockImplementationOnce(() => clientSecretCredential);

    configuration.settings.authentication = 'aad';
    configuration.settings.tenantId = 'tenantId';
    configuration.settings.clientId = 'clientId';
    configuration.settings.clientSecret = 'clientSecret';
    north = new NorthAzureBlob(configuration, encryptionService, northConnectorRepository, scanModeRepository, logger, 'baseFolder');

    await north.start();
    await north.handleFile(filePath);

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

  it('should properly handle files with external auth', async () => {
    const filePath = '/path/to/file/example-123.file';
    (fs.stat as jest.Mock).mockImplementationOnce(() => Promise.resolve({ size: 666 }));
    (fs.readFile as jest.Mock).mockImplementationOnce(() => Promise.resolve('content'));
    const defaultAzureCredential = jest.fn();
    (DefaultAzureCredential as jest.Mock).mockImplementationOnce(() => defaultAzureCredential);

    configuration.settings.authentication = 'external';
    configuration.settings.path = 'my path';

    north = new NorthAzureBlob(configuration, encryptionService, northConnectorRepository, scanModeRepository, logger, 'baseFolder');

    await north.start();
    await north.handleFile(filePath);

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

  it('should properly handle values with external auth', async () => {
    const defaultAzureCredential = jest.fn();
    (DefaultAzureCredential as jest.Mock).mockImplementationOnce(() => defaultAzureCredential);

    configuration.settings.authentication = 'external';
    configuration.settings.path = 'my path';

    north = new NorthAzureBlob(configuration, encryptionService, northConnectorRepository, scanModeRepository, logger, 'baseFolder');
    await north.start();
    await north.handleValues([{ pointId: 'pointId', timestamp: '2020-02-02T02:02:02.222Z', data: { value: '123' } }]);

    expect(BlobServiceClient).toHaveBeenCalledWith(
      `https://${configuration.settings.account}.blob.core.windows.net`,
      defaultAzureCredential,
      { proxyOptions: undefined }
    );
    expect(getContainerClientMock).toHaveBeenCalledWith(configuration.settings.container);
    expect(getBlockBlobClientMock).toHaveBeenCalledWith(`my path/${configuration.name}-2021_01_02_00_00_00_000.csv`);
    expect(uploadMock).toHaveBeenCalledWith('csv content', 11);
  });

  it('should successfully test', async () => {
    const defaultAzureCredential = jest.fn();
    (DefaultAzureCredential as jest.Mock).mockImplementationOnce(() => defaultAzureCredential);
    existsMock.mockImplementationOnce(() => true).mockImplementationOnce(() => false);
    configuration.settings.authentication = 'external';
    configuration.settings.path = 'my path';
    north = new NorthAzureBlob(configuration, encryptionService, northConnectorRepository, scanModeRepository, logger, 'baseFolder');
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
    north = new NorthAzureBlob(configuration, encryptionService, northConnectorRepository, scanModeRepository, logger, 'baseFolder');
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

  it('should successfully test on root', async () => {
    const defaultAzureCredential = jest.fn();
    (DefaultAzureCredential as jest.Mock).mockImplementationOnce(() => defaultAzureCredential);
    existsMock.mockImplementationOnce(() => true);
    configuration.settings.path = '';
    configuration.settings.authentication = 'external';
    north = new NorthAzureBlob(configuration, encryptionService, northConnectorRepository, scanModeRepository, logger, 'baseFolder');
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
    north = new NorthAzureBlob(configuration, encryptionService, northConnectorRepository, scanModeRepository, logger, 'baseFolder');

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
    north = new NorthAzureBlob(configuration, encryptionService, northConnectorRepository, scanModeRepository, logger, 'baseFolder');

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
      container: 'container',
      path: '',
      authentication: 'sasToken',
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
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValue(configuration);
    (scanModeRepository.findById as jest.Mock).mockImplementation(id => testData.scanMode.list.find(element => element.id === id));
  });

  it('should properly handle files with proxy auth', async () => {
    const filePath = '/path/to/file/example-123.file';
    (fs.stat as jest.Mock).mockImplementationOnce(() => Promise.resolve({ size: 666 }));
    (fs.readFile as jest.Mock).mockImplementationOnce(() => Promise.resolve('content'));

    configuration.settings.authentication = 'sasToken';
    configuration.settings.sasToken = 'sas token';
    north = new NorthAzureBlob(configuration, encryptionService, northConnectorRepository, scanModeRepository, logger, 'baseFolder');

    await north.start();
    await north.handleFile(filePath);

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

  it('should properly handle files without proxy auth', async () => {
    const filePath = '/path/to/file/example-123.file';
    (fs.stat as jest.Mock).mockImplementationOnce(() => Promise.resolve({ size: 666 }));
    (fs.readFile as jest.Mock).mockImplementationOnce(() => Promise.resolve('content'));

    configuration.settings.proxyUsername = '';
    configuration.settings.proxyPassword = '';
    configuration.settings.proxyUrl = 'https://proxy.com';
    north = new NorthAzureBlob(configuration, encryptionService, northConnectorRepository, scanModeRepository, logger, 'baseFolder');

    await north.start();
    await north.handleFile(filePath);

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

  it('should properly parse proxy url', async () => {
    north = new NorthAzureBlob(configuration, encryptionService, northConnectorRepository, scanModeRepository, logger, 'baseFolder');

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
});
