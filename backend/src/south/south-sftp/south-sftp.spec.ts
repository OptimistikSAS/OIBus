import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import fs from 'node:fs/promises';
import path from 'node:path';
import SouthSftp from './south-sftp';
import { checkAge, compress } from '../../service/utils';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import { encryptionService } from '../../service/encryption.service';
import { SouthSFTPItemSettings, SouthSFTPSettings } from '../../../shared/model/south-settings.model';
import sftpClient, { FileInfo } from 'ssh2-sftp-client';
import { DateTime } from 'luxon';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import SouthCacheRepositoryMock from '../../tests/__mocks__/repository/cache/south-cache-repository.mock';
import SouthCacheServiceMock from '../../tests/__mocks__/service/south-cache-service.mock';
import { SouthConnectorEntity } from '../../model/south-connector.model';
import testData from '../../tests/utils/test-data';

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

const southCacheRepository: SouthCacheRepository = new SouthCacheRepositoryMock();
const southCacheService = new SouthCacheServiceMock();

jest.mock(
  '../../service/south-cache.service',
  () =>
    function () {
      return southCacheService;
    }
);
jest.mock('../../service/encryption.service', () => ({
  encryptionService: new EncryptionServiceMock('', '')
}));

const logger: pino.Logger = new PinoLogger();
const addContentCallback = jest.fn();

