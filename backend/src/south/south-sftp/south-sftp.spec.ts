import fs from 'node:fs/promises';
import path from 'node:path';

import SouthSftp from './south-sftp';

import { compress } from '../../service/utils';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import DatabaseMock from '../../tests/__mocks__/database.mock';
import EncryptionService from '../../service/encryption.service';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import RepositoryService from '../../service/repository.service';
import RepositoryServiceMock from '../../tests/__mocks__/service/repository-service.mock';

import { SouthConnectorDTO, SouthConnectorItemDTO } from '../../../../shared/model/south-connector.model';
import { SouthSFTPItemSettings, SouthSFTPSettings } from '../../../../shared/model/south-settings.model';
import sftpClient, { FileInfo } from 'ssh2-sftp-client';
import { DateTime } from 'luxon';

jest.mock('node:fs/promises');

const mockSftpClient = {
  connect: jest.fn(),
  list: jest.fn(),
  fastGet: jest.fn(),
  delete: jest.fn(),
  end: jest.fn()
};
jest.mock('ssh2-sftp-client');
jest.mock('../../service/utils');
const database = new DatabaseMock();
const getQueryOnCustomTable = jest.fn();
const runQueryOnCustomTable = jest.fn();
jest.mock(
  '../../service/south-cache.service',
  () =>
    function () {
      return {
        cacheRepository: {
          createCustomTable: jest.fn(),
          runQueryOnCustomTable,
          getQueryOnCustomTable
        }
      };
    }
);
jest.mock(
  '../../service/south-connector-metrics.service',
  () =>
    function () {
      return {
        initMetrics: jest.fn(),
        updateMetrics: jest.fn(),
        get stream() {
          return { stream: 'myStream' };
        },
        metrics: {
          numberOfValuesRetrieved: 1,
          numberOfFilesRetrieved: 1
        }
      };
    }
);

const addContentCallback = jest.fn();

const logger: pino.Logger = new PinoLogger();

const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const repositoryService: RepositoryService = new RepositoryServiceMock();

const items: Array<SouthConnectorItemDTO<SouthSFTPItemSettings>> = [
  {
    id: 'id1',
    name: 'item1',
    enabled: true,
    connectorId: 'southId',
    settings: {
      remoteFolder: 'input',
      regex: '.*.csv',
      preserveFiles: false,
      ignoreModifiedDate: false,
      minAge: 1000
    },
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id2',
    name: 'item2',
    enabled: true,
    connectorId: 'southId',
    settings: {
      remoteFolder: 'input',
      regex: '.*.log',
      preserveFiles: true,
      ignoreModifiedDate: false,
      minAge: 1000
    },
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id3',
    name: 'item3',
    enabled: true,
    connectorId: 'southId',
    settings: {
      remoteFolder: 'input',
      regex: '.*.txt',
      preserveFiles: true,
      ignoreModifiedDate: true,
      minAge: 1000
    },
    scanModeId: 'scanModeId1'
  }
];

const nowDateString = '2020-02-02T02:02:02.222Z';
let south: SouthSftp;
const configuration: SouthConnectorDTO<SouthSFTPSettings> = {
  id: 'southId',
  name: 'south',
  type: 'test',
  description: 'my test connector',
  enabled: true,
  history: {
    maxInstantPerItem: true,
    maxReadInterval: 3600,
    readDelay: 0,
    overlap: 0
  },
  settings: {
    host: '127.0.0.1',
    port: 2222,
    authentication: 'password',
    username: 'user',
    password: 'pass',
    compression: false
  }
};

