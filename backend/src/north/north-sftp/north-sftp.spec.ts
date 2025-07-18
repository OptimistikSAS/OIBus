import NorthSftp from './north-sftp';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import EncryptionService from '../../service/encryption.service';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import CacheServiceMock from '../../tests/__mocks__/service/cache/cache-service.mock';

import csv from 'papaparse';
import { NorthSFTPSettings } from '../../../shared/model/north-settings.model';
import sftpClient from 'ssh2-sftp-client';
import { OIBusTimeValue } from '../../../shared/model/engine.model';
import NorthConnectorRepository from '../../repository/config/north-connector.repository';
import NorthConnectorRepositoryMock from '../../tests/__mocks__/repository/config/north-connector-repository.mock';
import ScanModeRepository from '../../repository/config/scan-mode.repository';
import ScanModeRepositoryMock from '../../tests/__mocks__/repository/config/scan-mode-repository.mock';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import testData from '../../tests/utils/test-data';
import { mockBaseFolders } from '../../tests/utils/test-utils';
import CacheService from '../../service/cache/cache.service';
import fs from 'node:fs/promises';

jest.mock('node:fs/promises');

const logger: pino.Logger = new PinoLogger();
const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const northConnectorRepository: NorthConnectorRepository = new NorthConnectorRepositoryMock();
const scanModeRepository: ScanModeRepository = new ScanModeRepositoryMock();
const cacheService: CacheService = new CacheServiceMock();

jest.mock(
  '../../service/cache/cache.service',
  () =>
    function () {
      return cacheService;
    }
);

const mockSftpClient = {
  connect: jest.fn(),
  list: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  end: jest.fn(),
  exists: jest.fn()
};
jest.mock('ssh2-sftp-client');
jest.mock('../../service/utils');
jest.mock('papaparse');

const timeValues: Array<OIBusTimeValue> = [
  {
    pointId: 'pointId1',
    timestamp: testData.constants.dates.FAKE_NOW,
    data: { value: '666', quality: 'good' }
  },
  {
    pointId: 'pointId2',
    timestamp: testData.constants.dates.FAKE_NOW,
    data: { value: '777', quality: 'good' }
  }
];

let configuration: NorthConnectorEntity<NorthSFTPSettings>;
let north: NorthSftp;

describe('NorthSFTP', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    configuration = JSON.parse(JSON.stringify(testData.north.list[0]));
    configuration.settings = {
      host: '127.0.0.1',
      port: 2222,
      remoteFolder: 'remoteFolder',
      authentication: 'password',
      username: 'user',
      password: 'pass',
      prefix: '',
      suffix: ''
    };
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValue(configuration);
    (scanModeRepository.findById as jest.Mock).mockImplementation(id => testData.scanMode.list.find(element => element.id === id));

    (sftpClient as jest.Mock).mockImplementation(() => mockSftpClient);
    (csv.unparse as jest.Mock).mockReturnValue('csv content');

    north = new NorthSftp(
      configuration,
      encryptionService,
      northConnectorRepository,
      scanModeRepository,
      logger,
      mockBaseFolders(testData.north.list[0].id)
    );
    await north.start();
  });

  afterEach(() => {
    cacheService.cacheSizeEventEmitter.removeAllListeners();
  });

  it('should properly handle values', async () => {
    north.sendToSftpServer = jest.fn();
    csv.unparse = jest.fn().mockReturnValue('csv content');

    (fs.readFile as jest.Mock).mockReturnValue(JSON.stringify(timeValues));
    await north.handleContent({
      contentFile: '/path/to/file/example-123.json',
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'time-values',
      source: 'south',
      options: {}
    });
    const expectedFileName = `${configuration.settings.prefix}${new Date().getTime()}${configuration.settings.suffix}.csv`;
    expect(north.sendToSftpServer).toHaveBeenCalledWith(
      Buffer.from('csv content', 'utf8'),
      `${configuration.settings.remoteFolder}/${expectedFileName}`
    );
  });

  it('should properly catch handle values error', async () => {
    (fs.readFile as jest.Mock).mockReturnValue(JSON.stringify(timeValues));

    north.sendToSftpServer = jest.fn().mockImplementationOnce(() => {
      throw new Error('Error handling values');
    });
    await expect(
      north.handleContent({
        contentFile: '/path/to/file/example-123.json',
        contentSize: 1234,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'time-values',
        source: 'south',
        options: {}
      })
    ).rejects.toThrow('Error handling values');
  });

  it('should properly handle files', async () => {
    north.sendToSftpServer = jest.fn();
    const expectedFileName = `${configuration.settings.prefix}example${configuration.settings.suffix}.file`;
    await north.handleContent({
      contentFile: 'path/to/file/example-123.file',
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'raw',
      source: 'south',
      options: {}
    });
    expect(north.sendToSftpServer).toHaveBeenCalledWith(
      'path/to/file/example-123.file',
      `${configuration.settings.remoteFolder}/${expectedFileName}`
    );
  });

  it('should properly catch handle file error', async () => {
    north.sendToSftpServer = jest.fn().mockImplementationOnce(() => {
      throw new Error('Error handling files');
    });
    await expect(
      north.handleContent({
        contentFile: 'path/to/file/example-123.file',
        contentSize: 1234,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'raw',
        source: 'south',
        options: {}
      })
    ).rejects.toThrow('Error handling files');
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
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    configuration = JSON.parse(JSON.stringify(testData.north.list[0]));
    configuration.settings = {
      host: '127.0.0.1',
      port: 2222,
      remoteFolder: 'remoteFolder',
      authentication: 'private-key',
      username: 'user',
      privateKey: 'myPrivateKey',
      passphrase: 'myPassphrase',
      prefix: '',
      suffix: ''
    };
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValue(configuration);
    (scanModeRepository.findById as jest.Mock).mockImplementation(id => testData.scanMode.list.find(element => element.id === id));

    (sftpClient as jest.Mock).mockImplementation(() => mockSftpClient);

    north = new NorthSftp(
      configuration,
      encryptionService,
      northConnectorRepository,
      scanModeRepository,
      logger,
      mockBaseFolders(testData.north.list[0].id)
    );
  });

  afterEach(() => {
    cacheService.cacheSizeEventEmitter.removeAllListeners();
  });

  it('should properly handle values', async () => {
    north.sendToSftpServer = jest.fn();
    csv.unparse = jest.fn().mockReturnValue('csv content');

    (fs.readFile as jest.Mock).mockReturnValue(JSON.stringify(timeValues));
    await north.handleContent({
      contentFile: '/path/to/file/example-123.json',
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'time-values',
      source: 'south',
      options: {}
    });

    const expectedFileName = `${new Date().getTime()}.csv`;
    expect(north.sendToSftpServer).toHaveBeenCalledWith(
      Buffer.from('csv content', 'utf8'),
      `${configuration.settings.remoteFolder}/${expectedFileName}`
    );

    expect(north.sendToSftpServer).toHaveBeenCalledWith(
      Buffer.from('csv content', 'utf8'),
      `${configuration.settings.remoteFolder}/${new Date().getTime()}.csv`
    );
  });

  it('should properly handle files', async () => {
    north.sendToSftpServer = jest.fn();
    await north.handleContent({
      contentFile: 'path/to/file/example-123.file',
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'raw',
      source: 'south',
      options: {}
    });
    expect(north.sendToSftpServer).toHaveBeenCalledWith(
      'path/to/file/example-123.file',
      `${configuration.settings.remoteFolder}/example.file`
    );
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