describe('SouthSFTP', () => {
  let south: SouthSftp;
  const configuration: SouthConnectorEntity<SouthSFTPSettings, SouthSFTPItemSettings> = {
    id: 'southId',
    name: 'south',
    type: 'sftp',
    description: 'my test connector',
    enabled: true,
    settings: {
      host: '127.0.0.1',
      port: 2222,
      authentication: 'password',
      username: 'user',
      password: 'pass',
      compression: false
    },
    items: [
      {
        id: 'id1',
        name: 'item1',
        enabled: true,
        settings: {
          remoteFolder: 'input',
          regex: '.*.csv',
          preserveFiles: false,
          ignoreModifiedDate: false,
          minAge: 1000,
          maxFiles: 0,
          maxSize: 0,
          recursive: false
        },
        scanMode: testData.scanMode.list[0],
        group: null,
        syncWithGroup: false,
        maxReadInterval: null,
        readDelay: null,
        overlap: null,
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      },
      {
        id: 'id2',
        name: 'item2',
        enabled: true,
        settings: {
          remoteFolder: 'input',
          regex: '.*.log',
          preserveFiles: true,
          ignoreModifiedDate: false,
          minAge: 1000,
          maxFiles: 0,
          maxSize: 0,
          recursive: false
        },
        scanMode: testData.scanMode.list[0],
        group: null,
        syncWithGroup: false,
        maxReadInterval: null,
        readDelay: null,
        overlap: null,
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      },
      {
        id: 'id3',
        name: 'item3',
        enabled: true,
        settings: {
          remoteFolder: 'input',
          regex: '.*.txt',
          preserveFiles: true,
          ignoreModifiedDate: true,
          minAge: 1000,
          maxFiles: 0,
          maxSize: 0,
          recursive: false
        },
        scanMode: testData.scanMode.list[0],
        group: null,
        syncWithGroup: false,
        maxReadInterval: null,
        readDelay: null,
        overlap: null,
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      }
    ],
    createdBy: '',
    updatedBy: '',
    createdAt: '',
    updatedAt: ''
  };
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    (sftpClient as jest.Mock).mockImplementation(() => mockSftpClient);
    (checkAge as jest.Mock).mockReturnValue(true);

    south = new SouthSftp(configuration, addContentCallback, southCacheRepository, logger, 'cacheFolder');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('directQuery should manage file retrieval', async () => {
    expect(southCacheService.getQueryOnCustomTable).not.toHaveBeenCalled();
    (fs.readdir as jest.Mock)
      .mockImplementationOnce(() => Promise.resolve([]))
      .mockImplementationOnce(() => Promise.resolve(['file.txt', 'file2.txt', 'file3.txt', 'file.log']));

    const fileInfo1: FileInfo = {
      name: 'file1'
    } as FileInfo;
    const fileInfo2: FileInfo = {
      name: 'file2'
    } as FileInfo;

    south.listFiles = jest.fn().mockImplementationOnce(() => [fileInfo1, fileInfo2]);
    south.getFile = jest.fn();

    await south.directQuery(configuration.items);

    expect(south.listFiles).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalledWith(`Folder ${configuration.items[0].settings.remoteFolder} listed 2 files in 0 ms`);
    expect(south.getFile).toHaveBeenCalledTimes(2);
    expect(south.getFile).toHaveBeenCalledWith(fileInfo1, configuration.items[0], []);
  });

  it('should respect max files limit and skip remaining files', async () => {
    const configWithLimit: SouthConnectorEntity<SouthSFTPSettings, SouthSFTPItemSettings> = {
      ...configuration,
      settings: { ...configuration.settings },
      items: [
        ...configuration.items.map(item => ({
          ...item,
          settings: {
            ...item.settings,
            maxFiles: 2,
            maxSize: 0
          }
        }))
      ],
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };
    const southWithLimit = new SouthSftp(configWithLimit, addContentCallback, southCacheRepository, logger, 'cacheFolder');
    await southWithLimit.start();

    const mtimeMs = DateTime.fromISO(testData.constants.dates.FAKE_NOW).minus({ minutes: 2 }).toMillis();
    const file1: FileInfo = { name: 'file1.csv', size: 100, modifyTime: mtimeMs } as FileInfo;
    const file2: FileInfo = { name: 'file2.csv', size: 100, modifyTime: mtimeMs } as FileInfo;
    const file3: FileInfo = { name: 'file3.csv', size: 100, modifyTime: mtimeMs } as FileInfo;

    mockSftpClient.list.mockReset();
    mockSftpClient.list.mockResolvedValue([file1, file2, file3]);
    mockSftpClient.fastGet.mockResolvedValue(undefined);
    mockSftpClient.delete.mockResolvedValue(undefined);

    await southWithLimit.directQuery([configWithLimit.items[0]]);

    expect(mockSftpClient.fastGet).toHaveBeenCalledTimes(2);
    expect(logger.debug).toHaveBeenCalledWith('Max files limit (2) reached for item item1, skipping remaining files');
  });

  it('should respect max files limit and stop file query across items', async () => {
    const configWithLimit: SouthConnectorEntity<SouthSFTPSettings, SouthSFTPItemSettings> = {
      ...configuration,
      settings: { ...configuration.settings },
      items: [
        ...configuration.items.map(item => ({
          ...item,
          settings: {
            ...item.settings,
            maxFiles: 2,
            maxSize: 0
          }
        }))
      ],
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };
    const southWithLimit = new SouthSftp(configWithLimit, addContentCallback, southCacheRepository, logger, 'cacheFolder');
    await southWithLimit.start();

    const mtimeMs = DateTime.fromISO(testData.constants.dates.FAKE_NOW).minus({ minutes: 2 }).toMillis();
    const file1: FileInfo = { name: 'file1.csv', size: 100, modifyTime: mtimeMs } as FileInfo;
    const file2: FileInfo = { name: 'file2.csv', size: 100, modifyTime: mtimeMs } as FileInfo;
    const file3: FileInfo = { name: 'file3.csv', size: 100, modifyTime: mtimeMs } as FileInfo;

    mockSftpClient.list.mockReset();
    mockSftpClient.list.mockResolvedValueOnce([file1, file2, file3]);

    mockSftpClient.fastGet.mockResolvedValue(undefined);
    mockSftpClient.delete.mockResolvedValue(undefined);

    await southWithLimit.directQuery(configWithLimit.items);

    expect(mockSftpClient.fastGet).toHaveBeenCalledTimes(2);
    expect(logger.debug).toHaveBeenCalledWith('Max files limit (2) reached for item item1, skipping remaining files');
  });

  it('should respect max size limit and skip remaining files', async () => {
    const configWithLimit: SouthConnectorEntity<SouthSFTPSettings, SouthSFTPItemSettings> = {
      ...configuration,
      settings: { ...configuration.settings },
      items: [
        ...configuration.items.map(item => ({
          ...item,
          settings: {
            ...item.settings,
            maxFiles: 0,
            maxSize: 1
          }
        }))
      ],
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };
    const southWithLimit = new SouthSftp(configWithLimit, addContentCallback, southCacheRepository, logger, 'cacheFolder');
    await southWithLimit.start();

    const mtimeMs = DateTime.fromISO(testData.constants.dates.FAKE_NOW).minus({ minutes: 2 }).toMillis();
    const file1: FileInfo = { name: 'file1.csv', size: 600 * 1024, modifyTime: mtimeMs } as FileInfo;
    const file2: FileInfo = { name: 'file2.csv', size: 600 * 1024, modifyTime: mtimeMs } as FileInfo;

    mockSftpClient.list.mockReset();
    mockSftpClient.list.mockResolvedValue([file1, file2]);
    mockSftpClient.fastGet.mockResolvedValue(undefined);
    mockSftpClient.delete.mockResolvedValue(undefined);

    await southWithLimit.directQuery([configWithLimit.items[0]]);

    expect(mockSftpClient.fastGet).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalledWith('Max size limit (1 MB) reached for item item1, skipping remaining files');
  });

  it('should respect max size limit and stop file query across items', async () => {
    const configWithLimit: SouthConnectorEntity<SouthSFTPSettings, SouthSFTPItemSettings> = {
      ...configuration,
      settings: { ...configuration.settings },
      items: [
        ...configuration.items.map(item => ({
          ...item,
          settings: {
            ...item.settings,
            maxFiles: 0,
            maxSize: 1
          }
        }))
      ],
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };
    const southWithLimit = new SouthSftp(configWithLimit, addContentCallback, southCacheRepository, logger, 'cacheFolder');
    await southWithLimit.start();

    const mtimeMs = DateTime.fromISO(testData.constants.dates.FAKE_NOW).minus({ minutes: 2 }).toMillis();
    const file1: FileInfo = { name: 'file1.csv', size: 512 * 1024, modifyTime: mtimeMs } as FileInfo;
    const file2: FileInfo = { name: 'file2.csv', size: 512 * 1024, modifyTime: mtimeMs } as FileInfo;
    const file3: FileInfo = { name: 'file3.csv', size: 100, modifyTime: mtimeMs } as FileInfo;

    mockSftpClient.list.mockReset();
    mockSftpClient.list.mockResolvedValueOnce([file1, file2, file3]);

    mockSftpClient.fastGet.mockResolvedValue(undefined);
    mockSftpClient.delete.mockResolvedValue(undefined);

    await southWithLimit.directQuery(configWithLimit.items);

    expect(mockSftpClient.fastGet).toHaveBeenCalledTimes(2);
    expect(logger.debug).toHaveBeenCalledWith('Max size limit (1 MB) reached for item item1, skipping remaining files');
  });

  it('should properly get file', async () => {
    south.addContent = jest.fn();

    const fileInfo: FileInfo = {
      name: 'myFile1',
      size: 123
    } as FileInfo;
    await south.getFile(fileInfo, configuration.items[0], []);

    expect(mockSftpClient.connect as jest.Mock).toHaveBeenCalledTimes(1);
    expect(mockSftpClient.fastGet as jest.Mock).toHaveBeenCalledTimes(1);
    expect(mockSftpClient.delete as jest.Mock).toHaveBeenCalledTimes(1);
    expect(mockSftpClient.end as jest.Mock).toHaveBeenCalledTimes(1);
    expect(south.addContent).toHaveBeenCalledWith(
      {
        type: 'any',
        filePath: path.resolve('cacheFolder', 'tmp', fileInfo.name)
      },
      testData.constants.dates.FAKE_NOW,
      [configuration.items[0]]
    );
    expect(fs.unlink).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();

    (mockSftpClient.delete as jest.Mock).mockImplementation(() => {
      throw new Error('delete error');
    });
    await south.getFile(fileInfo, configuration.items[0], []);

    expect(logger.error).toHaveBeenCalledWith(
      `Error while removing "${configuration.items[0].settings.remoteFolder}/${fileInfo.name}": ${new Error('delete error')}`
    );
    expect(south.addContent).toHaveBeenCalledTimes(2);
    expect(mockSftpClient.end).toHaveBeenCalledTimes(2);
  });

  it('should properly list files', async () => {
    const fileInfo = { name: 'myFile' } as FileInfo;
    south.checkCondition = jest.fn().mockReturnValueOnce(true);
    mockSftpClient.list = jest.fn().mockImplementation((_folder, callback) => {
      callback(fileInfo);
      return [fileInfo];
    });
    configuration.settings.username = '';
    configuration.settings.password = '';
    const result = await south.listFiles(configuration.items[0], []);
    expect(encryptionService.decryptText).not.toHaveBeenCalled();
    expect(mockSftpClient.connect).toHaveBeenCalledTimes(1);
    expect(south.checkCondition).toHaveBeenCalledWith(configuration.items[0], fileInfo, []);
    expect(mockSftpClient.end).toHaveBeenCalledTimes(1);
    expect(result).toEqual([fileInfo]);
  });

  it('should list files recursively when recursive is true', async () => {
    const configRecursive: SouthConnectorEntity<SouthSFTPSettings, SouthSFTPItemSettings> = {
      ...configuration,
      settings: { ...configuration.settings },
      items: [
        ...configuration.items.map(item => ({
          ...item,
          settings: {
            ...item.settings,
            recursive: true
          }
        }))
      ],
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };
    const southRecursive = new SouthSftp(configRecursive, addContentCallback, southCacheRepository, logger, 'cacheFolder');
    await southRecursive.start();

    const mtimeMs = DateTime.fromISO(testData.constants.dates.FAKE_NOW).minus({ minutes: 2 }).toMillis();
    const dirEntry: FileInfo = { type: 'd', name: 'subdir' } as FileInfo;
    const fileInSubdir: FileInfo = {
      type: '-',
      name: 'file.csv',
      size: 100,
      modifyTime: mtimeMs
    } as FileInfo;
    const fileFailsCondition: FileInfo = {
      type: '-',
      name: 'other.xml',
      size: 100,
      modifyTime: mtimeMs
    } as FileInfo;

    mockSftpClient.list.mockReset();
    mockSftpClient.list.mockResolvedValueOnce([dirEntry]).mockResolvedValueOnce([fileInSubdir, fileFailsCondition]);

    const item = configRecursive.items[0];
    const result = await southRecursive.listFiles(item, []);

    expect(mockSftpClient.list).toHaveBeenCalledWith('input');
    expect(mockSftpClient.list).toHaveBeenCalledWith('input/subdir');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('subdir/file.csv');
  });
});