describe('SouthSFTP', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));
    repositoryService.southConnectorRepository.findById = jest.fn().mockReturnValue(configuration);
    (sftpClient as jest.Mock).mockImplementation(() => mockSftpClient);

    south = new SouthSftp(configuration, addContentCallback, encryptionService, repositoryService, logger, 'baseFolder');
  });

  it('fileQuery should manage file retrieval', async () => {
    expect(database.prepare).not.toHaveBeenCalled();
    (fs.readdir as jest.Mock)
      .mockImplementationOnce(() => Promise.resolve([]))
      .mockImplementationOnce(() => Promise.resolve(['file.txt', 'file2.txt', 'file3.txt', 'file.log']));

    const fileInfo1: FileInfo = {
      name: 'file1'
    } as FileInfo;
    const fileInfo2: FileInfo = {
      name: 'file2'
    } as FileInfo;
    const fileInfo3: FileInfo = {
      name: 'file3'
    } as FileInfo;

    south.listFiles = jest
      .fn()
      .mockImplementationOnce(() => [fileInfo1, fileInfo2])
      .mockImplementationOnce(() => [fileInfo3])
      .mockImplementationOnce(() => []);
    south.getFile = jest.fn();

    await south.fileQuery(items);

    expect(logger.trace).toHaveBeenCalledWith(
      `Reading "${items[0].settings.remoteFolder}" remote folder on ${configuration.settings.host}:${configuration.settings.port} for item ${items[0].name}`
    );
    expect(south.listFiles).toHaveBeenCalledTimes(3);
    expect(logger.debug).toHaveBeenCalledWith(`Folder ${items[0].settings.remoteFolder} listed 2 files in 0 ms`);
    expect(logger.debug).toHaveBeenCalledWith(`Folder ${items[1].settings.remoteFolder} listed 1 files in 0 ms`);
    expect(logger.debug).toHaveBeenCalledWith(`Folder ${items[2].settings.remoteFolder} listed 0 files in 0 ms`);
    expect(south.getFile).toHaveBeenCalledTimes(3);
    expect(south.getFile).toHaveBeenCalledWith(fileInfo1, items[0]);
    expect(south.getFile).toHaveBeenCalledWith(fileInfo2, items[0]);
    expect(south.getFile).toHaveBeenCalledWith(fileInfo3, items[1]);
  });

  it('should properly check condition', () => {
    const mtimeMs = DateTime.fromISO('2020-02-02T02:02:02.222Z').toMillis();
    const timestamp = DateTime.now().toMillis();
    const fileInfo: FileInfo = {
      name: 'myFile',
      size: 123,
      modifyTime: mtimeMs
    } as FileInfo;

    expect(south.checkCondition(items[0], fileInfo)).toEqual(false);
    expect(logger.trace).toHaveBeenCalledWith(`File name "${fileInfo.name}" does not match regex ${items[0].settings.regex}`);

    fileInfo.name = 'myFile.csv';
    expect(south.checkCondition(items[0], fileInfo)).toEqual(false);
    expect(logger.trace).toHaveBeenCalledWith(
      `Check age condition: mT:${mtimeMs} + mA ${items[0].settings.minAge} < ts:${timestamp} ` +
        `= ${mtimeMs + items[0].settings.minAge < timestamp}`
    );

    fileInfo.modifyTime = mtimeMs - 10000;
    expect(south.checkCondition(items[0], fileInfo)).toEqual(true);
    expect(logger.trace).toHaveBeenCalledWith(`File "${fileInfo.name}" matches age`);
  });

  it('should properly get file', async () => {
    south.addContent = jest.fn();
    south.updateModifiedTime = jest.fn();

    const fileInfo: FileInfo = {
      name: 'myFile1',
      size: 123
    } as FileInfo;
    await south.getFile(fileInfo, items[0]);

    expect(mockSftpClient.connect as jest.Mock).toHaveBeenCalledTimes(1);
    expect(mockSftpClient.fastGet as jest.Mock).toHaveBeenCalledTimes(1);
    expect(mockSftpClient.delete as jest.Mock).toHaveBeenCalledTimes(1);
    expect(mockSftpClient.end as jest.Mock).toHaveBeenCalledTimes(1);
    expect(south.addContent).toHaveBeenCalledWith({ type: 'raw', filePath: path.resolve('baseFolder', 'tmp', fileInfo.name) });
    expect(fs.unlink).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
    expect(south.updateModifiedTime).not.toHaveBeenCalled();

    (mockSftpClient.delete as jest.Mock).mockImplementation(() => {
      throw new Error('delete error');
    });
    await south.getFile(fileInfo, items[0]);

    expect(logger.error).toHaveBeenCalledWith(
      `Error while removing "${items[0].settings.remoteFolder}/${fileInfo.name}": ${new Error('delete error')}`
    );
    expect(south.addContent).toHaveBeenCalledTimes(2);
    expect(mockSftpClient.end).toHaveBeenCalledTimes(2);
  });

  it('should get modified time', () => {
    getQueryOnCustomTable.mockReturnValueOnce({ mtimeMs: 1 }).mockReturnValueOnce(null);
    expect(south.getModifiedTime('my file')).toEqual(1);
    expect(south.getModifiedTime('my file')).toEqual(0);
    expect(getQueryOnCustomTable).toHaveBeenCalledWith(`SELECT mtime_ms AS mtimeMs FROM "sftp_${configuration.id}" WHERE filename = ?`, [
      'my file'
    ]);
  });

  it('should update modified time', () => {
    south.updateModifiedTime('my file', 1);
    expect(runQueryOnCustomTable).toHaveBeenCalledWith(
      `INSERT INTO "sftp_${configuration.id}" (filename, mtime_ms) VALUES (?, ?) ON CONFLICT(filename) DO UPDATE SET mtime_ms = ?`,
      ['my file', 1, 1]
    );
  });

  it('should properly list files', async () => {
    const fileInfo = { name: 'myFile' } as FileInfo;
    south.checkCondition = jest.fn().mockReturnValueOnce(true);
    mockSftpClient.list = jest.fn().mockImplementation((_folder, callback) => {
      callback(fileInfo);
      return [fileInfo];
    });
    configuration.settings.username = null;
    configuration.settings.password = '';
    const result = await south.listFiles(items[0]);
    expect(encryptionService.decryptText).not.toHaveBeenCalled();
    expect(mockSftpClient.connect).toHaveBeenCalledTimes(1);
    expect(south.checkCondition).toHaveBeenCalledWith(items[0], fileInfo);
    expect(mockSftpClient.end).toHaveBeenCalledTimes(1);
    expect(result).toEqual([fileInfo]);
  });
});

