import NorthSftp from './north-sftp';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/logger.mock';
import EncryptionService from '../../service/encryption.service';
import EncryptionServiceMock from '../../tests/__mocks__/encryption-service.mock';
import RepositoryService from '../../service/repository.service';
import RepositoryServiceMock from '../../tests/__mocks__/repository-service.mock';
import { NorthConnectorDTO } from '../../../../shared/model/north-connector.model';
import ValueCacheServiceMock from '../../tests/__mocks__/value-cache-service.mock';
import FileCacheServiceMock from '../../tests/__mocks__/file-cache-service.mock';
import ArchiveServiceMock from '../../tests/__mocks__/archive-service.mock';
import csv from 'papaparse';
import { NorthSFTPSettings } from '../../../../shared/model/north-settings.model';
import sftpClient from 'ssh2-sftp-client';
import { OIBusDataValue } from '../../../../shared/model/engine.model';

jest.mock('node:fs/promises');

const logger: pino.Logger = new PinoLogger();
const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const repositoryService: RepositoryService = new RepositoryServiceMock();

jest.mock(
  '../../service/cache/archive.service',
  () =>
    function () {
      return new ArchiveServiceMock();
    }
);
jest.mock(
  '../../service/cache/value-cache.service',
  () =>
    function () {
      return new ValueCacheServiceMock();
    }
);
jest.mock(
  '../../service/cache/file-cache.service',
  () =>
    function () {
      return new FileCacheServiceMock();
    }
);
const resetMetrics = jest.fn();
jest.mock(
  '../../service/north-connector-metrics.service',
  () =>
    function () {
      return {
        initMetrics: jest.fn(),
        updateMetrics: jest.fn(),
        get stream() {
          return { stream: 'myStream' };
        },
        resetMetrics,
        metrics: {
          numberOfValuesSent: 1,
          numberOfFilesSent: 1
        }
      };
    }
);
jest.mock('../../service/utils');
jest.mock('papaparse');

const mockSftpClient = {
  connect: jest.fn(),
  list: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  end: jest.fn(),
  exists: jest.fn()
};
jest.mock('ssh2-sftp-client');

const nowDateString = '2020-02-02T02:02:02.222Z';

let north: NorthSftp;

describe('NorthSFTP', () => {
  const configuration: NorthConnectorDTO<NorthSFTPSettings> = {
    id: 'id',
    name: 'north',
    type: 'test',
    description: 'my test connector',
    enabled: true,
    settings: {
      host: '127.0.0.1',
      port: 2222,
      remoteFolder: 'remoteFolder',
      authentication: 'password',
      username: 'user',
      password: 'pass',
      prefix: '',
      suffix: ''
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
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));
    repositoryService.northConnectorRepository.getNorthConnector = jest.fn().mockReturnValue(configuration);
    (sftpClient as jest.Mock).mockImplementation(() => mockSftpClient);

    (csv.unparse as jest.Mock).mockReturnValue('csv content');

    north = new NorthSftp(configuration, encryptionService, repositoryService, logger, 'baseFolder');
    await north.start();
  });

  it('should properly handle values', async () => {
    const values: Array<OIBusDataValue> = [
      {
        timestamp: '2021-07-29T12:13:31.883Z',
        data: { value: '666', quality: 'good' },
        pointId: 'pointId'
      }
    ];
    north.sendToSftpServer = jest.fn();
    csv.unparse = jest.fn().mockReturnValue('csv content');

    await north.handleValues(values);

    const expectedFileName = `${configuration.settings.prefix}${new Date().getTime()}${configuration.settings.suffix}.csv`;
    expect(north.sendToSftpServer).toHaveBeenCalledWith(
      Buffer.from('csv content', 'utf8'),
      `${configuration.settings.remoteFolder}/${expectedFileName}`
    );
  });

  it('should properly catch handle values error', async () => {
    const values: Array<OIBusDataValue> = [
      {
        timestamp: '2021-07-29T12:13:31.883Z',
        data: { value: '666', quality: 'good' },
        pointId: 'pointId'
      }
    ];
    north.sendToSftpServer = jest.fn().mockImplementationOnce(() => {
      throw new Error('Error handling values');
    });
    await expect(north.handleValues(values)).rejects.toThrow('Error handling values');
  });

  it('should properly handle files', async () => {
    north.sendToSftpServer = jest.fn();
    const filePath = '/path/to/file/example-123456.file';
    const expectedFileName = `${configuration.settings.prefix}example${configuration.settings.suffix}.file`;
    await north.handleFile(filePath);
    expect(north.sendToSftpServer).toHaveBeenCalledWith(filePath, `${configuration.settings.remoteFolder}/${expectedFileName}`);
  });

  it('should properly catch handle file error', async () => {
    north.sendToSftpServer = jest.fn().mockImplementationOnce(() => {
      throw new Error('Error handling files');
    });
    const filePath = '/path/to/file/example-123456.file';
    await expect(north.handleFile(filePath)).rejects.toThrow('Error handling files');
  });

  it('should send content into SFTP server', async () => {
    await north.sendToSftpServer('myFile.csv', 'remoteFolder/target');
    expect(mockSftpClient.connect).toHaveBeenCalledTimes(1);
    expect(mockSftpClient.put).toHaveBeenCalledTimes(1);
    expect(mockSftpClient.end).toHaveBeenCalledTimes(1);
    expect(encryptionService.decryptText).toHaveBeenCalledTimes(1);
  });

  it('should send content into SFTP server without user and password', async () => {
    configuration.settings.username = null;
    configuration.settings.password = null;
    await north.sendToSftpServer('myFile.csv', 'remoteFolder/target');
    expect(mockSftpClient.connect).toHaveBeenCalledTimes(1);
    expect(mockSftpClient.put).toHaveBeenCalledTimes(1);
    expect(mockSftpClient.end).toHaveBeenCalledTimes(1);
    expect(encryptionService.decryptText).not.toHaveBeenCalled();
  });
});