describe('SouthFTP with preserve file and compression', () => {
  let south: SouthSftp;
  const configuration: SouthConnectorEntity<SouthSFTPSettings, SouthSFTPItemSettings> = {
    id: 'southId',
    name: 'south',
    type: 'sftp',
    description: 'my test connector',
    enabled: true,
    settings: {
      host: '127.0.0.1',
      port: 2222,
      authentication: 'password',
      username: 'user',
      password: 'pass',
      compression: true
    },
    items: [
      {
        id: 'id1',
        name: 'item1',
        enabled: true,
        settings: {
          remoteFolder: 'input',
          regex: '.*.csv',
          preserveFiles: false,
          ignoreModifiedDate: false,
          minAge: 1000,
          maxFiles: 0,
          maxSize: 0,
          recursive: false
        },
        scanMode: testData.scanMode.list[0],
        group: null,
        syncWithGroup: false,
        maxReadInterval: null,
        readDelay: null,
        overlap: null,
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      },
      {
        id: 'id2',
        name: 'item2',
        enabled: true,
        settings: {
          remoteFolder: 'input',
          regex: '.*.log',
          preserveFiles: true,
          ignoreModifiedDate: false,
          minAge: 1000,
          maxFiles: 0,
          maxSize: 0,
          recursive: false
        },
        scanMode: testData.scanMode.list[0],
        group: null,
        syncWithGroup: false,
        maxReadInterval: null,
        readDelay: null,
        overlap: null,
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      },
      {
        id: 'id3',
        name: 'item3',
        enabled: true,
        settings: {
          remoteFolder: 'input',
          regex: '.*.txt',
          preserveFiles: true,
          ignoreModifiedDate: true,
          minAge: 1000,
          maxFiles: 0,
          maxSize: 0,
          recursive: false
        },
        scanMode: testData.scanMode.list[0],
        group: null,
        syncWithGroup: false,
        maxReadInterval: null,
        readDelay: null,
        overlap: null,
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      }
    ],
    createdBy: '',
    updatedBy: '',
    createdAt: '',
    updatedAt: ''
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    (sftpClient as jest.Mock).mockImplementation(() => mockSftpClient);
    (checkAge as jest.Mock).mockReturnValue(true);

    south = new SouthSftp(configuration, addContentCallback, southCacheRepository, logger, 'cacheFolder');
    await south.start();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should properly add compressed file', async () => {
    const mtimeMs = new Date('2020-02-02T02:02:02.222Z').getTime();
    const fileInfo: FileInfo = {
      name: 'myFile1',
      size: 123,
      modifyTime: mtimeMs
    } as FileInfo;

    south.addContent = jest.fn();
    (fs.unlink as jest.Mock)
      .mockImplementationOnce(() => null)
      .mockImplementationOnce(() => null)
      .mockImplementationOnce(() => {
        throw new Error('error');
      });
    await south.getFile(fileInfo, configuration.items[1], []);

    expect(mockSftpClient.fastGet as jest.Mock).toHaveBeenCalledTimes(1);
    expect(compress).toHaveBeenCalledWith(
      path.resolve('cacheFolder', 'tmp', fileInfo.name),
      `${path.resolve('cacheFolder', 'tmp', 'myFile1')}.gz`
    );
    expect(south.addContent).toHaveBeenCalledWith(
      {
        type: 'any',
        filePath: path.resolve('cacheFolder', 'tmp', `${fileInfo.name}.gz`)
      },
      testData.constants.dates.FAKE_NOW,
      [configuration.items[1]]
    );
    expect(logger.error).not.toHaveBeenCalled();
    expect(fs.unlink).toHaveBeenCalledWith(`${path.resolve('cacheFolder', 'tmp', 'myFile1')}.gz`);
    expect(fs.unlink).toHaveBeenCalledWith(path.resolve('cacheFolder', 'tmp', fileInfo.name));
    expect(mockSftpClient.end as jest.Mock).toHaveBeenCalledTimes(1);

    fileInfo.name = 'myFile2';
    await south.getFile(fileInfo, configuration.items[1], []);
    expect(south.addContent).toHaveBeenCalledWith(
      {
        type: 'any',
        filePath: `${path.resolve('cacheFolder', 'tmp', 'myFile2')}.gz`
      },
      testData.constants.dates.FAKE_NOW,
      [configuration.items[1]]
    );
    expect(logger.error).toHaveBeenCalledWith(
      `Error while removing compressed file "${path.resolve('cacheFolder', 'tmp', 'myFile2')}.gz": ${new Error('error')}`
    );

    (compress as jest.Mock).mockImplementationOnce(() => {
      throw new Error('compression error');
    });
    await south.getFile(fileInfo, configuration.items[1], []);
    expect(south.addContent).toHaveBeenCalledWith(
      {
        type: 'any',
        filePath: path.resolve('cacheFolder', 'tmp', 'myFile2')
      },
      testData.constants.dates.FAKE_NOW,
      [configuration.items[1]]
    );

    expect(logger.error).toHaveBeenCalledWith(
      `Error compressing file "${path.resolve('cacheFolder', 'tmp', fileInfo.name)}". Sending it raw instead`
    );
  });
});

