import fs from 'node:fs/promises';
import path from 'node:path';

import SouthFtp from './south-ftp';

import { compress } from '../../service/utils';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';

import { SouthFTPItemSettings, SouthFTPSettings } from '../../../shared/model/south-settings.model';
import { Client as FTPClient, FileInfo } from 'basic-ftp';
import { DateTime } from 'luxon';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import SouthCacheRepositoryMock from '../../tests/__mocks__/repository/cache/south-cache-repository.mock';
import SouthCacheServiceMock from '../../tests/__mocks__/service/south-cache-service.mock';
import { SouthConnectorEntity } from '../../model/south-connector.model';
import testData from '../../tests/utils/test-data';

jest.mock('node:fs/promises');

const mockFtpClient = {
  access: jest.fn(),
  list: jest.fn(),
  downloadTo: jest.fn(),
  remove: jest.fn(),
  close: jest.fn()
};
jest.mock('basic-ftp');
jest.mock('../../service/utils');
jest.mock('../../service/encryption.service', () => ({
  encryptionService: {
    decryptText: jest.fn().mockResolvedValue('decrypted-password')
  }
}));

const southCacheRepository: SouthCacheRepository = new SouthCacheRepositoryMock();
const southCacheService = new SouthCacheServiceMock();

jest.mock(
  '../../service/south-cache.service',
  () =>
    function () {
      return southCacheService;
    }
);

const logger: pino.Logger = new PinoLogger();
const addContentCallback = jest.fn();

const createMockFileInfo = (name: string, modifiedAt: Date): FileInfo =>
  ({
    name,
    type: '-' as unknown as FileInfo['type'],
    size: 100,
    modifiedAt,
    permissions: { user: 6, group: 4, world: 4 },
    hardLinkCount: 1,
    link: undefined,
    group: 'group',
    user: 'user',
    uniqueID: 'unique'
  }) as FileInfo;

