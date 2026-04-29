import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import testData from '../../tests/utils/test-data';
import { mockModule, reloadModule, asLogger } from '../../tests/utils/test-utils';
import SouthCacheRepositoryMock from '../../tests/__mocks__/repository/cache/south-cache-repository.mock';
import SouthCacheServiceMock from '../../tests/__mocks__/service/south-cache-service.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import type { SouthFolderScannerItemSettings, SouthFolderScannerSettings } from '../../../shared/model/south-settings.model';
import type { SouthConnectorEntity } from '../../model/south-connector.model';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';
import type SouthFolderScannerClass from './south-folder-scanner';
import { DateTime } from 'luxon';

const nodeRequire = createRequire(import.meta.url);

describe('SouthFolderScanner', () => {
  let SouthFolderScanner: typeof SouthFolderScannerClass;
  let south: SouthFolderScannerClass;

  const logger = new PinoLogger();
  const addContentCallback = mock.fn();
  const southCacheRepository = new SouthCacheRepositoryMock() as unknown as SouthCacheRepository;
  let southCacheService: SouthCacheServiceMock;

  const utilsExports = {
    checkAge: mock.fn(() => true),
    compress: mock.fn(async () => undefined),
    delay: mock.fn(async () => undefined),
    generateIntervals: mock.fn(() => []),
    groupItemsByGroup: mock.fn(() => []),
    validateCronExpression: mock.fn(() => ({ expression: '' }))
  };

  before(() => {
    mockModule(nodeRequire, '../../service/utils', utilsExports);
    mockModule(nodeRequire, '../../service/south-cache.service', {
      __esModule: true,
      default: function () {
        return southCacheService;
      }
    });
    SouthFolderScanner = reloadModule<{ default: typeof SouthFolderScannerClass }>(nodeRequire, './south-folder-scanner').default;
  });

  let configuration: SouthConnectorEntity<SouthFolderScannerSettings, SouthFolderScannerItemSettings>;

  beforeEach(() => {
    southCacheService = new SouthCacheServiceMock();
    utilsExports.checkAge = mock.fn(() => true);
    utilsExports.compress = mock.fn(async () => undefined);
    addContentCallback.mock.resetCalls();

    configuration = {
      id: 'southId',
      name: 'south',
      type: 'folder-scanner',
      description: 'my test connector',
      enabled: true,
      settings: {
        inputFolder: 'inputFolder',
        compression: false
      },
      groups: [],
      items: [
        {
          id: 'id1',
          name: 'item1',
          enabled: true,
          settings: {
            regex: '.*\\.csv',
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
        }
      ],
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };

    south = new SouthFolderScanner(configuration, addContentCallback, southCacheRepository, asLogger(logger), 'cacheFolder');
  });

  afterEach(() => {
    mock.restoreAll();
  });

  describe('testConnection', () => {
    it('should pass testConnection if folder exists, is readable, and is a directory', async () => {
      const accessMock = mock.method(
        fs,
        'access',
        mock.fn(async () => undefined)
      );
      mock.method(
        fs,
        'stat',
        mock.fn(async () => ({ isDirectory: () => true, mtimeMs: 1600000000000, size: 1024 }))
      );

      const result = await south.testConnection();
      assert.deepStrictEqual(result, { items: [{ key: 'Folder', value: path.resolve('inputFolder') }] });
      assert.ok(accessMock.mock.calls.some(c => String(c.arguments[0]).includes('inputFolder') && c.arguments[1] === fs.constants.F_OK));
      assert.ok(accessMock.mock.calls.some(c => String(c.arguments[0]).includes('inputFolder') && c.arguments[1] === fs.constants.R_OK));
    });

    it('should throw if folder does not exist', async () => {
      mock.method(
        fs,
        'access',
        mock.fn(async () => {
          throw new Error('ENOENT');
        })
      );

      await assert.rejects(south.testConnection(), /Folder ".*inputFolder" does not exist: ENOENT/);
    });

    it('should throw if folder is not readable', async () => {
      let accessCallCount = 0;
      mock.method(
        fs,
        'access',
        mock.fn(async () => {
          accessCallCount++;
          if (accessCallCount === 2) throw new Error('EACCES');
        })
      );

      await assert.rejects(south.testConnection(), /Read access error on ".*inputFolder": EACCES/);
    });

    it('should throw if folder is a file, not a directory', async () => {
      mock.method(
        fs,
        'access',
        mock.fn(async () => undefined)
      );
      mock.method(
        fs,
        'stat',
        mock.fn(async () => ({ isDirectory: () => false }))
      );

      await assert.rejects(south.testConnection(), /is not a directory/);
    });
  });

  describe('testItem', () => {
    it('should return matched files as time values', async () => {
      mock.method(
        fs,
        'access',
        mock.fn(async () => undefined)
      );
      mock.method(
        fs,
        'stat',
        mock.fn(async (_p: string) => ({ isDirectory: () => true, mtimeMs: 1600000000000, size: 512 }))
      );
      mock.method(
        fs,
        'readdir',
        mock.fn(async () => ['file1.csv', 'file2.csv', 'other.txt'])
      );
      utilsExports.checkAge = mock.fn(() => true);

      const result = await south.testItem(configuration.items[0], {});
      assert.strictEqual(result.type, 'time-values');
      assert.strictEqual((result as { type: string; content: Array<unknown> }).content.length, 2);
    });

    it('should return empty time values when no files match the regex', async () => {
      mock.method(
        fs,
        'access',
        mock.fn(async () => undefined)
      );
      mock.method(
        fs,
        'stat',
        mock.fn(async () => ({ isDirectory: () => true, mtimeMs: 1600000000000, size: 512 }))
      );
      mock.method(
        fs,
        'readdir',
        mock.fn(async () => ['other.txt', 'another.log'])
      );
      utilsExports.checkAge = mock.fn(() => true);

      const result = await south.testItem(configuration.items[0], {});
      assert.strictEqual(result.type, 'time-values');
      assert.strictEqual((result as { type: string; content: Array<unknown> }).content.length, 0);
    });
  });

  describe('listFilesRecursively', () => {
    it('should list files directly in the base dir without recursion', async () => {
      const mockDirents = [
        { name: 'file1.csv', isDirectory: () => false, isFile: () => true },
        { name: 'subfolder', isDirectory: () => true, isFile: () => false }
      ];
      mock.method(
        fs,
        'readdir',
        mock.fn(async () => mockDirents)
      );

      const files = await (south as unknown as Record<string, (...args: Array<unknown>) => Promise<Array<string>>>)['listFilesRecursively'](
        '/base',
        '/base',
        configuration.items[0]
      );
      assert.deepStrictEqual(files, ['file1.csv']);
    });

    it('should list files recursively if enabled in settings', async () => {
      configuration.items[0].settings.recursive = true;

      const rootDirents = [
        { name: 'file1.csv', isDirectory: () => false, isFile: () => true },
        { name: 'subfolder', isDirectory: () => true, isFile: () => false }
      ];
      const subDirents = [{ name: 'file2.csv', isDirectory: () => false, isFile: () => true }];

      let readdirCallCount = 0;
      mock.method(
        fs,
        'readdir',
        mock.fn(async () => {
          readdirCallCount++;
          return readdirCallCount === 1 ? rootDirents : subDirents;
        })
      );

      const files = await (south as unknown as Record<string, (...args: Array<unknown>) => Promise<Array<string>>>)['listFilesRecursively'](
        '/base',
        '/base',
        configuration.items[0]
      );
      assert.strictEqual(files.length, 2);
      assert.ok(files.includes('file1.csv'));
      assert.ok(files.includes(path.join('subfolder', 'file2.csv')));
    });
  });

  describe('directQuery', () => {
    let sendFileMock: ReturnType<typeof mock.fn>;

    beforeEach(() => {
      (south as unknown as Record<string, unknown>)['listFilesRecursively'] = mock.fn(async () => ['file1.csv', 'file2.csv', 'ignore.txt']);
      sendFileMock = mock.method(
        south,
        'sendFile',
        mock.fn(async () => undefined)
      );
      mock.method(
        fs,
        'stat',
        mock.fn(async () => ({ mtimeMs: 1600000000000, size: 1024 }))
      );
      mock.method(
        fs,
        'unlink',
        mock.fn(async () => undefined)
      );
    });

    it('should process matched files, call sendFile, and unlink files if preserveFiles is false', async () => {
      await south.directQuery(configuration.items);

      assert.strictEqual(sendFileMock.mock.calls.length, 2);
    });

    it('should preserve files and return their updated modify times if preserveFiles is true', async () => {
      configuration.items[0].settings.preserveFiles = true;
      southCacheService.getItemLastValue = mock.fn(() => ({ value: [{ filename: 'file1.csv', modifiedTime: 1000 }] }));

      const result = await south.directQuery(configuration.items);

      const unlinkMock = fs.unlink as unknown as { mock: { calls: Array<unknown> } };
      assert.strictEqual(unlinkMock.mock.calls.length, 0);
      assert.strictEqual(result.length, 2);
      assert.strictEqual(result.find((f: { filename: string }) => f.filename === 'file1.csv')?.modifiedTime, 1600000000000);
      assert.strictEqual(result.find((f: { filename: string }) => f.filename === 'file2.csv')?.modifiedTime, 1600000000000);
    });

    it('should safely log and ignore unlink errors', async () => {
      mock.method(
        fs,
        'unlink',
        mock.fn(async () => {
          throw new Error('Cannot delete');
        })
      );

      await south.directQuery(configuration.items);

      assert.ok(logger.error.mock.calls.some(c => (c.arguments[0] as string).includes('Error while removing')));
    });

    it('should stop processing if maxFiles limit is reached', async () => {
      configuration.items[0].settings.maxFiles = 1;

      await south.directQuery(configuration.items);

      assert.strictEqual(sendFileMock.mock.calls.length, 1);
      assert.ok(logger.debug.mock.calls.some(c => (c.arguments[0] as string).includes('Max files limit (1) reached')));
    });

    it('should stop processing if maxSize limit is reached', async () => {
      configuration.items[0].settings.maxSize = 1;

      mock.method(
        fs,
        'stat',
        mock.fn(async () => ({ mtimeMs: 1600000000000, size: 600 * 1024 }))
      );

      await south.directQuery(configuration.items);

      assert.strictEqual(sendFileMock.mock.calls.length, 1);
      assert.ok(logger.debug.mock.calls.some(c => (c.arguments[0] as string).includes('Max size limit (1 MB) reached')));
    });
  });

  describe('sendFile', () => {
    const mockQueryTime = DateTime.now().toUTC().toISO()!;
    let addContentMock: ReturnType<typeof mock.fn>;

    beforeEach(() => {
      addContentMock = mock.method(
        south,
        'addContent',
        mock.fn(async () => undefined)
      );
    });

    it('should send the raw file if compression is disabled', async () => {
      await south.sendFile(configuration.items[0], 'file1.csv', mockQueryTime);

      assert.strictEqual(addContentMock.mock.calls.length, 1);
      assert.deepStrictEqual(addContentMock.mock.calls[0].arguments[0], {
        type: 'any',
        filePath: path.resolve('inputFolder', 'file1.csv')
      });
      assert.strictEqual(addContentMock.mock.calls[0].arguments[1], mockQueryTime);
      assert.deepStrictEqual(addContentMock.mock.calls[0].arguments[2], [configuration.items[0]]);
    });

    it('should compress the file and send the gzipped version if compression is enabled', async () => {
      configuration.settings.compression = true;
      mock.method(
        fs,
        'unlink',
        mock.fn(async () => undefined)
      );

      await south.sendFile(configuration.items[0], path.join('sub', 'file1.csv'), mockQueryTime);

      const safeFilename = 'sub_file1.csv'.replace(/\//g, '_').replace(/\\/g, '_');
      const expectedGzipPath = path.resolve('cacheFolder', 'tmp', `${safeFilename}.gz`);

      assert.strictEqual(utilsExports.compress.mock.calls.length, 1);
      assert.deepStrictEqual(utilsExports.compress.mock.calls[0].arguments, [
        path.resolve('inputFolder', 'sub', 'file1.csv'),
        expectedGzipPath
      ]);
      assert.strictEqual(addContentMock.mock.calls.length, 1);
      assert.deepStrictEqual(addContentMock.mock.calls[0].arguments[0], { type: 'any', filePath: expectedGzipPath });
      const unlinkMock = fs.unlink as unknown as { mock: { calls: Array<{ arguments: Array<unknown> }> } };
      assert.ok(unlinkMock.mock.calls.some(c => c.arguments[0] === expectedGzipPath));
    });

    it('should fallback to sending the raw file if compression fails', async () => {
      configuration.settings.compression = true;
      utilsExports.compress = mock.fn(async () => {
        throw new Error('Zip failure');
      });

      await south.sendFile(configuration.items[0], 'file1.csv', mockQueryTime);

      assert.ok(logger.error.mock.calls.some(c => (c.arguments[0] as string).includes('Error compressing file')));
      assert.deepStrictEqual(addContentMock.mock.calls[0].arguments[0], {
        type: 'any',
        filePath: path.resolve('inputFolder', 'file1.csv')
      });
    });

    it('should safely log and ignore unlink errors after compressing', async () => {
      configuration.settings.compression = true;
      mock.method(
        fs,
        'unlink',
        mock.fn(async () => {
          throw new Error('Cannot delete zip');
        })
      );

      await south.sendFile(configuration.items[0], 'file1.csv', mockQueryTime);

      assert.ok(logger.error.mock.calls.some(c => (c.arguments[0] as string).includes('Error while removing compressed file')));
    });
  });
});