describe('SouthSFTP test connection with private key', () => {
  let south: SouthSftp;
  const configuration: SouthConnectorEntity<SouthSFTPSettings, SouthSFTPItemSettings> = {
    id: 'southId',
    name: 'south',
    type: 'sftp',
    description: 'my test connector',
    enabled: true,
    settings: {
      host: '127.0.0.1',
      port: 2222,
      authentication: 'private-key',
      privateKey: 'myPrivateKey',
      passphrase: 'myPassphrase',
      username: '',
      compression: false
    },
    items: [
      {
        id: 'id1',
        name: 'item1',
        enabled: true,
        settings: {
          remoteFolder: 'input',
          regex: '.*.csv',
          preserveFiles: false,
          ignoreModifiedDate: false,
          minAge: 1000,
          maxFiles: 0,
          maxSize: 0,
          recursive: false
        },
        scanMode: testData.scanMode.list[0],
        group: null,
        syncWithGroup: false,
        maxReadInterval: null,
        readDelay: null,
        overlap: null,
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      },
      {
        id: 'id2',
        name: 'item2',
        enabled: true,
        settings: {
          remoteFolder: 'input',
          regex: '.*.log',
          preserveFiles: true,
          ignoreModifiedDate: false,
          minAge: 1000,
          maxFiles: 0,
          maxSize: 0,
          recursive: false
        },
        scanMode: testData.scanMode.list[0],
        group: null,
        syncWithGroup: false,
        maxReadInterval: null,
        readDelay: null,
        overlap: null,
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      },
      {
        id: 'id3',
        name: 'item3',
        enabled: true,
        settings: {
          remoteFolder: 'input',
          regex: '.*.txt',
          preserveFiles: true,
          ignoreModifiedDate: true,
          minAge: 1000,
          maxFiles: 0,
          maxSize: 0,
          recursive: false
        },
        scanMode: testData.scanMode.list[0],
        group: null,
        syncWithGroup: false,
        maxReadInterval: null,
        readDelay: null,
        overlap: null,
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      }
    ],
    createdBy: '',
    updatedBy: '',
    createdAt: '',
    updatedAt: ''
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    (sftpClient as jest.Mock).mockImplementation(() => mockSftpClient);

    south = new SouthSftp(configuration, addContentCallback, southCacheRepository, logger, 'cacheFolder');
  });

  afterEach(() => {
    jest.useRealTimers();
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
    const testResult = await south.testConnection();
    expect(testResult).toEqual({
      items: [
        { key: 'Host', value: `${configuration.settings.host}:${configuration.settings.port}` },
        { key: 'Username', value: configuration.settings.username }
      ]
    });
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
    south.listFiles = jest.fn().mockReturnValueOnce([{ name: 'file.csv', modifyTime: DateTime.now().toMillis() }]);

    const result = await south.testItem(configuration.items[0], testData.south.itemTestingSettings);
    expect(south.listFiles).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      type: 'time-values',
      content: [
        {
          pointId: configuration.items[0].name,
          timestamp: testData.constants.dates.FAKE_NOW,
          data: { value: 'file.csv' }
        }
      ]
    });
  });

  it('should test item and throw error', async () => {
    const error = new Error('Could not list files');
    south.listFiles = jest.fn().mockRejectedValue(error);

    await expect(south.testItem(configuration.items[0], testData.south.itemTestingSettings)).rejects.toThrow(error);
    expect(south.listFiles).toHaveBeenCalledTimes(1);
  });
});
