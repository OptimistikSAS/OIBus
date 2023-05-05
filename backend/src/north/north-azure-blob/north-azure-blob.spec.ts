import fs from 'node:fs/promises';

import NorthAzureBlob from './north-azure-blob';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/logger.mock';
import EncryptionService from '../../service/encryption.service';
import EncryptionServiceMock from '../../tests/__mocks__/encryption-service.mock';
import RepositoryService from '../../service/repository.service';
import RepositoryServiceMock from '../../tests/__mocks__/repository-service.mock';
import ProxyService from '../../service/proxy.service';
import { NorthConnectorDTO } from '../../../../shared/model/north-connector.model';
import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';

const uploadMock = jest.fn().mockReturnValue(Promise.resolve({ requestId: 'requestId' }));
const getBlockBlobClientMock = jest.fn().mockImplementation(() => ({
  upload: uploadMock
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
jest.mock('@azure/identity', () => ({ DefaultAzureCredential: jest.fn() }));
jest.mock('node:fs/promises');
jest.mock(
  '../../service/cache.service',
  () =>
    function () {
      return {
        updateMetrics: jest.fn(),
        metrics: {
          numberOfValues: 1,
          numberOfFiles: 1
        }
      };
    }
);

const logger: pino.Logger = new PinoLogger();
const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const repositoryService: RepositoryService = new RepositoryServiceMock();
const proxyService: ProxyService = new ProxyService(repositoryService.proxyRepository, encryptionService);

const configuration: NorthConnectorDTO = {
  id: 'id',
  name: 'north',
  type: 'test',
  description: 'my test connector',
  enabled: true,
  settings: {
    account: 'account',
    container: 'container'
  },
  caching: {
    scanModeId: 'id1',
    retryInterval: 5000,
    groupCount: 10000,
    maxSendCount: 10000,
    retryCount: 2,
    sendFileImmediately: true,
    maxSize: 1000
  },
  archive: {
    enabled: true,
    retentionDuration: 720
  }
};

describe('NorthAzureBlob', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
  });

  it('should properly handle files with Shared Access Signature authentication', async () => {
    const filePath = '/path/to/file/example.file';
    (fs.stat as jest.Mock).mockImplementationOnce(() => Promise.resolve({ size: 666 }));
    (fs.readFile as jest.Mock).mockImplementationOnce(() => Promise.resolve('content'));

    configuration.settings.authentication = 'sasToken';
    configuration.settings.sasToken = 'sas token';
    const north = new NorthAzureBlob(configuration, encryptionService, proxyService, repositoryService, logger, 'baseFolder');

    await north.handleFile(filePath);

    expect(fs.stat).toHaveBeenCalledWith(filePath);
    expect(fs.readFile).toHaveBeenCalledWith(filePath);
    expect(BlobServiceClient).toHaveBeenCalledWith(
      `https://${configuration.settings.account}.blob.core.windows.net${configuration.settings.sasToken}`
    );
    expect(getContainerClientMock).toHaveBeenCalledWith(configuration.settings.container);
    expect(getBlockBlobClientMock).toHaveBeenCalledWith('example.file');
    expect(uploadMock).toHaveBeenCalledWith('content', 666);
  });

  it('should properly handle files with Access Key authentication', async () => {
    const filePath = '/path/to/file/example.file';
    (fs.stat as jest.Mock).mockImplementationOnce(() => Promise.resolve({ size: 666 }));
    (fs.readFile as jest.Mock).mockImplementationOnce(() => Promise.resolve('content'));
    const sharedKeyCredential = jest.fn();
    (StorageSharedKeyCredential as jest.Mock).mockImplementationOnce(() => sharedKeyCredential);

    configuration.settings.authentication = 'accessKey';
    configuration.settings.accessKey = 'access key';
    const north = new NorthAzureBlob(configuration, encryptionService, proxyService, repositoryService, logger, 'baseFolder');

    await north.handleFile(filePath);

    expect(fs.stat).toHaveBeenCalledWith(filePath);
    expect(fs.readFile).toHaveBeenCalledWith(filePath);
    expect(StorageSharedKeyCredential).toHaveBeenCalledWith(configuration.settings.account, configuration.settings.accessKey);
    expect(BlobServiceClient).toHaveBeenCalledWith(`https://${configuration.settings.account}.blob.core.windows.net`, sharedKeyCredential);
    expect(getContainerClientMock).toHaveBeenCalledWith(configuration.settings.container);
    expect(getBlockBlobClientMock).toHaveBeenCalledWith('example.file');
    expect(uploadMock).toHaveBeenCalledWith('content', 666);
  });

  it('should properly handle files with Azure Active Directory authentication', async () => {
    const filePath = '/path/to/file/example.file';
    (fs.stat as jest.Mock).mockImplementationOnce(() => Promise.resolve({ size: 666 }));
    (fs.readFile as jest.Mock).mockImplementationOnce(() => Promise.resolve('content'));
    const defaultAzureCredential = jest.fn();
    (DefaultAzureCredential as jest.Mock).mockImplementationOnce(() => defaultAzureCredential);

    configuration.settings.authentication = 'aad';
    configuration.settings.tenantId = 'tenantId';
    configuration.settings.clientId = 'clientId';
    configuration.settings.clientSecret = 'clientSecret';
    const north = new NorthAzureBlob(configuration, encryptionService, proxyService, repositoryService, logger, 'baseFolder');

    await north.handleFile(filePath);

    expect(fs.stat).toHaveBeenCalledWith(filePath);
    expect(fs.readFile).toHaveBeenCalledWith(filePath);
    expect(DefaultAzureCredential).toHaveBeenCalled();
    expect(BlobServiceClient).toHaveBeenCalledWith(
      `https://${configuration.settings.account}.blob.core.windows.net`,
      defaultAzureCredential
    );
    expect(getContainerClientMock).toHaveBeenCalledWith(configuration.settings.container);
    expect(getBlockBlobClientMock).toHaveBeenCalledWith('example.file');
    expect(uploadMock).toHaveBeenCalledWith('content', 666);
  });

  it('should throw an error when invalid authentication is provided', async () => {
    const filePath = '/path/to/file/example.file';

    configuration.settings.authentication = 'invalid';
    const north = new NorthAzureBlob(configuration, encryptionService, proxyService, repositoryService, logger, 'baseFolder');

    await expect(north.handleFile(filePath)).rejects.toThrowError(
      new Error(`Authentication "${configuration.settings.authentication}" not supported for South "${configuration.name}"`)
    );
  });
});
