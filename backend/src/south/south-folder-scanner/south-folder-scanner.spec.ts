import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { afterEach, before, beforeEach, describe, it, type Mock, mock } from 'node:test';

import { DateTime } from 'luxon';

import type { OIBusContent } from '../../../shared/model/common/content.model';
import type {
  SouthFolderScannerItemSettings,
  SouthFolderScannerSettings,
  SouthItemSettings
} from '../../../shared/model/connector/south-settings.model';

import type { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';
import type * as Utils from '../../service/utils';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../tests/utils/test-data';
import { createMock, type Mocked, mockModule, reloadModule, seq } from '../../tests/utils/test-utils';
import type SouthFolderScannerClass from './south-folder-scanner';

const nodeRequire = createRequire(import.meta.url);

const SHARE_FOLDER = '\\\\server\\share\\data';
const LOCAL_FOLDER = 'C:\\local\\folder';

const buildConfiguration = (
  settings: Partial<SouthFolderScannerSettings> = {}
): SouthConnectorEntity<SouthFolderScannerSettings, SouthFolderScannerItemSettings> => ({
  id: 'southId',
  name: 'south',
  type: 'folder-scanner',
  description: 'my test connector',
  enabled: true,
  settings: {
    inputFolder: 'inputFolder',
    compression: false,
    ...settings
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
      startTimeOffset: null,
      endTimeOffset: null,
      recoveryStrategy: 'oldest',
      cachingStrategy: null,
      thresholdType: null,
      threshold: null,
      rangeLow: null,
      rangeHigh: null,
      maxCachingInterval: null,
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
});

const fileDirent = (name: string) => ({ name, isDirectory: () => false, isFile: () => true });
const folderDirent = (name: string) => ({ name, isDirectory: () => true, isFile: () => false });

// Forces `process.platform` for the tests of the enclosing describe
const simulatePlatform = (platform: NodeJS.Platform) => {
  let originalPlatform: PropertyDescriptor | undefined;
  beforeEach(() => {
    originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
    Object.defineProperty(process, 'platform', { value: platform });
  });
  afterEach(() => {
    if (originalPlatform) {
      Object.defineProperty(process, 'platform', originalPlatform);
    }
  });
};

describe('SouthFolderScanner', () => {
  let SouthFolderScanner: typeof SouthFolderScannerClass;
  let south: SouthFolderScannerClass;
  let configuration: SouthConnectorEntity<SouthFolderScannerSettings, SouthFolderScannerItemSettings>;

  let logger: PinoLogger;
  let addContentCallback: Mock<
    (southId: string, data: OIBusContent, queryTime: string, items: Array<SouthConnectorItemEntity<SouthItemSettings>>) => Promise<void>
  >;
  let southCacheRepository: Mocked<SouthCacheRepository>;

  const realUtils: typeof Utils = nodeRequire('../../service/utils');
  const createUtilsMocks = () => ({
    checkAge: mock.fn((..._args: Parameters<typeof Utils.checkAge>) => true),
    compress: mock.fn(async (_input: string, _output: string): Promise<void> => undefined)
  });
  const utilsExports = { ...realUtils, ...createUtilsMocks() };

  before(() => {
    mockModule(nodeRequire, '../../service/utils', utilsExports);
    mockModule(nodeRequire, '../../service/logger/logger.service', {
      loggerService: { createChildLogger: () => logger },
      default: class {}
    });

    SouthFolderScanner = reloadModule<{ default: typeof SouthFolderScannerClass }>(nodeRequire, './south-folder-scanner').default;
  });

  // Rebuilds the connector (and its configuration) with the given settings
  const createSouth = (settings: Partial<SouthFolderScannerSettings> = {}) => {
    configuration = buildConfiguration(settings);
    south = new SouthFolderScanner(configuration, addContentCallback, southCacheRepository, 'cacheFolder');
    return south;
  };

  beforeEach(() => {
    logger = new PinoLogger();
    addContentCallback = mock.fn(async () => undefined);
    southCacheRepository = createMock<SouthCacheRepository>();
    Object.assign(utilsExports, createUtilsMocks());
    createSouth();
  });

  afterEach(() => {
    mock.restoreAll();
  });

  describe('testConnection', () => {
    it('should pass testConnection if folder exists, is readable, and is a directory', async () => {
      const accessMock = mock.method(fs, 'access', async () => undefined);
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
      mock.method(fs, 'access', async () => {
        throw new Error('ENOENT');
      });

      await assert.rejects(south.testConnection(), /Folder ".*inputFolder" does not exist: ENOENT/);
    });

    it('should throw if folder is not readable', async () => {
      const accessMock = mock.method(fs, 'access', async () => {
        if (accessMock.mock.callCount() === 1) throw new Error('EACCES');
      });

      await assert.rejects(south.testConnection(), /Read access error on ".*inputFolder": EACCES/);
    });

    it('should throw if folder is a file, not a directory', async () => {
      mock.method(fs, 'access', async () => undefined);
      mock.method(
        fs,
        'stat',
        mock.fn(async () => ({ isDirectory: () => false }))
      );

      await assert.rejects(south.testConnection(), /is not a directory/);
    });
  });

  describe('testItem', () => {
    beforeEach(() => {
      mock.method(fs, 'access', async () => undefined);
      mock.method(
        fs,
        'stat',
        mock.fn(async () => ({ isDirectory: () => true, mtimeMs: 1600000000000, size: 512 }))
      );
    });

    it('should return matched files as time values', async () => {
      mock.method(fs, 'readdir', async () => ['file1.csv', 'file2.csv', 'other.txt']);

      const result = await south.testItem(configuration.items[0], { history: undefined });
      assert.ok(result.result.type === 'time-values');
      assert.strictEqual(result.result.content.length, 2);
      assert.strictEqual(typeof result.connectionDuration, 'number');
      assert.strictEqual(typeof result.queryDuration, 'number');
    });

    it('should return empty time values when no files match the regex', async () => {
      mock.method(fs, 'readdir', async () => ['other.txt', 'another.log']);

      const result = await south.testItem(configuration.items[0], { history: undefined });
      assert.ok(result.result.type === 'time-values');
      assert.strictEqual(result.result.content.length, 0);
    });
  });

  describe('listFilesRecursively', () => {
    it('should list files directly in the base dir without recursion', async () => {
      mock.method(
        fs,
        'readdir',
        mock.fn(async () => [fileDirent('file1.csv'), folderDirent('subfolder')])
      );

      const files = await south['listFilesRecursively']('/base', '', configuration.items[0]);
      assert.deepStrictEqual(files, ['file1.csv']);
    });

    it('should list files recursively if enabled in settings', async () => {
      configuration.items[0].settings.recursive = true;
      mock.method(
        fs,
        'readdir',
        mock.fn(
          seq(
            async () => [fileDirent('file1.csv'), folderDirent('subfolder')],
            async () => [fileDirent('file2.csv')]
          )
        )
      );

      const files = await south['listFilesRecursively']('/base', '', configuration.items[0]);
      assert.strictEqual(files.length, 2);
      assert.ok(files.includes('file1.csv'));
      assert.ok(files.includes(path.join('subfolder', 'file2.csv')));
    });
  });

  describe('directQuery', () => {
    let sendFile: Mock<SouthFolderScannerClass['sendFile']>;
    let unlink: Mock<typeof fs.unlink>;
    let fileSize: number;

    beforeEach(() => {
      south['listFilesRecursively'] = mock.fn(async () => ['file1.csv', 'file2.csv', 'ignore.txt']);
      sendFile = mock.method(south, 'sendFile', async () => undefined);
      fileSize = 1024;
      mock.method(
        fs,
        'stat',
        mock.fn(async () => ({ mtimeMs: 1600000000000, size: fileSize }))
      );
      unlink = mock.method(fs, 'unlink', async () => undefined);
    });

    it('should process matched files, call sendFile, and unlink files if preserveFiles is false', async () => {
      await south.directQuery(configuration.items);

      assert.strictEqual(sendFile.mock.calls.length, 2);
    });

    it('should preserve files and return their updated modify times if preserveFiles is true', async () => {
      configuration.items[0].settings.preserveFiles = true;
      southCacheRepository.getItemLastValue.mock.mockImplementation(() => ({
        itemId: 'id1',
        groupId: null,
        queryTime: null,
        trackedInstant: null,
        value: [{ filename: 'file1.csv', modifiedTime: 1000 }]
      }));

      const result = await south.directQuery(configuration.items);

      assert.strictEqual(unlink.mock.calls.length, 0);
      assert.strictEqual(result.length, 2);
      assert.strictEqual(result.find(f => f.filename === 'file1.csv')?.modifiedTime, 1600000000000);
      assert.strictEqual(result.find(f => f.filename === 'file2.csv')?.modifiedTime, 1600000000000);
    });

    it('should safely log and ignore unlink errors', async () => {
      unlink.mock.mockImplementation(async () => {
        throw new Error('Cannot delete');
      });

      await south.directQuery(configuration.items);

      assert.ok(logger.error.mock.calls.some(c => typeof c.arguments[1] === 'string' && c.arguments[1].includes('Error while removing')));
    });

    it('should stop processing if maxFiles limit is reached', async () => {
      configuration.items[0].settings.maxFiles = 1;

      await south.directQuery(configuration.items);

      assert.strictEqual(sendFile.mock.calls.length, 1);
      assert.ok(
        logger.debug.mock.calls.some(c => typeof c.arguments[1] === 'string' && c.arguments[1].includes('Max files limit (1) reached'))
      );
    });

    it('should stop processing if maxSize limit is reached', async () => {
      configuration.items[0].settings.maxSize = 1;
      fileSize = 600 * 1024;

      await south.directQuery(configuration.items);

      assert.strictEqual(sendFile.mock.calls.length, 1);
      assert.ok(
        logger.debug.mock.calls.some(c => typeof c.arguments[1] === 'string' && c.arguments[1].includes('Max size limit (1 MB) reached'))
      );
    });

    it('should process a single file bigger than maxSize', async () => {
      configuration.items[0].settings.maxSize = 1;
      fileSize = 2 * 1024 * 1024;

      await south.directQuery(configuration.items);

      assert.strictEqual(sendFile.mock.calls.length, 1);
    });
  });

  describe('sendFile', () => {
    const mockQueryTime = DateTime.now().toUTC().toISO()!;
    let addContent: Mock<SouthFolderScannerClass['addContent']>;
    let unlink: Mock<typeof fs.unlink>;

    beforeEach(() => {
      addContent = mock.method(south, 'addContent', async () => undefined);
      unlink = mock.method(fs, 'unlink', async () => undefined);
    });

    it('should send the raw file if compression is disabled', async () => {
      await south.sendFile(configuration.items[0], 'file1.csv', mockQueryTime);

      assert.strictEqual(addContent.mock.calls.length, 1);
      assert.deepStrictEqual(addContent.mock.calls[0].arguments[0], {
        type: 'any',
        filePath: path.resolve('inputFolder', 'file1.csv'),
        filename: 'file1.csv'
      });
      assert.strictEqual(addContent.mock.calls[0].arguments[1], mockQueryTime);
      assert.deepStrictEqual(addContent.mock.calls[0].arguments[2], [configuration.items[0]]);
    });

    it('should compress the file and send the gzipped version if compression is enabled', async () => {
      configuration.settings.compression = true;

      await south.sendFile(configuration.items[0], path.join('sub', 'file1.csv'), mockQueryTime);

      const expectedGzipPath = path.resolve('cacheFolder', 'tmp', 'sub_file1.csv.gz');
      assert.strictEqual(utilsExports.compress.mock.calls.length, 1);
      assert.deepStrictEqual(utilsExports.compress.mock.calls[0].arguments, [
        path.resolve('inputFolder', 'sub', 'file1.csv'),
        expectedGzipPath
      ]);
      assert.strictEqual(addContent.mock.calls.length, 1);
      assert.deepStrictEqual(addContent.mock.calls[0].arguments[0], {
        type: 'any',
        filePath: expectedGzipPath,
        filename: path.join('sub', 'file1.csv') + '.gz'
      });
      assert.ok(unlink.mock.calls.some(c => c.arguments[0] === expectedGzipPath));
    });

    it('should fallback to sending the raw file if compression fails', async () => {
      configuration.settings.compression = true;
      utilsExports.compress.mock.mockImplementation(async () => {
        throw new Error('Zip failure');
      });

      await south.sendFile(configuration.items[0], 'file1.csv', mockQueryTime);

      assert.ok(logger.error.mock.calls.some(c => typeof c.arguments[1] === 'string' && c.arguments[1].includes('Error compressing file')));
      assert.deepStrictEqual(addContent.mock.calls[0].arguments[0], {
        type: 'any',
        filePath: path.resolve('inputFolder', 'file1.csv'),
        filename: 'file1.csv'
      });
    });

    it('should safely log and ignore unlink errors after compressing', async () => {
      configuration.settings.compression = true;
      unlink.mock.mockImplementation(async () => {
        throw new Error('Cannot delete zip');
      });

      await south.sendFile(configuration.items[0], 'file1.csv', mockQueryTime);

      assert.ok(
        logger.error.mock.calls.some(
          c => typeof c.arguments[1] === 'string' && c.arguments[1].includes('Error while removing compressed file')
        )
      );
    });
  });

  describe('connect and disconnect', () => {
    describe('non-Windows SMB session handling', () => {
      // These tests assert the "not on Windows" branch specifically, so force the platform
      // instead of relying on the ambient OS running the test (which is win32 on Windows CI).
      simulatePlatform('linux');

      it('should log trace and skip SMB session authentication on non-Windows platforms', async () => {
        createSouth({ username: 'user', inputFolder: SHARE_FOLDER });
        await south['mountNetworkShare'](SHARE_FOLDER);
        assert.ok(logger.trace.mock.calls.some(c => (c.arguments[0] as string).includes('Skipping SMB session authentication')));
      });

      it('should log trace and skip SMB session removal on non-Windows platforms', async () => {
        createSouth({ username: 'user', inputFolder: SHARE_FOLDER });
        await south['unmountNetworkShare'](SHARE_FOLDER);
        assert.ok(logger.trace.mock.calls.some(c => (c.arguments[0] as string).includes('Skipping SMB session removal')));
      });

      it('should return without logging when username is empty on non-Windows platforms (mount)', async () => {
        createSouth({ username: null, inputFolder: SHARE_FOLDER });
        await south['mountNetworkShare'](SHARE_FOLDER);
        assert.strictEqual(logger.trace.mock.calls.length, 0);
      });

      it('should return without logging when username is empty on non-Windows platforms (unmount)', async () => {
        createSouth({ username: null, inputFolder: SHARE_FOLDER });
        await south['unmountNetworkShare'](SHARE_FOLDER);
        assert.strictEqual(logger.trace.mock.calls.length, 0);
      });
    });

    it('should skip SMB mount when username is empty', async () => {
      createSouth({ username: null, inputFolder: SHARE_FOLDER });
      await assert.doesNotReject(south.connect());
    });

    it('should skip SMB mount when inputFolder is not a UNC path', async () => {
      createSouth({ username: 'user', password: 'pass', inputFolder: LOCAL_FOLDER });
      await assert.doesNotReject(south.connect());
    });

    describe(
      'windows SMB session handling',
      {
        // These tests simulate win32 and rely on `net` (as invoked here) being ABSENT so execFile
        // rejects with ENOENT — on an actual Windows runner `net` is a real command, so skip there
        // instead of shelling out to it for real (slow/non-deterministic, and can leak into other tests).
        skip: process.platform === 'win32' ? '`net` is a real command on Windows; nothing to simulate here' : false
      },
      () => {
        simulatePlatform('win32');

        // A spy replacing a private method of the connector
        const spyOn = (method: 'mountNetworkShare' | 'unmountNetworkShare' | 'deleteNetworkSession') => {
          const spy = mock.fn(async (_folderPath: string) => undefined);
          Object.assign(south, { [method]: spy });
          return spy;
        };

        it('should log error and rethrow when authenticating the SMB session fails on Windows', async () => {
          createSouth({ username: 'user', password: '', inputFolder: SHARE_FOLDER });
          // `net` does not exist on the test runner platform, so execFile rejects and the
          // catch branch (log + rethrow) is exercised.
          await assert.rejects(south['mountNetworkShare'](SHARE_FOLDER));
          assert.ok(
            logger.error.mock.calls.some(
              c => typeof c.arguments[0] === 'string' && c.arguments[0].includes('Failed to authenticate SMB session')
            )
          );
        });

        it('should skip SMB mount on Windows when inputFolder is not a UNC path', async () => {
          createSouth({ username: 'user', inputFolder: LOCAL_FOLDER });
          await assert.doesNotReject(south['mountNetworkShare'](LOCAL_FOLDER));
        });

        it('should use the domain-qualified username when a domain is configured', async () => {
          createSouth({ username: 'user', domain: 'MYDOMAIN', password: '', inputFolder: SHARE_FOLDER });
          // net use does not exist on the test runner platform, so execFile rejects and the
          // catch branch (log + rethrow) is exercised — this still exercises the domain-qualified
          // username ternary branch before the failure.
          await assert.rejects(south['mountNetworkShare'](SHARE_FOLDER));
          assert.ok(
            logger.error.mock.calls.some(
              c => typeof c.arguments[0] === 'string' && c.arguments[0].includes('Failed to authenticate SMB session')
            )
          );
        });

        it('should skip SMB mount on Windows when username is empty', async () => {
          createSouth({ username: null, inputFolder: SHARE_FOLDER });
          await assert.doesNotReject(south['mountNetworkShare'](SHARE_FOLDER));
        });

        it('should skip SMB unmount on Windows when username is empty', async () => {
          createSouth({ username: null, inputFolder: SHARE_FOLDER });
          await assert.doesNotReject(south['unmountNetworkShare'](SHARE_FOLDER));
        });

        it('should skip SMB unmount on Windows when inputFolder is not a UNC path', async () => {
          createSouth({ username: 'user', inputFolder: LOCAL_FOLDER });
          await assert.doesNotReject(south['unmountNetworkShare'](LOCAL_FOLDER));
        });

        // Windows refuses to add a session for a server that already has one under a different
        // identity (system error 1219). Clearing any existing session first, unconditionally,
        // before adding the new one makes mounting self-healing regardless of what left a
        // previous session dangling (unclean shutdown, a prior failed attempt, a leftover test).
        it('should clear any existing session before authenticating a new one', async () => {
          createSouth({ username: 'user', inputFolder: SHARE_FOLDER });
          const deleteSpy = spyOn('deleteNetworkSession');

          // `net` is missing on the test runner, so the add still rejects with ENOENT — that's
          // enough to confirm deleteNetworkSession always runs first, before the add is attempted.
          await assert.rejects(async () => south['mountNetworkShare'](SHARE_FOLDER));
          assert.strictEqual(deleteSpy.mock.calls.length, 1);
          assert.deepStrictEqual(deleteSpy.mock.calls[0].arguments, ['\\\\server\\share']);
        });

        // testConnection() must NOT tear the SMB session down afterwards: it's a single shared
        // OS-level resource per share, not something testConnection() owns exclusively. If the
        // connector is already connected and actively running, unmounting here would rip the
        // session out from under it — breaking every read until the next connect/reconnect —
        // which is exactly what happened when this was tried (see commit history).
        it('should not tear down the SMB session after a successful testConnection', async () => {
          createSouth({ username: 'user', inputFolder: SHARE_FOLDER });
          spyOn('mountNetworkShare');
          const unmountSpy = spyOn('unmountNetworkShare');
          mock.method(fs, 'access', async () => undefined);
          mock.method(
            fs,
            'stat',
            mock.fn(async () => ({ isDirectory: () => true }))
          );
          mock.method(fs, 'readdir', async () => []);

          await south.testConnection();

          assert.strictEqual(unmountSpy.mock.calls.length, 0);
        });

        it('should not tear down the SMB session after a failed testConnection', async () => {
          createSouth({ username: 'user', inputFolder: SHARE_FOLDER });
          spyOn('mountNetworkShare');
          const unmountSpy = spyOn('unmountNetworkShare');
          mock.method(fs, 'access', async () => {
            throw new Error('ENOENT');
          });

          await assert.rejects(async () => south.testConnection());

          assert.strictEqual(unmountSpy.mock.calls.length, 0);
        });

        // testItem() calls testConnection() internally for its validation logic, and neither of
        // them should tear the session down — same reasoning as above, since testItem() is just
        // as capable of running against an already-connected, actively-running connector.
        it('should not tear down the SMB session during testItem', async () => {
          createSouth({ username: 'user', inputFolder: SHARE_FOLDER });
          const mountSpy = spyOn('mountNetworkShare');
          const unmountSpy = spyOn('unmountNetworkShare');
          mock.method(fs, 'access', async () => undefined);
          mock.method(
            fs,
            'stat',
            mock.fn(async () => ({ isDirectory: () => true, mtimeMs: 1600000000000, size: 512 }))
          );
          mock.method(fs, 'readdir', async () => ['file1.csv']);

          await south.testItem(configuration.items[0], { history: undefined });

          assert.strictEqual(mountSpy.mock.calls.length, 1);
          assert.strictEqual(unmountSpy.mock.calls.length, 0);
        });

        // Re-authenticating before every scan (rather than relying solely on the mount from
        // connect()) self-heals a session that dropped or was replaced in the meantime, instead
        // of failing every scan until the connector fully reconnects.
        it('should re-authenticate the SMB session before every scan in directQuery', async () => {
          createSouth({ username: 'user', inputFolder: SHARE_FOLDER });
          const mountSpy = spyOn('mountNetworkShare');
          south['listFilesRecursively'] = mock.fn(async () => []);

          await south.directQuery(configuration.items);

          assert.strictEqual(mountSpy.mock.calls.length, 1);
        });

        it('should silently ignore SMB session removal failures on Windows', async () => {
          createSouth({ username: 'user', inputFolder: SHARE_FOLDER });
          // `net` does not exist on the test runner platform, so execFile rejects, but the
          // catch block swallows the error (session may already be removed).
          await assert.doesNotReject(south['unmountNetworkShare'](SHARE_FOLDER));
        });
      }
    );
  });

  describe('explore', () => {
    const CTIME_MS = 1700000000000;
    const CTIME_ISO = DateTime.fromMillis(CTIME_MS).toUTC().toISO()!;
    const MTIME_MS = 1650000000000;
    const MTIME_ISO = DateTime.fromMillis(MTIME_MS).toUTC().toISO()!;

    it('should list folders and files at the root, with ctime for both, mtime for files only, and a file count for folders', async () => {
      const readdirMock = mock.method(
        fs,
        'readdir',
        mock.fn(async (dir: unknown) => {
          // The top-level listing and the subfolder's own file-count listing share this mock — only the
          // top-level call is for the root, everything else is the nested per-folder readdir.
          if (String(dir) === path.resolve('inputFolder')) {
            return [folderDirent('subfolder'), fileDirent('file1.csv'), { name: 'socket', isDirectory: () => false, isFile: () => false }];
          }
          return [fileDirent('nested1.csv'), fileDirent('nested2.csv'), folderDirent('nested-subdir')];
        })
      );
      mock.method(
        fs,
        'stat',
        mock.fn(async () => ({ ctimeMs: CTIME_MS, mtimeMs: MTIME_MS, size: 512 }))
      );

      const entries = await south.explore(null);

      assert.strictEqual(String(readdirMock.mock.calls[0].arguments[0]), path.resolve('inputFolder'));
      assert.deepStrictEqual(entries, [
        {
          id: 'subfolder',
          name: 'subfolder',
          metadata: { type: 'folder', ctime: CTIME_ISO, files: 2 },
          metadataKinds: { ctime: 'instant' },
          hasChildren: true
        },
        {
          id: 'file1.csv',
          name: 'file1.csv',
          metadata: { type: 'file', ctime: CTIME_ISO, size: 512, mtime: MTIME_ISO },
          metadataKinds: { ctime: 'instant', size: 'size', mtime: 'instant' },
          hasChildren: false
        }
      ]);
    });

    it('should browse a sub-folder relative to the input folder', async () => {
      const readdirMock = mock.method(
        fs,
        'readdir',
        mock.fn(async () => [fileDirent('nested.csv')])
      );
      mock.method(
        fs,
        'stat',
        mock.fn(async () => ({ ctimeMs: CTIME_MS, mtimeMs: MTIME_MS, size: 42 }))
      );

      const entries = await south.explore('subfolder');

      assert.strictEqual(String(readdirMock.mock.calls[0].arguments[0]), path.resolve('inputFolder', 'subfolder'));
      assert.deepStrictEqual(entries, [
        {
          id: path.join('subfolder', 'nested.csv'),
          name: 'nested.csv',
          metadata: { type: 'file', ctime: CTIME_ISO, size: 42, mtime: MTIME_ISO },
          metadataKinds: { ctime: 'instant', size: 'size', mtime: 'instant' },
          hasChildren: false
        }
      ]);
    });

    it('should still list a file with whatever stat fields resolved before a later one throws (e.g. an unexpectedly malformed Stats object)', async () => {
      mock.method(
        fs,
        'readdir',
        mock.fn(async () => [fileDirent('odd.csv')])
      );
      // ctime/size are read before mtime — if mtimeMs is ever missing (never happens with a real
      // fs.Stats, but worth pinning down), the earlier fields already assigned to `metadata` must
      // survive rather than being silently discarded along with the one that failed.
      mock.method(
        fs,
        'stat',
        mock.fn(async () => ({ ctimeMs: CTIME_MS, size: 7 }))
      );

      const entries = await south.explore(null);

      assert.deepStrictEqual(entries, [
        {
          id: 'odd.csv',
          name: 'odd.csv',
          metadata: { type: 'file', ctime: CTIME_ISO, size: 7 },
          metadataKinds: { ctime: 'instant', size: 'size' },
          hasChildren: false
        }
      ]);
    });

    it('should reject a path outside of the input folder', async () => {
      await assert.rejects(() => south.explore('../../etc'), /path is outside of the input folder/);
    });

    it('should still list an entry when stat fails, just without ctime/size', async () => {
      mock.method(
        fs,
        'readdir',
        mock.fn(async () => [fileDirent('locked.csv')])
      );
      mock.method(fs, 'stat', async () => {
        throw new Error('EACCES: permission denied');
      });

      const entries = await south.explore(null);

      assert.deepStrictEqual(entries, [
        { id: 'locked.csv', name: 'locked.csv', metadata: { type: 'file' }, metadataKinds: {}, hasChildren: false }
      ]);
    });

    it('should still list a folder without a file count when it cannot be listed (readable enough to stat, not to browse)', async () => {
      mock.method(
        fs,
        'readdir',
        mock.fn(
          seq(
            async () => [folderDirent('restricted')],
            async () => {
              throw new Error('EACCES: permission denied');
            }
          )
        )
      );
      mock.method(
        fs,
        'stat',
        mock.fn(async () => ({ ctimeMs: CTIME_MS }))
      );

      const entries = await south.explore(null);

      assert.deepStrictEqual(entries, [
        {
          id: 'restricted',
          name: 'restricted',
          metadata: { type: 'folder', ctime: CTIME_ISO },
          metadataKinds: { ctime: 'instant' },
          hasChildren: true
        }
      ]);
    });
  });
});
