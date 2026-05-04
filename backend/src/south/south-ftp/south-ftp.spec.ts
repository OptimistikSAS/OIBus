import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import testData from '../../tests/utils/test-data';
import {mockModule, reloadModule} from '../../tests/utils/test-utils';
import SouthCacheRepositoryMock from '../../tests/__mocks__/repository/cache/south-cache-repository.mock';
import SouthCacheServiceMock from '../../tests/__mocks__/service/south-cache-service.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';
import type { SouthConnectorEntity } from '../../model/south-connector.model';
import type { SouthFTPItemSettings, SouthFTPSettings } from '../../../shared/model/south-settings.model';
import { DateTime } from 'luxon';
import type { AccessOptions, FileInfo } from 'basic-ftp';
import type SouthFtpClass from './south-ftp';

const nodeRequire = createRequire(import.meta.url);

describe('SouthFTP', () => {
  let SouthFtp: typeof SouthFtpClass;
  let south: SouthFtpClass;

  const logger = new PinoLogger();
  const addContentCallback = mock.fn(async (_southId: string, _data: unknown, _queryTime: string, _items: unknown) => undefined);
  const southCacheRepository = new SouthCacheRepositoryMock() as unknown as SouthCacheRepository;
  let southCacheService: SouthCacheServiceMock;

  const mockFtpClient = {
    access: mock.fn(async (_options?: AccessOptions) => undefined),
    list: mock.fn(async (_path?: string) => [] as Array<FileInfo>),
    downloadTo: mock.fn(async (_dest: string, _remote: string) => undefined),
    remove: mock.fn(async (_path: string) => undefined),
    close: mock.fn(() => undefined)
  };

  const ftpExports = {
    __esModule: true,
    Client: mock.fn(function () {
      return mockFtpClient;
    })
  };

  const utilsExports = {
    checkAge: mock.fn(() => true),
    compress: mock.fn(async (_input: string, _output: string) => undefined),
    delay: mock.fn(async () => undefined),
    generateIntervals: mock.fn(() => []),
    groupItemsByGroup: mock.fn(() => []),
    validateCronExpression: mock.fn(() => ({ expression: '' }))
  };

  const encryptionExports = {
    __esModule: true,
    encryptionService: {
      decryptText: mock.fn(async (_text?: string | null) => 'decrypted-password')
    }
  };

  before(() => {
    mockModule(nodeRequire, 'basic-ftp', ftpExports);
    mockModule(nodeRequire, '../../service/utils', utilsExports);
    mockModule(nodeRequire, '../../service/encryption.service', encryptionExports);
    mockModule(nodeRequire, '../../service/south-cache.service', {
      __esModule: true,
      default: function () {
        return southCacheService;
      }
    });
    SouthFtp = reloadModule<{ default: typeof SouthFtpClass }>(nodeRequire, './south-ftp').default;
  });

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
    groups: [],
    createdBy: '',
    updatedBy: '',
    createdAt: '',
    updatedAt: ''
  };

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

  beforeEach(() => {
    southCacheService = new SouthCacheServiceMock();
    addContentCallback.mock.resetCalls();

    ftpExports.Client.mock.resetCalls();

    mockFtpClient.access = mock.fn(async (_options?: AccessOptions) => undefined);
    mockFtpClient.list = mock.fn(async (_path?: string) => [] as Array<FileInfo>);
    mockFtpClient.downloadTo = mock.fn(async (_dest: string, _remote: string) => undefined);
    mockFtpClient.remove = mock.fn(async (_path: string) => undefined);
    mockFtpClient.close = mock.fn(() => undefined);

    utilsExports.checkAge.mock.resetCalls();
    utilsExports.checkAge.mock.mockImplementation(() => true);
    utilsExports.compress.mock.resetCalls();
    utilsExports.compress.mock.mockImplementation(async (_input: string, _output: string) => undefined);

    encryptionExports.encryptionService.decryptText.mock.resetCalls();
    encryptionExports.encryptionService.decryptText.mock.mockImplementation(async (_text?: string | null) => 'decrypted-password');

    southCacheService.createCustomTable.mock.mockImplementation(() => undefined);
    southCacheService.getQueryOnCustomTable.mock.mockImplementation(() => null);
    southCacheService.runQueryOnCustomTable.mock.mockImplementation(() => undefined);

    mock.method(fs, 'mkdir', async () => undefined);
    mock.method(fs, 'unlink', async () => undefined);

    mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date(testData.constants.dates.FAKE_NOW) });

    south = new SouthFtp(configuration, addContentCallback, southCacheRepository, logger, 'cacheFolder');
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  describe('with valid configuration', () => {
    beforeEach(async () => {
      await south.start();
    });

    it('should properly start', () => {
      assert.ok(southCacheService.createItemValueTable.mock.calls.some(c => c.arguments[0] === 'southId'));
    });

    it('should test connection', async () => {
      mockFtpClient.access.mock.mockImplementation(async () => undefined);
      mockFtpClient.close.mock.mockImplementation(async () => undefined);

      const testResult = await south.testConnection();

      assert.deepStrictEqual(mockFtpClient.access.mock.calls[0].arguments[0], {
        host: '127.0.0.1',
        port: 21,
        user: 'user',
        password: 'decrypted-password',
        secure: false
      });
      assert.ok(mockFtpClient.close.mock.calls.length > 0);
      assert.deepStrictEqual(testResult, {
        items: [
          { key: 'Host', value: `${configuration.settings.host}:${configuration.settings.port}` },
          { key: 'Username', value: configuration.settings.username }
        ]
      });
    });

    it('should test connection with error', async () => {
      mockFtpClient.access.mock.mockImplementation(async () => {
        throw new Error('Connection failed');
      });

      await assert.rejects(south.testConnection(), new Error('Access error on "127.0.0.1:21": Connection failed'));
    });

    it('should test item', async () => {
      const fileInfo = createMockFileInfo('test.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));

      mock.method(south, 'listFiles', async () => [fileInfo]);

      const item = configuration.items[0];
      const result = await south.testItem(item, { history: undefined });

      assert.strictEqual(result.type, 'time-values');
      const content = (result as { type: string; content: Array<{ pointId: string; timestamp: string; data: { value: string } }> }).content;
      assert.strictEqual(content.length, 1);
      assert.strictEqual(content[0].pointId, 'item1');
      assert.ok(typeof content[0].timestamp === 'string');
      assert.deepStrictEqual(content[0].data, { value: 'test.csv' });
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

      mock.method(south, 'listFiles', async () => [fileInfoWithoutDate]);

      const item = configuration.items[0];
      const result = await south.testItem(item, { history: undefined });

      assert.strictEqual(result.type, 'time-values');
      assert.strictEqual((result as { type: string; content: Array<unknown> }).content.length, 1);
    });

    it('should list files', async () => {
      const fileInfo = createMockFileInfo('test.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));

      mockFtpClient.list.mock.mockImplementation(async () => [fileInfo]);

      const item = configuration.items[0];
      const files = await south.listFiles(item, []);

      assert.deepStrictEqual(files, [fileInfo]);
      assert.deepStrictEqual(mockFtpClient.access.mock.calls[0].arguments[0], {
        host: '127.0.0.1',
        port: 21,
        user: 'user',
        password: 'decrypted-password',
        secure: false
      });
      assert.deepStrictEqual(mockFtpClient.list.mock.calls[0].arguments[0], 'input');
      assert.ok(mockFtpClient.close.mock.calls.length > 0);
    });

    it('should filter files by regex', async () => {
      const fileInfo1 = createMockFileInfo('test.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));
      const fileInfo2 = createMockFileInfo('test.txt', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));

      mockFtpClient.list.mock.mockImplementation(async () => [fileInfo1, fileInfo2]);

      const item = configuration.items[0]; // regex: '.*.csv'
      const files = await south.listFiles(item, []);

      assert.deepStrictEqual(files, [fileInfo1]);
    });

    it('should get file', async () => {
      const fileInfo = createMockFileInfo('test.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));

      const item = configuration.items[0]; // preserveFiles: false
      await south.getFile(fileInfo, item, []);

      assert.deepStrictEqual(mockFtpClient.downloadTo.mock.calls[0].arguments[0], path.resolve('cacheFolder', 'tmp', 'test.csv'));
      assert.deepStrictEqual(mockFtpClient.downloadTo.mock.calls[0].arguments[1], 'input/test.csv');
      assert.deepStrictEqual(mockFtpClient.remove.mock.calls[0].arguments[0], 'input/test.csv');
      assert.strictEqual(addContentCallback.mock.calls[0].arguments[0], 'southId');
      assert.deepStrictEqual(addContentCallback.mock.calls[0].arguments[1], {
        type: 'any',
        filePath: path.resolve('cacheFolder', 'tmp', 'test.csv')
      });
      assert.strictEqual(addContentCallback.mock.calls[0].arguments[2], testData.constants.dates.FAKE_NOW);
      assert.deepStrictEqual(addContentCallback.mock.calls[0].arguments[3], [item]);
    });

    it('should get file with compression', async () => {
      const fileInfo = createMockFileInfo('test.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));

      utilsExports.compress.mock.mockImplementation(async () => undefined);

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
      await southWithCompression.getFile(fileInfo, item, []);

      assert.deepStrictEqual(utilsExports.compress.mock.calls[0].arguments[0], path.resolve('cacheFolder', 'tmp', 'test.csv'));
      assert.deepStrictEqual(utilsExports.compress.mock.calls[0].arguments[1], path.resolve('cacheFolder', 'tmp', 'test.csv.gz'));
      assert.deepStrictEqual(addContentCallback.mock.calls[0].arguments[1], {
        type: 'any',
        filePath: path.resolve('cacheFolder', 'tmp', 'test.csv.gz')
      });
      assert.deepStrictEqual(addContentCallback.mock.calls[0].arguments[3], [item]);
    });

    it('should preserve files when configured', async () => {
      const fileInfo = createMockFileInfo('test.log', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));

      southCacheService.getItemLastValue.mock.mockImplementation(() => null);

      const item = configuration.items[1]; // preserveFiles: true
      await south.getFile(fileInfo, item, []);

      assert.strictEqual(mockFtpClient.remove.mock.calls.length, 0);
    });

    it('should handle file removal error', async () => {
      const fileInfo = createMockFileInfo('test.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));

      mockFtpClient.remove.mock.mockImplementation(async () => {
        throw new Error('Remove failed');
      });

      const item = configuration.items[0];
      await south.getFile(fileInfo, item, []);

      assert.deepStrictEqual(mockFtpClient.remove.mock.calls[0].arguments[0], 'input/test.csv');
      assert.deepStrictEqual(addContentCallback.mock.calls[0].arguments[1], {
        type: 'any',
        filePath: path.resolve('cacheFolder', 'tmp', 'test.csv')
      });
      assert.deepStrictEqual(addContentCallback.mock.calls[0].arguments[3], [item]);
    });

    it('should handle compression error', async () => {
      const fileInfo = createMockFileInfo('test.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));

      utilsExports.compress.mock.mockImplementation(async () => {
        throw new Error('Compression failed');
      });

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
      await southWithCompression.getFile(fileInfo, item, []);

      assert.deepStrictEqual(addContentCallback.mock.calls[0].arguments[1], {
        type: 'any',
        filePath: path.resolve('cacheFolder', 'tmp', 'test.csv')
      });
    });

    it('should list files recursively when recursive is true', async () => {
      const configRecursive = {
        ...configuration,
        settings: { ...configuration.settings },
        items: configuration.items.map(item => ({
          ...item,
          settings: { ...item.settings, recursive: true }
        })),
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      };
      const southRecursive = new SouthFtp(configRecursive, addContentCallback, southCacheRepository, logger, 'cacheFolder');
      await southRecursive.start();

      const dirEntry = {
        ...createMockFileInfo('subdir', new Date(DateTime.now().minus({ minutes: 2 }).toMillis())),
        name: 'subdir',
        isDirectory: true,
        isFile: false
      } as FileInfo;
      const fileInSubdir = {
        ...createMockFileInfo('file.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis())),
        isDirectory: false,
        isFile: true
      } as FileInfo;
      const fileFailsCondition = {
        ...createMockFileInfo('other.xml', new Date(DateTime.now().minus({ minutes: 2 }).toMillis())),
        isDirectory: false,
        isFile: true
      } as FileInfo;

      let listCallCount = 0;
      mockFtpClient.list.mock.mockImplementation(async () => {
        listCallCount++;
        if (listCallCount === 1) return [dirEntry];
        return [fileInSubdir, fileFailsCondition];
      });

      const item = configRecursive.items[0];
      const result = await southRecursive.listFiles(item, []);

      assert.deepStrictEqual(mockFtpClient.list.mock.calls[0].arguments[0], 'input');
      assert.deepStrictEqual(mockFtpClient.list.mock.calls[1].arguments[0], 'input/subdir');
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].name, 'subdir/file.csv');
    });

    it('should query files with file that has zero size', async () => {
      const fileWithNoSize = {
        ...createMockFileInfo('test.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis())),
        size: 0
      };

      mockFtpClient.list.mock.mockImplementation(async () => [fileWithNoSize]);

      await south.directQuery([configuration.items[0]]);

      assert.deepStrictEqual(mockFtpClient.downloadTo.mock.calls[0].arguments[0], path.resolve('cacheFolder', 'tmp', 'test.csv'));
    });

    it('should query files', async () => {
      const fileInfo = createMockFileInfo('test.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));

      mockFtpClient.list.mock.mockImplementation(async () => [fileInfo]);

      await south.directQuery([configuration.items[0]]);

      assert.deepStrictEqual(mockFtpClient.list.mock.calls[0].arguments[0], 'input');
      assert.deepStrictEqual(mockFtpClient.downloadTo.mock.calls[0].arguments[0], path.resolve('cacheFolder', 'tmp', 'test.csv'));
      assert.deepStrictEqual(mockFtpClient.downloadTo.mock.calls[0].arguments[1], 'input/test.csv');
      assert.deepStrictEqual(addContentCallback.mock.calls[0].arguments[1], {
        type: 'any',
        filePath: path.resolve('cacheFolder', 'tmp', 'test.csv')
      });
      assert.deepStrictEqual(addContentCallback.mock.calls[0].arguments[3], [configuration.items[0]]);
    });

    it('should respect max files limit and skip remaining files', async () => {
      const configWithLimit = {
        ...configuration,
        settings: { ...configuration.settings },
        items: configuration.items.map(item => ({
          ...item,
          settings: { ...item.settings, maxFiles: 2, maxSize: 0 }
        })),
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      };
      const southWithLimit = new SouthFtp(configWithLimit, addContentCallback, southCacheRepository, logger, 'cacheFolder');
      await southWithLimit.start();

      const file1 = createMockFileInfo('file1.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));
      const file2 = createMockFileInfo('file2.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));
      const file3 = createMockFileInfo('file3.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));

      mockFtpClient.list.mock.mockImplementation(async () => [file1, file2, file3]);

      await southWithLimit.directQuery([configWithLimit.items[0]]);

      assert.strictEqual(mockFtpClient.downloadTo.mock.calls.length, 2);
      assert.ok(
        logger.debug.mock.calls.some(
          (c: { arguments: Array<unknown> }) => c.arguments[0] === 'Max files limit (2) reached for item item1, skipping remaining files'
        )
      );
    });

    it('should respect max files limit and stop file query across items', async () => {
      const configWithLimit = {
        ...configuration,
        settings: { ...configuration.settings },
        items: configuration.items.map(item => ({
          ...item,
          settings: { ...item.settings, maxFiles: 2, maxSize: 0 }
        })),
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      };
      const southWithLimit = new SouthFtp(configWithLimit, addContentCallback, southCacheRepository, logger, 'cacheFolder');
      await southWithLimit.start();

      const file1 = createMockFileInfo('file1.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));
      const file2 = createMockFileInfo('file2.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));
      const file3 = createMockFileInfo('file3.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));

      mockFtpClient.list.mock.mockImplementationOnce(async () => [file1, file2, file3]);

      await southWithLimit.directQuery(configWithLimit.items);

      assert.strictEqual(mockFtpClient.downloadTo.mock.calls.length, 2);
      assert.ok(
        logger.debug.mock.calls.some(
          (c: { arguments: Array<unknown> }) => c.arguments[0] === 'Max files limit (2) reached for item item1, skipping remaining files'
        )
      );
    });

    it('should respect max size limit and skip remaining files', async () => {
      const configWithLimit = {
        ...configuration,
        settings: { ...configuration.settings },
        items: configuration.items.map(item => ({
          ...item,
          settings: { ...item.settings, maxFiles: 0, maxSize: 1 }
        })),
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      };
      const southWithLimit = new SouthFtp(configWithLimit, addContentCallback, southCacheRepository, logger, 'cacheFolder');
      await southWithLimit.start();

      const file1 = { ...createMockFileInfo('file1.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis())), size: 600 * 1024 };
      const file2 = { ...createMockFileInfo('file2.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis())), size: 600 * 1024 };

      mockFtpClient.list.mock.mockImplementation(async () => [file1, file2]);

      await southWithLimit.directQuery([configWithLimit.items[0]]);

      assert.strictEqual(mockFtpClient.downloadTo.mock.calls.length, 1);
      assert.ok(
        logger.debug.mock.calls.some(
          (c: { arguments: Array<unknown> }) => c.arguments[0] === 'Max size limit (1 MB) reached for item item1, skipping remaining files'
        )
      );
    });

    it('should respect max size limit and stop file query across items', async () => {
      const configWithLimit = {
        ...configuration,
        settings: { ...configuration.settings },
        items: configuration.items.map(item => ({
          ...item,
          settings: { ...item.settings, maxFiles: 0, maxSize: 1 }
        })),
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      };
      const southWithLimit = new SouthFtp(configWithLimit, addContentCallback, southCacheRepository, logger, 'cacheFolder');
      await southWithLimit.start();

      const file1 = { ...createMockFileInfo('file1.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis())), size: 512 * 1024 };
      const file2 = { ...createMockFileInfo('file2.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis())), size: 512 * 1024 };
      const file3 = createMockFileInfo('file3.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));

      mockFtpClient.list.mock.mockImplementation(async () => [file1, file2, file3]);

      await southWithLimit.directQuery(configWithLimit.items);

      assert.strictEqual(mockFtpClient.downloadTo.mock.calls.length, 2);
      assert.ok(
        logger.debug.mock.calls.some(
          (c: { arguments: Array<unknown> }) => c.arguments[0] === 'Max size limit (1 MB) reached for item item1, skipping remaining files'
        )
      );
    });

    it('should handle start error when createFolder fails', async () => {
      mock.method(fs, 'mkdir', async () => {
        throw new Error('Failed to create folder');
      });

      const configWithDifferentId = { ...configuration, id: 'southId-not-test' };
      const newSouth = new SouthFtp(configWithDifferentId, addContentCallback, southCacheRepository, logger, 'cacheFolder');

      await newSouth.start();

      assert.ok(southCacheService.createItemValueTable.mock.calls.some(c => c.arguments[0] === 'southId-not-test'));
    });

    it('should handle listFiles error when FTP access fails', async () => {
      mockFtpClient.access.mock.mockImplementation(async () => {
        throw new Error('FTP access failed');
      });

      const item = configuration.items[0];
      await assert.rejects(south.listFiles(item, []), new Error('FTP access failed'));
      assert.ok(mockFtpClient.access.mock.calls.length > 0);
    });

    it('should handle getFile error when FTP access fails', async () => {
      const fileInfo = createMockFileInfo('test.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));

      mockFtpClient.access.mock.mockImplementation(async () => {
        throw new Error('FTP access failed');
      });

      const item = configuration.items[0];
      await assert.rejects(south.getFile(fileInfo, item, []), new Error('FTP access failed'));
    });

    it('should handle download error', async () => {
      const fileInfo = createMockFileInfo('test.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));

      mockFtpClient.downloadTo.mock.mockImplementation(async () => {
        throw new Error('Download failed');
      });

      const item = configuration.items[0];
      await assert.rejects(south.getFile(fileInfo, item, []), new Error('Download failed'));
    });

    it('should handle FTP close error in listFiles', async () => {
      const fileInfo = createMockFileInfo('test.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));

      mockFtpClient.list.mock.mockImplementation(async () => [fileInfo]);
      mockFtpClient.close.mock.mockImplementationOnce(() => {
        throw new Error('Close failed');
      });

      const item = configuration.items[0];
      await assert.rejects(south.listFiles(item, []), new Error('Close failed'));
    });

    it('should handle FTP close error in getFile', async () => {
      const fileInfo = createMockFileInfo('test.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));

      mockFtpClient.downloadTo.mock.mockImplementation(async () => {
        throw new Error('download failed');
      });

      const item = configuration.items[0];
      await assert.rejects(south.getFile(fileInfo, item, []), new Error('download failed'));
    });

    it('should handle file unlink error after compression', async () => {
      const fileInfo = createMockFileInfo('test.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));

      mock.method(fs, 'unlink', async () => {
        throw new Error('Unlink failed');
      });

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
      await southWithCompression.getFile(fileInfo, item, []);

      assert.deepStrictEqual(addContentCallback.mock.calls[0].arguments[1], {
        type: 'any',
        filePath: path.resolve('cacheFolder', 'tmp', 'test.csv.gz')
      });
    });

    it('should handle empty username and password', async () => {
      const configWithoutCredentials = {
        ...configuration,
        settings: { ...configuration.settings, username: '', password: '' }
      };
      const southWithoutCredentials = new SouthFtp(
        configWithoutCredentials,
        addContentCallback,
        southCacheRepository,
        logger,
        'cacheFolder'
      );

      await southWithoutCredentials.testConnection();

      assert.deepStrictEqual(mockFtpClient.access.mock.calls[0].arguments[0], {
        host: '127.0.0.1',
        port: 21,
        user: '',
        password: '',
        secure: false
      });
    });

    it('should handle start method when connector id is not test', async () => {
      const nonTestConfig = { ...configuration, id: 'southId-not-test' };
      const nonTestSouth = new SouthFtp(nonTestConfig, addContentCallback, southCacheRepository, logger, 'cacheFolder');

      southCacheService.createItemValueTable.mock.resetCalls();
      await nonTestSouth.start();

      assert.ok(southCacheService.createItemValueTable.mock.calls.some(c => c.arguments[0] === 'southId-not-test'));
    });

    it('should handle start method when connector id is not test and createFolder succeeds', async () => {
      const nonTestConfig = { ...configuration, id: 'southId-not-test' };

      mock.method(fs, 'mkdir', async () => undefined);

      const nonTestSouth = new SouthFtp(nonTestConfig, addContentCallback, southCacheRepository, logger, 'cacheFolder');
      southCacheService.createItemValueTable.mock.resetCalls();

      await nonTestSouth.start();

      assert.ok(southCacheService.createItemValueTable.mock.calls.some(c => c.arguments[0] === 'southId-not-test'));
    });

    it('should handle preserveFiles with ignoreModifiedDate true', () => {
      const fileInfo = createMockFileInfo('test.txt', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));
      const item = configuration.items[2]; // preserveFiles: true, ignoreModifiedDate: true

      const result = south.checkCondition(item, fileInfo, []);
      assert.strictEqual(result, true);
    });

    it('should handle regex not matching', () => {
      const fileInfo = createMockFileInfo('test.xml', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));
      const item = configuration.items[0]; // regex: '.*.csv'

      const result = south.checkCondition(item, fileInfo, []);
      assert.strictEqual(result, false);
    });

    it('should handle file access and close properly even with errors', async () => {
      const fileInfo = createMockFileInfo('test.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));

      const item = configuration.items[0];
      await south.getFile(fileInfo, item, []);

      assert.ok(mockFtpClient.access.mock.calls.length > 0);
      assert.ok(mockFtpClient.downloadTo.mock.calls.length > 0);
      assert.ok(mockFtpClient.close.mock.calls.length > 0);
    });

    it('should handle try-catch blocks properly in getFile with compression error and unlink error', async () => {
      const fileInfo = createMockFileInfo('test.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));

      utilsExports.compress.mock.mockImplementation(async () => {
        throw new Error('Compression failed');
      });
      mock.method(fs, 'unlink', async () => {
        throw new Error('Unlink failed');
      });

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
      await southWithCompression.getFile(fileInfo, item, []);

      assert.deepStrictEqual(addContentCallback.mock.calls[0].arguments[1], {
        type: 'any',
        filePath: path.resolve('cacheFolder', 'tmp', 'test.csv')
      });
    });

    it('should handle password decryption', async () => {
      encryptionExports.encryptionService.decryptText.mock.mockImplementation(async () => 'decrypted-password');

      const configWithEncryptedPassword = {
        ...configuration,
        settings: { ...configuration.settings, password: 'encrypted-password' }
      };
      const southWithEncryptedPassword = new SouthFtp(
        configWithEncryptedPassword,
        addContentCallback,
        southCacheRepository,
        logger,
        'cacheFolder'
      );

      await southWithEncryptedPassword.testConnection();

      assert.ok(encryptionExports.encryptionService.decryptText.mock.calls.some(c => c.arguments[0] === 'encrypted-password'));
      assert.deepStrictEqual(mockFtpClient.access.mock.calls[0].arguments[0], {
        host: '127.0.0.1',
        port: 21,
        user: 'user',
        password: 'decrypted-password',
        secure: false
      });
    });

    it('should handle file with modifiedAt date that is newer than cached version', () => {
      const fileInfo = createMockFileInfo('test.log', new Date(DateTime.now().minus({ minutes: 1 }).toMillis()));

      southCacheService.getItemLastValue.mock.mockImplementation(() => ({
        value: [{ filename: 'test.log', modifiedTime: DateTime.now().minus({ minutes: 5 }).toMillis() }]
      }));

      const item = configuration.items[1]; // preserveFiles: true, ignoreModifiedDate: false
      const result = south.checkCondition(item, fileInfo, []);

      assert.strictEqual(result, true);
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

      const item = configuration.items[1]; // preserveFiles: true
      await south.getFile(fileInfoWithoutDate, item, []);

      assert.ok(mockFtpClient.access.mock.calls.length > 0);
      assert.ok(mockFtpClient.downloadTo.mock.calls.length > 0);
      assert.ok(mockFtpClient.close.mock.calls.length > 0);
    });

    it('should handle file unlink error in non-compression mode', async () => {
      const fileInfo = createMockFileInfo('test.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));

      mock.method(fs, 'unlink', async () => {
        throw new Error('Unlink failed');
      });

      const item = configuration.items[0];
      await south.getFile(fileInfo, item, []);

      assert.deepStrictEqual(addContentCallback.mock.calls[0].arguments[1], {
        type: 'any',
        filePath: path.resolve('cacheFolder', 'tmp', 'test.csv')
      });
    });

    it('should handle compression error and unlink error', async () => {
      const fileInfo = createMockFileInfo('test.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));

      utilsExports.compress.mock.mockImplementation(async () => {
        throw new Error('Compression failed');
      });
      mock.method(fs, 'unlink', async () => {
        throw new Error('Unlink failed');
      });

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
      await southWithCompression.getFile(fileInfo, item, []);

      assert.deepStrictEqual(addContentCallback.mock.calls[0].arguments[1], {
        type: 'any',
        filePath: path.resolve('cacheFolder', 'tmp', 'test.csv')
      });
    });
  });
});