describe('SouthFTP with preserve file and compression', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));
    database.prepare.mockImplementation(() => ({
      run: jest.fn()
    }));
    configuration.settings.compression = true;
    repositoryService.southConnectorRepository.findById = jest.fn().mockReturnValue(configuration);
    (sftpClient as jest.Mock).mockImplementation(() => mockSftpClient);
    south = new SouthSftp(configuration, addContentCallback, encryptionService, repositoryService, logger, 'baseFolder');
    await south.start();
  });

  it('should properly check condition', () => {
    const mtimeMs = new Date('2020-02-02T02:02:02.222Z').getTime();
    south.getModifiedTime = jest
      .fn()
      .mockReturnValueOnce(mtimeMs - 10_000) // saved modified time same than mTime (mtimeMs - 10000) => file did not change
      .mockReturnValueOnce(mtimeMs - 999_999); // saved modified time is more recent than mTime (mtimeMs - 999999) => file changed

    const fileInfo: FileInfo = {
      name: 'myFile1.log',
      size: 123,
      modifyTime: mtimeMs - 10_000
    } as FileInfo;
    expect(south.checkCondition(items[1], fileInfo)).toEqual(false);
    fileInfo.name = 'myFile2.log';
    expect(south.checkCondition(items[1], fileInfo)).toEqual(true);
    expect(logger.trace).toHaveBeenCalledWith(
      `File "myFile2.log" last modified time ${mtimeMs - 999_999} is older than modify time ${mtimeMs - 10_000}. The file will be sent`
    );
  });

  it('should properly add compressed file', async () => {
    const mtimeMs = new Date('2020-02-02T02:02:02.222Z').getTime();
    const fileInfo: FileInfo = {
      name: 'myFile1',
      size: 123,
      modifyTime: mtimeMs
    } as FileInfo;

    south.addContent = jest.fn();
    south.updateModifiedTime = jest.fn();
    (fs.unlink as jest.Mock)
      .mockImplementationOnce(() => null)
      .mockImplementationOnce(() => null)
      .mockImplementationOnce(() => {
        throw new Error('error');
      });
    await south.getFile(fileInfo, items[1]);

    expect(mockSftpClient.fastGet as jest.Mock).toHaveBeenCalledTimes(1);
    expect(south.updateModifiedTime as jest.Mock).toHaveBeenCalledTimes(1);
    expect(compress).toHaveBeenCalledWith(
      path.resolve('baseFolder', 'tmp', fileInfo.name),
      `${path.resolve('baseFolder', 'tmp', 'myFile1')}.gz`
    );
    expect(south.addContent).toHaveBeenCalledWith({ type: 'raw', filePath: path.resolve('baseFolder', 'tmp', `${fileInfo.name}.gz`) });
    expect(logger.error).not.toHaveBeenCalled();
    expect(fs.unlink).toHaveBeenCalledWith(`${path.resolve('baseFolder', 'tmp', 'myFile1')}.gz`);
    expect(fs.unlink).toHaveBeenCalledWith(path.resolve('baseFolder', 'tmp', fileInfo.name));
    expect(mockSftpClient.end as jest.Mock).toHaveBeenCalledTimes(1);

    fileInfo.name = 'myFile2';
    await south.getFile(fileInfo, items[1]);
    expect(south.addContent).toHaveBeenCalledWith({ type: 'raw', filePath: `${path.resolve('baseFolder', 'tmp', 'myFile2')}.gz` });
    expect(logger.error).toHaveBeenCalledWith(
      `Error while removing compressed file "${path.resolve('baseFolder', 'tmp', 'myFile2')}.gz": ${new Error('error')}`
    );

    (compress as jest.Mock).mockImplementationOnce(() => {
      throw new Error('compression error');
    });
    await south.getFile(fileInfo, items[1]);
    expect(south.addContent).toHaveBeenCalledWith({ type: 'raw', filePath: path.resolve('baseFolder', 'tmp', 'myFile2') });

    expect(logger.error).toHaveBeenCalledWith(
      `Error compressing file "${path.resolve('baseFolder', 'tmp', fileInfo.name)}". Sending it raw instead`
    );
  });
});