describe('NorthSFTP without suffix or prefix', () => {
  const configuration: NorthConnectorDTO<NorthSFTPSettings> = {
    id: 'id',
    name: 'north',
    type: 'test',
    description: 'my test connector',
    enabled: true,
    settings: {
      host: '127.0.0.1',
      port: 2222,
      remoteFolder: 'remoteFolder',
      authentication: 'private-key',
      username: 'user',
      privateKey: 'myPrivateKey',
      passphrase: 'myPassphrase',
      prefix: '',
      suffix: ''
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

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));
    repositoryService.northConnectorRepository.getNorthConnector = jest.fn().mockReturnValue(configuration);
    (sftpClient as jest.Mock).mockImplementation(() => mockSftpClient);

    north = new NorthSftp(configuration, encryptionService, repositoryService, logger, 'baseFolder');
  });

  it('should properly handle values', async () => {
    const values: Array<OIBusDataValue> = [
      {
        timestamp: '2021-07-29T12:13:31.883Z',
        data: { value: '666', quality: 'good' },
        pointId: 'pointId'
      }
    ];

    north.sendToSftpServer = jest.fn();
    csv.unparse = jest.fn().mockReturnValue('csv content');

    await north.handleValues(values);

    const expectedFileName = `${new Date().getTime()}.csv`;
    expect(north.sendToSftpServer).toHaveBeenCalledWith(
      Buffer.from('csv content', 'utf8'),
      `${configuration.settings.remoteFolder}/${expectedFileName}`
    );

    await north.handleValues(values);
    expect(north.sendToSftpServer).toHaveBeenCalledWith(
      Buffer.from('csv content', 'utf8'),
      `${configuration.settings.remoteFolder}/${new Date().getTime()}.csv`
    );
  });

  it('should properly handle files', async () => {
    north.sendToSftpServer = jest.fn();
    const filePath = '/path/to/file/example-123456.file';
    await north.handleFile(filePath);
    expect(north.sendToSftpServer).toHaveBeenCalledWith(filePath, `${configuration.settings.remoteFolder}/example.file`);
  });

  it('should have access to output folder', async () => {
    mockSftpClient.exists = jest.fn().mockReturnValueOnce('d');
    await expect(north.testConnection()).resolves.not.toThrow();
    expect(mockSftpClient.connect).toHaveBeenCalledTimes(1);
    expect(mockSftpClient.exists).toHaveBeenCalledTimes(1);
    expect(mockSftpClient.end).toHaveBeenCalledTimes(1);
  });

  it('should throw an error if no access', async () => {
    mockSftpClient.exists = jest.fn().mockReturnValueOnce(false);
    await expect(north.testConnection()).rejects.toThrow(
      new Error(`Remote target "${configuration.settings.remoteFolder}" does not exist or the user does not have the right permissions`)
    );
    expect(mockSftpClient.connect).toHaveBeenCalledTimes(1);
    expect(mockSftpClient.exists).toHaveBeenCalledTimes(1);
    expect(mockSftpClient.end).toHaveBeenCalledTimes(1);
  });

  it('should throw an error if it is a file', async () => {
    mockSftpClient.exists = jest.fn().mockReturnValueOnce('-');
    await expect(north.testConnection()).rejects.toThrow(
      new Error(`Remote target "${configuration.settings.remoteFolder}" is not a folder`)
    );
    expect(mockSftpClient.connect).toHaveBeenCalledTimes(1);
    expect(mockSftpClient.exists).toHaveBeenCalledTimes(1);
    expect(mockSftpClient.end).toHaveBeenCalledTimes(1);
    expect(encryptionService.decryptText).toHaveBeenCalledTimes(1);
  });

  it('should handle SFTP error', async () => {
    configuration.settings.username = '';
    configuration.settings.passphrase = '';
    mockSftpClient.exists = jest.fn().mockImplementationOnce(() => {
      throw new Error('sftp error');
    });
    await expect(north.testConnection()).rejects.toThrow(
      new Error(
        `Access error on "${configuration.settings.remoteFolder}" on "${configuration.settings.host}:${configuration.settings.port}": sftp error`
      )
    );
    expect(mockSftpClient.connect).toHaveBeenCalledTimes(1);
    expect(mockSftpClient.exists).toHaveBeenCalledTimes(1);
    expect(mockSftpClient.end).not.toHaveBeenCalled();
    expect(encryptionService.decryptText).not.toHaveBeenCalled();
  });
});