describe('SouthFTP', () => {
  let south: SouthFtp;
  const configuration: SouthConnectorEntity<SouthFTPSettings, SouthFTPItemSettings> = {
    id: 'southId',
    name: 'south',
    type: 'ftp',
    description: 'my test connector',
    enabled: true,
    settings: {
      host: '127.0.0.1',
      port: 21,
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
          minAge: 1000
        },
        scanMode: testData.scanMode.list[0]
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
          minAge: 1000
        },
        scanMode: testData.scanMode.list[0]
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
          minAge: 1000
        },
        scanMode: testData.scanMode.list[0]
      }
    ]
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    (FTPClient as jest.MockedClass<typeof FTPClient>).mockImplementation(() => mockFtpClient as unknown as InstanceType<typeof FTPClient>);
    (fs.mkdir as jest.Mock).mockReturnValue(undefined);
    (fs.unlink as jest.Mock).mockReturnValue(undefined);
    (compress as jest.Mock).mockReturnValue(undefined);
    southCacheService.createCustomTable.mockReturnValue(undefined);
    southCacheService.getQueryOnCustomTable.mockReturnValue(null);
    southCacheService.runQueryOnCustomTable.mockReturnValue(undefined);

    // Reset FTP client mocks
    mockFtpClient.access.mockReset();
    mockFtpClient.list.mockReset();
    mockFtpClient.downloadTo.mockReset();
    mockFtpClient.remove.mockReset();
    mockFtpClient.close.mockReset();

    south = new SouthFtp(configuration, addContentCallback, southCacheRepository, logger, 'cacheFolder');
  });

  describe('with valid configuration', () => {
    beforeEach(async () => {
      await south.start();
    });

    it('should properly start', () => {
      expect(southCacheService.createCustomTable).toHaveBeenCalledWith('south_ftp_southId', 'filename TEXT PRIMARY KEY, mtime_ms INTEGER');
    });

    it('should test connection', async () => {
      mockFtpClient.access.mockResolvedValue(undefined);
      mockFtpClient.close.mockResolvedValue(undefined);

      await south.testConnection();

      expect(mockFtpClient.access).toHaveBeenCalledWith({
        host: '127.0.0.1',
        port: 21,
        user: 'user',
        password: 'decrypted-password',
        secure: false
      });
      expect(mockFtpClient.close).toHaveBeenCalled();
    });

    it('should test connection with error', async () => {
      mockFtpClient.access.mockRejectedValue(new Error('Connection failed'));

      await expect(south.testConnection()).rejects.toThrow('Access error on "127.0.0.1:21": Connection failed');
    });

    it('should test item', async () => {
      const fileInfo = createMockFileInfo('test.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));

      mockFtpClient.list.mockResolvedValue([fileInfo]);

      const item = configuration.items[0];
      const callback = jest.fn();

      await south.testItem(item, { history: undefined }, callback);

      expect(callback).toHaveBeenCalledWith({
        type: 'time-values',
        content: [
          {
            pointId: 'item1',
            timestamp: expect.any(String),
            data: { value: 'test.csv' }
          }
        ]
      });
    });

    it('should test item with file without modifiedAt date', async () => {
      const fileInfoWithoutDate: FileInfo = {
        name: 'test.csv',
        type: '-' as unknown as FileInfo['type'],
        size: 100,
        modifiedAt: undefined,
        rawModifiedAt: '',
        permissions: { user: 6, group: 4, world: 4 },
        hardLinkCount: 1,
        link: undefined,
        group: 'group',
        user: 'user',
        uniqueID: 'unique',
        isDirectory: false,
        isSymbolicLink: false,
        isFile: true,
        date: new Date()
      } as unknown as FileInfo;

      // Mock the listFiles method to return the file directly, bypassing checkCondition
      const originalListFiles = south.listFiles.bind(south);
      south.listFiles = jest.fn().mockResolvedValue([fileInfoWithoutDate]);

      const item = configuration.items[0];
      const callback = jest.fn();

      await south.testItem(item, { history: undefined }, callback);

      expect(callback).toHaveBeenCalledWith({
        type: 'time-values',
        content: [
          {
            pointId: 'item1',
            timestamp: expect.any(String),
            data: { value: 'test.csv' }
          }
        ]
      });

      // Restore the original method
      south.listFiles = originalListFiles;
    });

    it('should list files', async () => {
      const fileInfo = createMockFileInfo('test.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));

      mockFtpClient.list.mockResolvedValue([fileInfo]);

      const item = configuration.items[0];
      const files = await south.listFiles(item);

      expect(files).toEqual([fileInfo]);
      expect(mockFtpClient.access).toHaveBeenCalledWith({
        host: '127.0.0.1',
        port: 21,
        user: 'user',
        password: 'decrypted-password',
        secure: false
      });
      expect(mockFtpClient.list).toHaveBeenCalledWith('input');
      expect(mockFtpClient.close).toHaveBeenCalled();
    });

    it('should filter files by regex', async () => {
      const fileInfo1 = createMockFileInfo('test.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));
      const fileInfo2 = createMockFileInfo('test.txt', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));

      mockFtpClient.list.mockResolvedValue([fileInfo1, fileInfo2]);

      const item = configuration.items[0]; // regex: '.*.csv'
      const files = await south.listFiles(item);

      expect(files).toEqual([fileInfo1]);
    });

    it('should filter files by age', async () => {
      const fileInfo = createMockFileInfo('test.csv', new Date(DateTime.now().minus({ milliseconds: 500 }).toMillis())); // too recent

      mockFtpClient.list.mockResolvedValue([fileInfo]);

      const item = configuration.items[0]; // minAge: 1000
      const files = await south.listFiles(item);

      expect(files).toEqual([]);
    });

    it('should get file', async () => {
      const fileInfo = createMockFileInfo('test.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));

      mockFtpClient.downloadTo.mockResolvedValue(undefined);
      mockFtpClient.remove.mockResolvedValue(undefined);

      const item = configuration.items[0]; // preserveFiles: false
      await south.getFile(fileInfo, item);

      expect(mockFtpClient.downloadTo).toHaveBeenCalledWith(path.resolve('cacheFolder', 'tmp', 'test.csv'), 'input/test.csv');
      expect(mockFtpClient.remove).toHaveBeenCalledWith('input/test.csv');
      expect(addContentCallback).toHaveBeenCalledWith('southId', {
        type: 'any',
        filePath: path.resolve('cacheFolder', 'tmp', 'test.csv')
      });
    });

    it('should get file with compression', async () => {
      const fileInfo = createMockFileInfo('test.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));

      mockFtpClient.downloadTo.mockResolvedValue(undefined);
      mockFtpClient.remove.mockResolvedValue(undefined);
      (compress as jest.Mock).mockResolvedValue(undefined);

      const configurationWithCompression = {
        ...configuration,
        settings: { ...configuration.settings, compression: true }
      };

      const southWithCompression = new SouthFtp(
        configurationWithCompression,
        addContentCallback,
        southCacheRepository,
        logger,
        'cacheFolder'
      );
      await southWithCompression.start();

      const item = configuration.items[0];
      await southWithCompression.getFile(fileInfo, item);

      expect(compress).toHaveBeenCalledWith(
        path.resolve('cacheFolder', 'tmp', 'test.csv'),
        path.resolve('cacheFolder', 'tmp', 'test.csv.gz')
      );
      expect(addContentCallback).toHaveBeenCalledWith('southId', {
        type: 'any',
        filePath: path.resolve('cacheFolder', 'tmp', 'test.csv.gz')
      });
    });

    it('should preserve files when configured', async () => {
      const fileInfo = createMockFileInfo('test.log', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));

      mockFtpClient.downloadTo.mockResolvedValue(undefined);
      southCacheService.getQueryOnCustomTable.mockReturnValue(null);

      const item = configuration.items[1]; // preserveFiles: true
      await south.getFile(fileInfo, item);

      expect(mockFtpClient.remove).not.toHaveBeenCalled();
      expect(southCacheService.runQueryOnCustomTable).toHaveBeenCalledWith(
        'INSERT INTO "south_ftp_southId" (filename, mtime_ms) VALUES (?, ?) ON CONFLICT(filename) DO UPDATE SET mtime_ms = ?',
        ['test.log', fileInfo.modifiedAt!.getTime(), fileInfo.modifiedAt!.getTime()]
      );
    });

    it('should handle file removal error', async () => {
      const fileInfo = createMockFileInfo('test.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));

      mockFtpClient.downloadTo.mockResolvedValue(undefined);
      mockFtpClient.remove.mockRejectedValue(new Error('Remove failed'));

      const item = configuration.items[0];
      await south.getFile(fileInfo, item);

      expect(mockFtpClient.remove).toHaveBeenCalledWith('input/test.csv');
      expect(addContentCallback).toHaveBeenCalledWith('southId', {
        type: 'any',
        filePath: path.resolve('cacheFolder', 'tmp', 'test.csv')
      });
    });

    it('should handle compression error', async () => {
      const fileInfo = createMockFileInfo('test.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));

      mockFtpClient.downloadTo.mockResolvedValue(undefined);
      mockFtpClient.remove.mockResolvedValue(undefined);
      (compress as jest.Mock).mockRejectedValue(new Error('Compression failed'));

      const configurationWithCompression = {
        ...configuration,
        settings: { ...configuration.settings, compression: true }
      };
      const southWithCompression = new SouthFtp(
        configurationWithCompression,
        addContentCallback,
        southCacheRepository,
        logger,
        'cacheFolder'
      );
      await southWithCompression.start();

      const item = configuration.items[0];
      await southWithCompression.getFile(fileInfo, item);

      expect(addContentCallback).toHaveBeenCalledWith('southId', {
        type: 'any',
        filePath: path.resolve('cacheFolder', 'tmp', 'test.csv')
      });
    });

    it('should query files', async () => {
      const fileInfo = createMockFileInfo('test.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));

      mockFtpClient.list.mockResolvedValue([fileInfo]);
      mockFtpClient.downloadTo.mockResolvedValue(undefined);
      mockFtpClient.remove.mockResolvedValue(undefined);

      await south.fileQuery([configuration.items[0]]);

      expect(mockFtpClient.list).toHaveBeenCalledWith('input');
      expect(mockFtpClient.downloadTo).toHaveBeenCalledWith(path.resolve('cacheFolder', 'tmp', 'test.csv'), 'input/test.csv');
      expect(addContentCallback).toHaveBeenCalledWith('southId', {
        type: 'any',
        filePath: path.resolve('cacheFolder', 'tmp', 'test.csv')
      });
    });

    it('should handle start error when createFolder fails', async () => {
      (fs.mkdir as jest.Mock).mockReset();
      (fs.mkdir as jest.Mock).mockRejectedValue(new Error('Failed to create folder'));

      const configWithDifferentId = {
        ...configuration,
        id: 'southId-not-test'
      };

      const newSouth = new SouthFtp(configWithDifferentId, addContentCallback, southCacheRepository, logger, 'cacheFolder');

      await newSouth.start();

      expect(southCacheService.createCustomTable).toHaveBeenCalledWith(
        'south_ftp_southId-not-test',
        'filename TEXT PRIMARY KEY, mtime_ms INTEGER'
      );
    });

    it('should handle listFiles error when FTP access fails', async () => {
      mockFtpClient.access.mockRejectedValue(new Error('FTP access failed'));

      const item = configuration.items[0];

      await expect(south.listFiles(item)).rejects.toThrow('FTP access failed');
      expect(mockFtpClient.access).toHaveBeenCalled();
    });

    it('should handle getFile error when FTP access fails', async () => {
      const fileInfo = createMockFileInfo('test.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));

      mockFtpClient.access.mockRejectedValue(new Error('FTP access failed'));

      const item = configuration.items[0];

      await expect(south.getFile(fileInfo, item)).rejects.toThrow('FTP access failed');
    });

    it('should handle download error', async () => {
      const fileInfo = createMockFileInfo('test.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));

      mockFtpClient.access.mockResolvedValue(undefined);
      mockFtpClient.downloadTo.mockRejectedValue(new Error('Download failed'));

      const item = configuration.items[0];

      await expect(south.getFile(fileInfo, item)).rejects.toThrow('Download failed');
    });

    it('should handle FTP close error in listFiles', async () => {
      const fileInfo = createMockFileInfo('test.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));

      mockFtpClient.access.mockResolvedValue(undefined);
      mockFtpClient.list.mockResolvedValue([fileInfo]);
      mockFtpClient.close.mockRejectedValue(new Error('Close failed'));

      const item = configuration.items[0];

      await expect(south.listFiles(item)).rejects.toThrow('Close failed');
    });

    it('should handle FTP close error in getFile', async () => {
      const fileInfo = createMockFileInfo('test.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));

      mockFtpClient.access.mockResolvedValue(undefined);
      mockFtpClient.downloadTo.mockResolvedValue(undefined);
      mockFtpClient.remove.mockResolvedValue(undefined);
      mockFtpClient.close.mockRejectedValue(new Error('Close failed'));

      const item = configuration.items[0];

      await expect(south.getFile(fileInfo, item)).rejects.toThrow('Close failed');
    });

    it('should handle file unlink error after compression', async () => {
      const fileInfo = createMockFileInfo('test.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));

      mockFtpClient.access.mockResolvedValue(undefined);
      mockFtpClient.downloadTo.mockResolvedValue(undefined);
      mockFtpClient.remove.mockResolvedValue(undefined);
      mockFtpClient.close.mockResolvedValue(undefined);
      (compress as jest.Mock).mockResolvedValue(undefined);

      // Reset fs.unlink mock and make it fail for both calls
      (fs.unlink as jest.Mock).mockReset();
      (fs.unlink as jest.Mock).mockRejectedValue(new Error('Unlink failed'));

      const configurationWithCompression = {
        ...configuration,
        settings: { ...configuration.settings, compression: true }
      };

      const southWithCompression = new SouthFtp(
        configurationWithCompression,
        addContentCallback,
        southCacheRepository,
        logger,
        'cacheFolder'
      );
      await southWithCompression.start();

      const item = configuration.items[0];
      await southWithCompression.getFile(fileInfo, item);

      // Should send the compressed file even if unlink fails
      expect(addContentCallback).toHaveBeenCalledWith('southId', {
        type: 'any',
        filePath: path.resolve('cacheFolder', 'tmp', 'test.csv.gz')
      });
    });

    it('should check condition with ignoreModifiedDate false and existing file', async () => {
      const fileInfo = createMockFileInfo('test.log', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));

      southCacheService.getQueryOnCustomTable.mockReturnValue({
        mtimeMs: DateTime.now().toMillis().toString() // File exists with newer timestamp
      });

      const item = configuration.items[1]; // preserveFiles: true, ignoreModifiedDate: false
      const result = south.checkCondition(item, fileInfo);

      expect(result).toBe(false);
    });

    it('should handle empty username and password', async () => {
      const configWithoutCredentials = {
        ...configuration,
        settings: {
          ...configuration.settings,
          username: '',
          password: ''
        }
      };

      const southWithoutCredentials = new SouthFtp(
        configWithoutCredentials,
        addContentCallback,
        southCacheRepository,
        logger,
        'cacheFolder'
      );

      mockFtpClient.access.mockResolvedValue(undefined);
      mockFtpClient.close.mockResolvedValue(undefined);

      await southWithoutCredentials.testConnection();

      expect(mockFtpClient.access).toHaveBeenCalledWith({
        host: '127.0.0.1',
        port: 21,
        user: '',
        password: '',
        secure: false
      });
    });

    it('should handle file without modifiedAt date', async () => {
      const fileInfoWithoutDate: FileInfo = {
        name: 'test.csv',
        type: '-' as unknown as FileInfo['type'],
        size: 100,
        modifiedAt: undefined,
        rawModifiedAt: '',
        permissions: { user: 6, group: 4, world: 4 },
        hardLinkCount: 1,
        link: undefined,
        group: 'group',
        user: 'user',
        uniqueID: 'unique',
        isDirectory: false,
        isSymbolicLink: false,
        isFile: true,
        date: new Date()
      } as unknown as FileInfo;

      const item = configuration.items[0];
      const result = south.checkCondition(item, fileInfoWithoutDate);
      expect(result).toBe(false);
    });

    it('should handle start method when connector id is not test', async () => {
      const nonTestConfig = {
        ...configuration,
        id: 'southId-not-test'
      };

      const nonTestSouth = new SouthFtp(nonTestConfig, addContentCallback, southCacheRepository, logger, 'cacheFolder');

      // Clear previous calls to createCustomTable
      southCacheService.createCustomTable.mockClear();

      await nonTestSouth.start();

      // When connector id is not 'test', createCustomTable should be called
      expect(southCacheService.createCustomTable).toHaveBeenCalledWith(
        'south_ftp_southId-not-test',
        'filename TEXT PRIMARY KEY, mtime_ms INTEGER'
      );
    });

    it('should handle start method when connector id is not test and createFolder succeeds', async () => {
      const nonTestConfig = {
        ...configuration,
        id: 'southId-not-test'
      };

      // Mock createFolder to succeed
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);

      const nonTestSouth = new SouthFtp(nonTestConfig, addContentCallback, southCacheRepository, logger, 'cacheFolder');

      // Clear previous calls to createCustomTable
      southCacheService.createCustomTable.mockClear();

      await nonTestSouth.start();

      // When connector id is not 'test', the condition this.connector.id !== 'test' should be true
      // and createCustomTable should be called
      expect(southCacheService.createCustomTable).toHaveBeenCalledWith(
        'south_ftp_southId-not-test',
        'filename TEXT PRIMARY KEY, mtime_ms INTEGER'
      );
    });

    it('should handle preserveFiles with ignoreModifiedDate true', async () => {
      const fileInfo = createMockFileInfo('test.txt', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));

      const item = configuration.items[2]; // preserveFiles: true, ignoreModifiedDate: true
      const result = south.checkCondition(item, fileInfo);

      // With ignoreModifiedDate: true, it should return true regardless of modified time
      expect(result).toBe(true);
    });

    it('should handle regex not matching', async () => {
      const fileInfo = createMockFileInfo('test.xml', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));

      const item = configuration.items[0]; // regex: '.*.csv'
      const result = south.checkCondition(item, fileInfo);

      expect(result).toBe(false);
    });

    it('should get modified time when file exists in cache', async () => {
      southCacheService.getQueryOnCustomTable.mockReturnValue({
        mtimeMs: '123456789'
      });

      const result = south.getModifiedTime('test.csv');

      expect(result).toBe(123456789);
      expect(southCacheService.getQueryOnCustomTable).toHaveBeenCalledWith(
        'SELECT mtime_ms AS mtimeMs FROM "south_ftp_southId" WHERE filename = ?',
        ['test.csv']
      );
    });

    it('should return 0 when file does not exist in cache', async () => {
      southCacheService.getQueryOnCustomTable.mockReturnValue(null);

      const result = south.getModifiedTime('nonexistent.csv');

      expect(result).toBe(0);
    });

    // Test the specific error handling in getFile method
    it('should handle file access and close properly even with errors', async () => {
      const fileInfo = createMockFileInfo('test.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));

      mockFtpClient.access.mockResolvedValue(undefined);
      mockFtpClient.downloadTo.mockResolvedValue(undefined);
      mockFtpClient.remove.mockResolvedValue(undefined);
      mockFtpClient.close.mockResolvedValue(undefined);

      const item = configuration.items[0];
      await south.getFile(fileInfo, item);

      expect(mockFtpClient.access).toHaveBeenCalled();
      expect(mockFtpClient.downloadTo).toHaveBeenCalled();
      expect(mockFtpClient.close).toHaveBeenCalled();
    });

    it('should handle try-catch blocks properly in getFile with compression error and unlink error', async () => {
      const fileInfo = createMockFileInfo('test.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));

      mockFtpClient.access.mockResolvedValue(undefined);
      mockFtpClient.downloadTo.mockResolvedValue(undefined);
      mockFtpClient.remove.mockResolvedValue(undefined);
      mockFtpClient.close.mockResolvedValue(undefined);
      (compress as jest.Mock).mockRejectedValue(new Error('Compression failed'));
      (fs.unlink as jest.Mock).mockRejectedValue(new Error('Unlink failed'));

      const configurationWithCompression = {
        ...configuration,
        settings: { ...configuration.settings, compression: true }
      };

      const southWithCompression = new SouthFtp(
        configurationWithCompression,
        addContentCallback,
        southCacheRepository,
        logger,
        'cacheFolder'
      );
      await southWithCompression.start();

      const item = configuration.items[0];
      await southWithCompression.getFile(fileInfo, item);

      // Should send the original file when compression fails
      expect(addContentCallback).toHaveBeenCalledWith('southId', {
        type: 'any',
        filePath: path.resolve('cacheFolder', 'tmp', 'test.csv')
      });
    });

    it('should handle password decryption', async () => {
      const { encryptionService } = jest.requireMock('../../service/encryption.service');
      (encryptionService.decryptText as jest.Mock).mockResolvedValue('decrypted-password');

      const configWithEncryptedPassword = {
        ...configuration,
        settings: {
          ...configuration.settings,
          password: 'encrypted-password'
        }
      };

      const southWithEncryptedPassword = new SouthFtp(
        configWithEncryptedPassword,
        addContentCallback,
        southCacheRepository,
        logger,
        'cacheFolder'
      );

      mockFtpClient.access.mockResolvedValue(undefined);
      mockFtpClient.close.mockResolvedValue(undefined);

      await southWithEncryptedPassword.testConnection();

      expect(encryptionService.decryptText).toHaveBeenCalledWith('encrypted-password');
      expect(mockFtpClient.access).toHaveBeenCalledWith({
        host: '127.0.0.1',
        port: 21,
        user: 'user',
        password: 'decrypted-password',
        secure: false
      });
    });

    it('should handle file with modifiedAt date that is newer than cached version', async () => {
      const fileInfo = createMockFileInfo('test.log', new Date(DateTime.now().minus({ minutes: 1 }).toMillis()));

      // Mock that the file exists in cache with an older timestamp
      southCacheService.getQueryOnCustomTable.mockReturnValue({
        mtimeMs: DateTime.now().minus({ minutes: 5 }).toMillis().toString() // Older timestamp
      });

      const item = configuration.items[1]; // preserveFiles: true, ignoreModifiedDate: false
      const result = south.checkCondition(item, fileInfo);

      // Should return true because the file is newer than the cached version
      expect(result).toBe(true);
    });

    it('should handle file with modifiedAt date that is older than cached version', async () => {
      const fileInfo = createMockFileInfo('test.log', new Date(DateTime.now().minus({ minutes: 5 }).toMillis()));

      // Mock that the file exists in cache with a newer timestamp
      southCacheService.getQueryOnCustomTable.mockReturnValue({
        mtimeMs: DateTime.now().minus({ minutes: 1 }).toMillis().toString() // Newer timestamp
      });

      const item = configuration.items[1]; // preserveFiles: true, ignoreModifiedDate: false
      const result = south.checkCondition(item, fileInfo);

      // Should return false because the file is older than the cached version
      expect(result).toBe(false);
    });

    it('should handle file with undefined modifiedAt date in getFile', async () => {
      const fileInfoWithoutDate: FileInfo = {
        name: 'test.csv',
        type: '-' as unknown as FileInfo['type'],
        size: 100,
        modifiedAt: undefined,
        rawModifiedAt: '',
        permissions: { user: 6, group: 4, world: 4 },
        hardLinkCount: 1,
        link: undefined,
        group: 'group',
        user: 'user',
        uniqueID: 'unique',
        isDirectory: false,
        isSymbolicLink: false,
        isFile: true,
        date: new Date()
      } as unknown as FileInfo;

      mockFtpClient.access.mockResolvedValue(undefined);
      mockFtpClient.downloadTo.mockResolvedValue(undefined);
      mockFtpClient.remove.mockResolvedValue(undefined);
      mockFtpClient.close.mockResolvedValue(undefined);

      const item = configuration.items[1]; // preserveFiles: true
      await south.getFile(fileInfoWithoutDate, item);

      // Should use Date.now() when modifiedAt is undefined
      expect(mockFtpClient.access).toHaveBeenCalled();
      expect(mockFtpClient.downloadTo).toHaveBeenCalled();
      expect(mockFtpClient.close).toHaveBeenCalled();
    });

    it('should handle file unlink error in non-compression mode', async () => {
      const fileInfo = createMockFileInfo('test.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));

      mockFtpClient.access.mockResolvedValue(undefined);
      mockFtpClient.downloadTo.mockResolvedValue(undefined);
      mockFtpClient.remove.mockResolvedValue(undefined);
      mockFtpClient.close.mockResolvedValue(undefined);

      // Reset fs.unlink mock and make it fail
      (fs.unlink as jest.Mock).mockReset();
      (fs.unlink as jest.Mock).mockRejectedValue(new Error('Unlink failed'));

      const item = configuration.items[0];
      await south.getFile(fileInfo, item);

      // Should still send the file even if unlink fails
      expect(addContentCallback).toHaveBeenCalledWith('southId', {
        type: 'any',
        filePath: path.resolve('cacheFolder', 'tmp', 'test.csv')
      });
    });

    it('should update modified time', () => {
      const filename = 'test.csv';
      const mtimeMs = 123456789;

      south.updateModifiedTime(filename, mtimeMs);

      expect(southCacheService.runQueryOnCustomTable).toHaveBeenCalledWith(
        'INSERT INTO "south_ftp_southId" (filename, mtime_ms) VALUES (?, ?) ON CONFLICT(filename) DO UPDATE SET mtime_ms = ?',
        [filename, mtimeMs, mtimeMs]
      );
    });

    it('should handle compression error and unlink error', async () => {
      const fileInfo = createMockFileInfo('test.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));

      mockFtpClient.access.mockResolvedValue(undefined);
      mockFtpClient.downloadTo.mockResolvedValue(undefined);
      mockFtpClient.remove.mockResolvedValue(undefined);
      mockFtpClient.close.mockResolvedValue(undefined);
      (compress as jest.Mock).mockRejectedValue(new Error('Compression failed'));

      // Reset fs.unlink mock and make it fail
      (fs.unlink as jest.Mock).mockReset();
      (fs.unlink as jest.Mock).mockRejectedValue(new Error('Unlink failed'));

      const configurationWithCompression = {
        ...configuration,
        settings: { ...configuration.settings, compression: true }
      };

      const southWithCompression = new SouthFtp(
        configurationWithCompression,
        addContentCallback,
        southCacheRepository,
        logger,
        'cacheFolder'
      );
      await southWithCompression.start();

      const item = configuration.items[0];
      await southWithCompression.getFile(fileInfo, item);

      // Should send the original file when compression fails
      expect(addContentCallback).toHaveBeenCalledWith('southId', {
        type: 'any',
        filePath: path.resolve('cacheFolder', 'tmp', 'test.csv')
      });
    });
  });
});