describe('SouthSFTP with preserve file ignore modified date', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));
    database.prepare.mockImplementation(() => ({
      run: jest.fn()
    }));
    configuration.settings.compression = false;
    (sftpClient as jest.Mock).mockImplementation(() => mockSftpClient);

    repositoryService.southConnectorRepository.findById = jest.fn().mockReturnValue(configuration);

    south = new SouthSftp(configuration, addContentCallback, encryptionService, repositoryService, logger, 'baseFolder');
  });

  it('should properly check condition with ignore modified date', () => {
    const mtimeMs = new Date('2020-02-02T02:02:02.222Z').getTime();
    south.getModifiedTime = jest
      .fn()
      .mockReturnValueOnce(mtimeMs - 10000) // saved modified time same than mTime (mtimeMs - 10000) => file did not change
      .mockReturnValueOnce(mtimeMs - 999999); // saved modified time is more recent than mTime (mtimeMs - 999999) => file changed

    const fileInfo: FileInfo = {
      name: 'myFile1.txt',
      size: 123,
      modifyTime: mtimeMs - 10000
    } as FileInfo;
    expect(south.checkCondition(items[2], fileInfo)).toEqual(true);
    fileInfo.name = 'myFile2.txt';
    expect(south.checkCondition(items[2], fileInfo)).toEqual(true);
  });
});

describe('SouthSFTP test connection with private key', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));
    (sftpClient as jest.Mock).mockImplementation(() => mockSftpClient);

    configuration.settings.authentication = 'private-key';
    configuration.settings.privateKey = 'myPrivateKey';
    configuration.settings.passphrase = 'myPassphrase';
    repositoryService.southConnectorRepository.findById = jest.fn().mockReturnValue(configuration);
    south = new SouthSftp(configuration, addContentCallback, encryptionService, repositoryService, logger, 'baseFolder');
  });

  it('should throw an error if connection fails', async () => {
    const errorMessage = 'connection fails';
    (mockSftpClient.connect as jest.Mock).mockImplementationOnce(() => {
      throw new Error(errorMessage);
    });

    await expect(south.testConnection()).rejects.toThrow(
      `Access error on "${configuration.settings.host}:${configuration.settings.port}": ${errorMessage}`
    );
  });

  it('should properly test connection', async () => {
    (fs.access as jest.Mock).mockImplementation(() => Promise.resolve());
    (fs.stat as jest.Mock).mockReturnValue({
      isDirectory: () => true
    });
    await south.testConnection();
    expect(logger.error).not.toHaveBeenCalled();
    expect(encryptionService.decryptText).toHaveBeenCalledWith('myPassphrase');
    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(encryptionService.decryptText).toHaveBeenCalledTimes(1);
    configuration.settings.passphrase = '';
    await south.testConnection();
    expect(encryptionService.decryptText).toHaveBeenCalledTimes(1);
    expect(fs.readFile).toHaveBeenCalledTimes(2);
  });

  it('should test item', async () => {
    const callback = jest.fn();
    south.listFiles = jest.fn().mockReturnValueOnce([{ name: 'file.csv' }]);

    await south.testItem(items[0], callback);
    expect(south.listFiles).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith({
      type: 'time-values',
      content: [
        {
          pointId: items[0].name,
          timestamp: nowDateString,
          data: { value: 'file.csv' }
        }
      ]
    });
  });
});
