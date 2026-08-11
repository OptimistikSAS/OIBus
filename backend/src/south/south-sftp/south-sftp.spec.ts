import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import testData from '../../tests/utils/test-data';
import { mockModule, reloadModule } from '../../tests/utils/test-utils';
import SouthCacheRepositoryMock from '../../tests/__mocks__/repository/cache/south-cache-repository.mock';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import type { SouthSFTPItemSettings, SouthSFTPSettings } from '../../../shared/model/south-settings.model';
import type { SouthConnectorEntity } from '../../model/south-connector.model';
import type SouthSftpClass from './south-sftp';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';
import type { FileInfo } from 'ssh2-sftp-client';
import { DateTime } from 'luxon';

const nodeRequire = createRequire(import.meta.url);

// Shared across all describe blocks so the same mock closure always returns the active logger
let activeSftpLogger: PinoLogger | null = null;

const encryptionServiceMock = new EncryptionServiceMock('', '');

interface SftpCallbacks {
  error?: (error: unknown) => void;
  end?: () => void;
  close?: () => void;
}

const mockSftpClient = {
  connect: mock.fn(async () => undefined),
  list: mock.fn(async (_folder?: string, _callback?: (fi: FileInfo) => boolean) => [] as Array<FileInfo>),
  fastGet: mock.fn(async () => undefined),
  delete: mock.fn(async () => undefined),
  end: mock.fn(async () => undefined)
};

// Captures the callbacks object passed to `new sftpClient(name, callbacks)` on the most recent
// construction, so tests can simulate the underlying ssh2 socket's 'close'/'error' events by
// invoking these directly.
let lastSftpCallbacks: SftpCallbacks | undefined;

// Kept as the raw Mock instance (not cast to a constructor type) so tests can call `.mock.*` on
// it directly; only the module-export wiring below needs the constructor-shaped view.
const sftpClientDefaultFn = mock.fn(function (_name?: string, callbacks?: SftpCallbacks) {
  lastSftpCallbacks = callbacks;
  return mockSftpClient;
});
const sftpClientExports = {
  __esModule: true,
  default: sftpClientDefaultFn as unknown as new (name?: string, callbacks?: SftpCallbacks) => typeof mockSftpClient
};
(sftpClientDefaultFn as unknown as Record<string, unknown>)['default'] = sftpClientDefaultFn;

const utilsExports = {
  checkAge: mock.fn(() => true),
  compress: mock.fn(async () => undefined),
  delay: mock.fn(async () => undefined),
  generateIntervals: mock.fn(() => []),
  groupItemsByGroup: mock.fn(() => []),
  validateCronExpression: mock.fn(() => ({ expression: '' })),
  getErrorMessage: mock.fn((error: unknown) => {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
      return (error as { message: string }).message;
    }
    return String(error);
  }),
  // Mirrors the real implementation in service/utils.ts — kept in sync manually, matching the
  // pattern established in south-modbus.spec.ts.
  workUnitLogCtx: mock.fn((items: Array<{ id: string; name: string; group?: { id: string; name: string } | null }>) => {
    if (items.length === 0) return {};
    if (items.length === 1) return { itemId: items[0].id, itemName: items[0].name };
    const lead = items[0];
    return lead.group ? { groupId: lead.group.id, groupName: lead.group.name } : {};
  })
};

// Some log calls are `logger.debug/error(logCtx, message)` (structured context first) and others
// are plain `logger.debug/error(message)` — this checks either shape without caring which.
const logIncludes = (mockFn: { mock: { calls: Array<{ arguments: Array<unknown> }> } }, text: string): boolean =>
  mockFn.mock.calls.some(c => c.arguments.some(arg => typeof arg === 'string' && arg.includes(text)));

// The 'error'/'close' callbacks (and the reconnect timer's connect() call) run as fire-and-forget
// async work that isn't awaited by the caller — draining several microtask turns lets their
// `await` chains (disconnect() -> client.end(), createConnectionOptions() -> decryptText(), etc.)
// fully settle before assertions run.
const flushMicrotasks = async (turns = 10): Promise<void> => {
  for (let i = 0; i < turns; i++) {
    await Promise.resolve();
  }
};

describe('SouthSFTP', () => {
  let SouthSftp: typeof SouthSftpClass;
  let south: SouthSftpClass;

  const logger = new PinoLogger();
  const addContentCallback = mock.fn(async (_southId: string, _data: unknown, _queryTime: string, _items: unknown) => undefined);
  const southCacheRepository = new SouthCacheRepositoryMock() as unknown as SouthCacheRepository;

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
      compression: false,
      retryInterval: 10000
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
        startTimeOffset: null,
        endTimeOffset: null,
        recoveryStrategy: null,
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
        startTimeOffset: null,
        endTimeOffset: null,
        recoveryStrategy: null,
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
        startTimeOffset: null,
        endTimeOffset: null,
        recoveryStrategy: null,
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

  before(() => {
    mockModule(nodeRequire, '../../service/utils', utilsExports);
    mockModule(nodeRequire, 'ssh2-sftp-client', sftpClientExports);
    mockModule(nodeRequire, '../../service/encryption.service', {
      __esModule: true,
      encryptionService: encryptionServiceMock
    });
    mockModule(nodeRequire, '../../service/logger/logger.service', {
      loggerService: { createChildLogger: mock.fn(() => activeSftpLogger) },
      default: class {}
    });

    SouthSftp = reloadModule<{ default: typeof SouthSftpClass }>(nodeRequire, './south-sftp').default;
  });

  beforeEach(() => {
    activeSftpLogger = logger;
    mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date(testData.constants.dates.FAKE_NOW).getTime() });
    sftpClientDefaultFn.mock.resetCalls();
    lastSftpCallbacks = undefined;
    mockSftpClient.connect = mock.fn(async () => undefined);
    mockSftpClient.list = mock.fn(async (_folder?: string, _callback?: (fi: FileInfo) => boolean) => [] as Array<FileInfo>);
    mockSftpClient.fastGet = mock.fn(async () => undefined);
    mockSftpClient.delete = mock.fn(async () => undefined);
    mockSftpClient.end = mock.fn(async () => undefined);
    utilsExports.checkAge.mock.mockImplementation(() => true);
    utilsExports.compress.mock.mockImplementation(async () => undefined);
    utilsExports.getErrorMessage.mock.resetCalls();
    utilsExports.workUnitLogCtx.mock.resetCalls();
    addContentCallback.mock.resetCalls();
    encryptionServiceMock.decryptText.mock.resetCalls();
    mock.method(fs, 'unlink', async () => undefined);
    logger.debug.mock.resetCalls();
    logger.info.mock.resetCalls();
    logger.warn.mock.resetCalls();
    logger.error.mock.resetCalls();

    south = new SouthSftp(configuration, addContentCallback, southCacheRepository, 'cacheFolder');
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  describe('connect / disconnect / reconnect', () => {
    it('should properly connect and establish a persistent client', async () => {
      await south.connect();

      assert.strictEqual(sftpClientDefaultFn.mock.calls.length, 1);
      assert.strictEqual(mockSftpClient.connect.mock.calls.length, 1);
      assert.strictEqual((south as unknown as Record<string, unknown>)['client'], mockSftpClient);
      assert.ok(logIncludes(logger.debug, 'Connecting to SFTP server 127.0.0.1:2222'));
      assert.ok(logIncludes(logger.info, 'Connected to SFTP server 127.0.0.1:2222'));
    });

    it('should reuse the same persistent client across multiple listFiles/getFile calls', async () => {
      await south.connect();
      const fileInfo = { name: 'file1', size: 100, modifyTime: DateTime.now().toMillis() } as FileInfo;
      mockSftpClient.list.mock.mockImplementation(async () => [fileInfo]);

      await south.listFiles(configuration.items[0], []);
      await south.getFile(fileInfo, configuration.items[0], []);
      await south.listFiles(configuration.items[0], []);

      assert.strictEqual(sftpClientDefaultFn.mock.calls.length, 1);
      assert.strictEqual(mockSftpClient.connect.mock.calls.length, 1);
      assert.strictEqual(mockSftpClient.end.mock.calls.length, 0);
    });

    it('should schedule a reconnect when connect() fails', async () => {
      mockSftpClient.connect.mock.mockImplementation(async () => {
        throw new Error('connect error');
      });

      await south.connect();

      assert.strictEqual((south as unknown as Record<string, unknown>)['client'], null);
      assert.ok(logIncludes(logger.error, 'Error while connecting to SFTP server 127.0.0.1:2222: connect error'));

      mockSftpClient.connect.mock.mockImplementation(async () => undefined);
      mock.timers.tick(configuration.settings.retryInterval);
      await Promise.resolve();
      await Promise.resolve();

      assert.strictEqual(sftpClientDefaultFn.mock.calls.length, 2);
    });

    it('should not schedule a reconnect on connect error when disconnecting is true', async () => {
      const disconnectMock = mock.fn(async (): Promise<void> => undefined);
      south.disconnect = disconnectMock;
      (south as unknown as Record<string, unknown>)['disconnecting'] = true;
      mockSftpClient.connect.mock.mockImplementation(async () => {
        throw new Error('connect error');
      });

      await south.connect();

      assert.strictEqual(disconnectMock.mock.calls.length, 1);
      mock.timers.tick(configuration.settings.retryInterval);
      assert.strictEqual(sftpClientDefaultFn.mock.calls.length, 1);
    });

    it('should properly disconnect an active client', async () => {
      await south.connect();

      await south.disconnect();

      assert.strictEqual(mockSftpClient.end.mock.calls.length, 1);
      assert.strictEqual((south as unknown as Record<string, unknown>)['client'], null);
      assert.ok(logIncludes(logger.info, 'Disconnected from SFTP server 127.0.0.1:2222'));
    });

    it('should properly disconnect without an active client', async () => {
      await south.disconnect();
      assert.strictEqual(mockSftpClient.end.mock.calls.length, 0);
    });

    it('should log and still null the client if end() throws during disconnect', async () => {
      await south.connect();
      mockSftpClient.end.mock.mockImplementation(async () => {
        throw new Error('end error');
      });

      await south.disconnect();

      assert.strictEqual((south as unknown as Record<string, unknown>)['client'], null);
      assert.ok(logIncludes(logger.error, 'Error while disconnecting from SFTP server 127.0.0.1:2222: end error'));
    });

    it('should clear a pending reconnect timeout on disconnect', async () => {
      (south as unknown as Record<string, unknown>)['reconnectTimeout'] = setTimeout(() => null, 1000);

      await south.disconnect();

      assert.strictEqual((south as unknown as Record<string, unknown>)['reconnectTimeout'], null);
    });

    it('should proactively reconnect when the client reports an unexpected close', async () => {
      await south.connect();
      assert.ok(lastSftpCallbacks?.close);

      lastSftpCallbacks!.close!();
      // The close handler is fire-and-forget (not awaited by ssh2-sftp-client) — flush microtasks.
      await flushMicrotasks();

      assert.strictEqual((south as unknown as Record<string, unknown>)['client'], null);
      assert.ok(logIncludes(logger.warn, 'SFTP client closed unexpectedly'));

      mock.timers.tick(configuration.settings.retryInterval);
      await flushMicrotasks();
      assert.strictEqual(sftpClientDefaultFn.mock.calls.length, 2);
    });

    it('should proactively reconnect when the client reports an unexpected error', async () => {
      await south.connect();
      assert.ok(lastSftpCallbacks?.error);

      lastSftpCallbacks!.error!(new Error('socket reset'));
      await flushMicrotasks();

      assert.strictEqual((south as unknown as Record<string, unknown>)['client'], null);
      assert.ok(logIncludes(logger.warn, 'SFTP client error: socket reset'));

      mock.timers.tick(configuration.settings.retryInterval);
      await flushMicrotasks();
      assert.strictEqual(sftpClientDefaultFn.mock.calls.length, 2);
    });

    it('should ignore a close callback triggered while we are disconnecting ourselves', async () => {
      await south.connect();
      (south as unknown as Record<string, unknown>)['disconnecting'] = true;

      lastSftpCallbacks!.close!();
      await flushMicrotasks();

      assert.strictEqual(sftpClientDefaultFn.mock.calls.length, 1);
      mock.timers.tick(configuration.settings.retryInterval);
      assert.strictEqual(sftpClientDefaultFn.mock.calls.length, 1);
    });

    it('should throw from listFiles when the client is not connected', async () => {
      await assert.rejects(south.listFiles(configuration.items[0], []), new Error('SFTP client is not connected'));
      assert.strictEqual(mockSftpClient.list.mock.calls.length, 0);
    });

    it('should throw from getFile when the client is not connected', async () => {
      const fileInfo = { name: 'myFile1', size: 123 } as FileInfo;
      await assert.rejects(south.getFile(fileInfo, configuration.items[0], []), new Error('SFTP client is not connected'));
      assert.strictEqual(mockSftpClient.fastGet.mock.calls.length, 0);
    });
  });

  describe('testConnection / testItem isolation', () => {
    it('should never touch the persistent client in testConnection', async () => {
      const sentinelClient = { marker: 'persistent-client-sentinel' };
      (south as unknown as Record<string, unknown>)['client'] = sentinelClient;
      const disconnectSpy = mock.method(south, 'disconnect');

      await south.testConnection();

      assert.strictEqual((south as unknown as Record<string, unknown>)['client'], sentinelClient);
      assert.strictEqual(disconnectSpy.mock.calls.length, 0);
      assert.strictEqual(sftpClientDefaultFn.mock.calls.length, 1);
      assert.strictEqual(mockSftpClient.end.mock.calls.length, 1);
    });

    it('should never touch the persistent client in testItem', async () => {
      const sentinelClient = { marker: 'persistent-client-sentinel' };
      (south as unknown as Record<string, unknown>)['client'] = sentinelClient;
      const disconnectSpy = mock.method(south, 'disconnect');
      mockSftpClient.list.mock.mockImplementation(async () => [{ name: 'file.csv', modifyTime: DateTime.now().toMillis() } as FileInfo]);

      const result = await south.testItem(configuration.items[0], testData.south.itemTestingSettings);

      assert.strictEqual((south as unknown as Record<string, unknown>)['client'], sentinelClient);
      assert.strictEqual(disconnectSpy.mock.calls.length, 0);
      assert.strictEqual(sftpClientDefaultFn.mock.calls.length, 1);
      assert.strictEqual(mockSftpClient.end.mock.calls.length, 1);
      assert.strictEqual(result.result.type, 'time-values');
    });
  });

  describe('with a connected client', () => {
    beforeEach(async () => {
      await south.start();
    });

    it('directQuery should manage file retrieval', async () => {
      const fileInfo1 = { name: 'file1' } as FileInfo;
      const fileInfo2 = { name: 'file2' } as FileInfo;

      mock.method(
        south,
        'listFiles',
        mock.fn(async () => [fileInfo1, fileInfo2])
      );
      mock.method(
        south,
        'getFile',
        mock.fn(async () => undefined)
      );

      await south.directQuery(configuration.items);

      const listFilesMock = (south.listFiles as unknown as { mock: { calls: Array<{ arguments: Array<unknown> }> } }).mock;
      const getFileMock = (south.getFile as unknown as { mock: { calls: Array<{ arguments: Array<unknown> }> } }).mock;

      assert.strictEqual(listFilesMock.calls.length, 1);
      assert.ok(logIncludes(logger.debug, `Folder ${configuration.items[0].settings.remoteFolder} listed 2 files`));
      assert.strictEqual(getFileMock.calls.length, 2);
      assert.deepStrictEqual(getFileMock.calls[0].arguments[0], fileInfo1);
      assert.deepStrictEqual(getFileMock.calls[0].arguments[1], configuration.items[0]);
      assert.deepStrictEqual(getFileMock.calls[0].arguments[2], []);
    });

    it('directQuery should reuse filesPreserved from the south cache when available', async () => {
      const preserved = [{ filename: 'cached.csv', modifiedTime: 123 }];
      mock.method(
        southCacheRepository,
        'getItemLastValue',
        mock.fn(() => ({ value: preserved }))
      );
      mock.method(
        south,
        'listFiles',
        mock.fn(async (_item: unknown, filesPreserved: unknown) => {
          assert.deepStrictEqual(filesPreserved, preserved);
          return [];
        })
      );

      const result = await south.directQuery(configuration.items);
      assert.deepStrictEqual(result, preserved);
    });

    it('should respect max files limit and skip remaining files', async () => {
      const configWithLimit: SouthConnectorEntity<SouthSFTPSettings, SouthSFTPItemSettings> = {
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
      const southWithLimit = new SouthSftp(configWithLimit, addContentCallback, southCacheRepository, 'cacheFolder');
      await southWithLimit.start();

      const mtimeMs = DateTime.fromISO(testData.constants.dates.FAKE_NOW).minus({ minutes: 2 }).toMillis();
      const file1 = { name: 'file1.csv', size: 100, modifyTime: mtimeMs } as FileInfo;
      const file2 = { name: 'file2.csv', size: 100, modifyTime: mtimeMs } as FileInfo;
      const file3 = { name: 'file3.csv', size: 100, modifyTime: mtimeMs } as FileInfo;

      mockSftpClient.list.mock.mockImplementation(async () => [file1, file2, file3]);

      await southWithLimit.directQuery([configWithLimit.items[0]]);

      assert.strictEqual(mockSftpClient.fastGet.mock.calls.length, 2);
      assert.ok(logIncludes(logger.debug, 'Max files limit (2) reached for item item1, skipping remaining files'));
    });

    it('should respect max files limit and stop file query across items', async () => {
      const configWithLimit: SouthConnectorEntity<SouthSFTPSettings, SouthSFTPItemSettings> = {
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
      const southWithLimit = new SouthSftp(configWithLimit, addContentCallback, southCacheRepository, 'cacheFolder');
      await southWithLimit.start();

      const mtimeMs = DateTime.fromISO(testData.constants.dates.FAKE_NOW).minus({ minutes: 2 }).toMillis();
      const file1 = { name: 'file1.csv', size: 100, modifyTime: mtimeMs } as FileInfo;
      const file2 = { name: 'file2.csv', size: 100, modifyTime: mtimeMs } as FileInfo;
      const file3 = { name: 'file3.csv', size: 100, modifyTime: mtimeMs } as FileInfo;

      let listCallCount = 0;
      mockSftpClient.list.mock.mockImplementation(async () => {
        listCallCount++;
        return listCallCount === 1 ? [file1, file2, file3] : [];
      });

      await southWithLimit.directQuery(configWithLimit.items);

      assert.strictEqual(mockSftpClient.fastGet.mock.calls.length, 2);
      assert.ok(logIncludes(logger.debug, 'Max files limit (2) reached for item item1, skipping remaining files'));
    });

    it('should respect max size limit and skip remaining files', async () => {
      const configWithLimit: SouthConnectorEntity<SouthSFTPSettings, SouthSFTPItemSettings> = {
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
      const southWithLimit = new SouthSftp(configWithLimit, addContentCallback, southCacheRepository, 'cacheFolder');
      await southWithLimit.start();

      const mtimeMs = DateTime.fromISO(testData.constants.dates.FAKE_NOW).minus({ minutes: 2 }).toMillis();
      const file1 = { name: 'file1.csv', size: 600 * 1024, modifyTime: mtimeMs } as FileInfo;
      const file2 = { name: 'file2.csv', size: 600 * 1024, modifyTime: mtimeMs } as FileInfo;

      mockSftpClient.list.mock.mockImplementation(async () => [file1, file2]);

      await southWithLimit.directQuery([configWithLimit.items[0]]);

      assert.strictEqual(mockSftpClient.fastGet.mock.calls.length, 1);
      assert.ok(logIncludes(logger.debug, 'Max size limit (1 MB) reached for item item1, skipping remaining files'));
    });

    it('should respect max size limit and stop file query across items', async () => {
      const configWithLimit: SouthConnectorEntity<SouthSFTPSettings, SouthSFTPItemSettings> = {
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
      const southWithLimit = new SouthSftp(configWithLimit, addContentCallback, southCacheRepository, 'cacheFolder');
      await southWithLimit.start();

      const mtimeMs = DateTime.fromISO(testData.constants.dates.FAKE_NOW).minus({ minutes: 2 }).toMillis();
      const file1 = { name: 'file1.csv', size: 512 * 1024, modifyTime: mtimeMs } as FileInfo;
      const file2 = { name: 'file2.csv', size: 512 * 1024, modifyTime: mtimeMs } as FileInfo;
      const file3 = { name: 'file3.csv', size: 100, modifyTime: mtimeMs } as FileInfo;

      let listCallCount = 0;
      mockSftpClient.list.mock.mockImplementation(async () => {
        listCallCount++;
        return listCallCount === 1 ? [file1, file2, file3] : [];
      });

      await southWithLimit.directQuery(configWithLimit.items);

      assert.strictEqual(mockSftpClient.fastGet.mock.calls.length, 2);
      assert.ok(logIncludes(logger.debug, 'Max size limit (1 MB) reached for item item1, skipping remaining files'));
    });

    it('should properly get file using the persistent client', async () => {
      mock.method(
        south,
        'addContent',
        mock.fn(async () => undefined)
      );
      mock.method(fs, 'unlink', async () => undefined);

      const fileInfo = { name: 'myFile1', size: 123 } as FileInfo;
      await south.getFile(fileInfo, configuration.items[0], []);

      // connect() (from start()) is the only connection ever opened.
      assert.strictEqual(mockSftpClient.connect.mock.calls.length, 1);
      assert.strictEqual(mockSftpClient.fastGet.mock.calls.length, 1);
      assert.strictEqual(mockSftpClient.delete.mock.calls.length, 1);
      assert.strictEqual(mockSftpClient.end.mock.calls.length, 0);

      const addContentMock = (south.addContent as unknown as { mock: { calls: Array<{ arguments: Array<unknown> }> } }).mock;
      assert.deepStrictEqual(addContentMock.calls[0].arguments[0], {
        type: 'any',
        filePath: path.resolve('cacheFolder', 'tmp', fileInfo.name)
      });
      assert.strictEqual(addContentMock.calls[0].arguments[1], testData.constants.dates.FAKE_NOW);
      assert.deepStrictEqual(addContentMock.calls[0].arguments[2], [configuration.items[0]]);
      assert.strictEqual(logger.error.mock.calls.length, 0);

      // The downloaded temp file must be cleaned up once it has been sent raw
      assert.strictEqual((fs.unlink as unknown as { mock: { calls: Array<unknown> } }).mock.calls.length, 1);
      assert.deepStrictEqual(
        (
          (fs.unlink as unknown as { mock: { calls: Array<{ arguments: Array<unknown> }> } }).mock.calls[0] as {
            arguments: Array<unknown>;
          }
        ).arguments[0],
        path.resolve('cacheFolder', 'tmp', fileInfo.name)
      );

      // Test delete error — logged, not propagated, and the persistent client stays connected.
      mockSftpClient.delete.mock.mockImplementation(async () => {
        throw new Error('delete error');
      });
      await south.getFile(fileInfo, configuration.items[0], []);

      assert.ok(
        logIncludes(logger.error, `Error while removing "${configuration.items[0].settings.remoteFolder}/${fileInfo.name}": delete error`)
      );
      assert.strictEqual(addContentMock.calls.length, 2);
      assert.strictEqual(mockSftpClient.end.mock.calls.length, 0);
      assert.strictEqual(mockSftpClient.connect.mock.calls.length, 1);
    });

    it('should log an error but still complete when removing the local temp file fails (no compression)', async () => {
      mock.method(
        south,
        'addContent',
        mock.fn(async () => undefined)
      );
      mock.method(fs, 'unlink', async () => {
        throw new Error('unlink error');
      });

      const fileInfo = { name: 'myFile1', size: 123 } as FileInfo;
      await south.getFile(fileInfo, configuration.items[0], []);

      const addContentMock = (south.addContent as unknown as { mock: { calls: Array<{ arguments: Array<unknown> }> } }).mock;
      assert.strictEqual(addContentMock.calls.length, 1);
      assert.ok(
        logger.error.mock.calls.some(c =>
          (c.arguments[1] as string).includes(
            `Error while removing file "${path.resolve('cacheFolder', 'tmp', fileInfo.name)}": unlink error`
          )
        )
      );
    });
    it('should properly list files using the persistent client', async () => {
      const fileInfo = { name: 'myFile' } as FileInfo;
      mock.method(
        south,
        'checkCondition',
        mock.fn(() => true)
      );
      mockSftpClient.list.mock.mockImplementation(async (_folder?: string, callback?: (fi: FileInfo) => boolean) => {
        if (callback) callback(fileInfo);
        return [fileInfo];
      });

      const result = await south.listFiles(configuration.items[0], []);

      assert.strictEqual(mockSftpClient.connect.mock.calls.length, 1);
      assert.strictEqual(mockSftpClient.end.mock.calls.length, 0);
      assert.deepStrictEqual(result, [fileInfo]);
    });

    it('should list files recursively when recursive is true', async () => {
      const configRecursive: SouthConnectorEntity<SouthSFTPSettings, SouthSFTPItemSettings> = {
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
      const southRecursive = new SouthSftp(configRecursive, addContentCallback, southCacheRepository, 'cacheFolder');
      await southRecursive.start();

      const mtimeMs = DateTime.fromISO(testData.constants.dates.FAKE_NOW).minus({ minutes: 2 }).toMillis();
      const dirEntry = { type: 'd', name: 'subdir' } as FileInfo;
      const fileInSubdir = { type: '-', name: 'file.csv', size: 100, modifyTime: mtimeMs } as FileInfo;
      const fileFailsCondition = { type: '-', name: 'other.xml', size: 100, modifyTime: mtimeMs } as FileInfo;

      let listCallCount = 0;
      mockSftpClient.list.mock.mockImplementation(async () => {
        listCallCount++;
        return listCallCount === 1 ? [dirEntry] : [fileInSubdir, fileFailsCondition];
      });

      const item = configRecursive.items[0];
      const result = await southRecursive.listFiles(item, []);

      const listCalls = mockSftpClient.list.mock.calls;
      assert.ok(listCalls.some(c => c.arguments[0] === 'input'));
      assert.ok(listCalls.some(c => c.arguments[0] === 'input/subdir'));
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].name, 'subdir/file.csv');
    });

    it('should update modifiedTime when file already in filesPreserved', async () => {
      const mtimeMs = new Date('2020-02-02T02:02:02.222Z').getTime();
      const fileInfo = { name: 'myFile1', size: 123, modifyTime: mtimeMs } as FileInfo;
      const filesPreserved: Array<{ filename: string; modifiedTime: number }> = [{ filename: 'myFile1', modifiedTime: 0 }];

      mock.method(
        south,
        'addContent',
        mock.fn(async () => undefined)
      );

      await south.getFile(fileInfo, configuration.items[1], filesPreserved);

      assert.strictEqual(filesPreserved.length, 1);
      assert.strictEqual(filesPreserved[0].modifiedTime, mtimeMs);
    });
  });
});

describe('SouthSFTP with preserve file and compression', () => {
  let SouthSftp: typeof SouthSftpClass;
  let south: SouthSftpClass;

  const logger = new PinoLogger();
  const addContentCallback = mock.fn(async (_southId: string, _data: unknown, _queryTime: string, _items: unknown) => undefined);
  const southCacheRepository = new SouthCacheRepositoryMock() as unknown as SouthCacheRepository;

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
      compression: true,
      retryInterval: 10000
    },
    groups: [],
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
        startTimeOffset: null,
        endTimeOffset: null,
        recoveryStrategy: null,
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
        startTimeOffset: null,
        endTimeOffset: null,
        recoveryStrategy: null,
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
        startTimeOffset: null,
        endTimeOffset: null,
        recoveryStrategy: null,
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

  before(() => {
    mockModule(nodeRequire, '../../service/utils', utilsExports);
    mockModule(nodeRequire, 'ssh2-sftp-client', sftpClientExports);
    mockModule(nodeRequire, '../../service/encryption.service', {
      __esModule: true,
      encryptionService: encryptionServiceMock
    });
    mockModule(nodeRequire, '../../service/logger/logger.service', {
      loggerService: { createChildLogger: mock.fn(() => activeSftpLogger) },
      default: class {}
    });
    SouthSftp = reloadModule<{ default: typeof SouthSftpClass }>(nodeRequire, './south-sftp').default;
  });

  beforeEach(async () => {
    activeSftpLogger = logger;
    mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date(testData.constants.dates.FAKE_NOW).getTime() });
    sftpClientDefaultFn.mock.resetCalls();
    mockSftpClient.connect = mock.fn(async () => undefined);
    mockSftpClient.list = mock.fn(async (_folder?: string, _callback?: (fi: FileInfo) => boolean) => [] as Array<FileInfo>);
    mockSftpClient.fastGet = mock.fn(async () => undefined);
    mockSftpClient.delete = mock.fn(async () => undefined);
    mockSftpClient.end = mock.fn(async () => undefined);
    utilsExports.compress.mock.mockImplementation(async () => undefined);
    utilsExports.getErrorMessage.mock.resetCalls();
    utilsExports.workUnitLogCtx.mock.resetCalls();
    addContentCallback.mock.resetCalls();
    encryptionServiceMock.decryptText.mock.resetCalls();

    south = new SouthSftp(configuration, addContentCallback, southCacheRepository, 'cacheFolder');
    await south.start();
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  it('should properly add compressed file and capture the real compression error', async () => {
    const mtimeMs = new Date('2020-02-02T02:02:02.222Z').getTime();
    const fileInfo = { name: 'myFile1', size: 123, modifyTime: mtimeMs } as FileInfo;

    mock.method(
      south,
      'addContent',
      mock.fn(async () => undefined)
    );

    let unlinkCallCount = 0;
    mock.method(
      fs,
      'unlink',
      mock.fn(async () => {
        unlinkCallCount++;
        if (unlinkCallCount === 3) throw new Error('error');
      })
    );

    await south.getFile(fileInfo, configuration.items[1], []);

    assert.strictEqual(mockSftpClient.fastGet.mock.calls.length, 1);
    assert.strictEqual(utilsExports.compress.mock.calls.length, 1);
    assert.deepStrictEqual(utilsExports.compress.mock.calls[0].arguments, [
      path.resolve('cacheFolder', 'tmp', fileInfo.name),
      `${path.resolve('cacheFolder', 'tmp', 'myFile1')}.gz`
    ]);

    const addContentMock = (south.addContent as unknown as { mock: { calls: Array<{ arguments: Array<unknown> }> } }).mock;
    assert.deepStrictEqual(addContentMock.calls[0].arguments[0], {
      type: 'any',
      filePath: path.resolve('cacheFolder', 'tmp', `${fileInfo.name}.gz`)
    });
    assert.strictEqual(addContentMock.calls[0].arguments[1], testData.constants.dates.FAKE_NOW);
    assert.deepStrictEqual(addContentMock.calls[0].arguments[2], [configuration.items[1]]);
    assert.strictEqual(logger.error.mock.calls.length, 0);
    // The persistent client is never closed per-file.
    assert.strictEqual(mockSftpClient.end.mock.calls.length, 0);

    // Second call — 3rd unlink throws
    fileInfo.name = 'myFile2';
    await south.getFile(fileInfo, configuration.items[1], []);
    assert.deepStrictEqual(addContentMock.calls[1].arguments[0], {
      type: 'any',
      filePath: `${path.resolve('cacheFolder', 'tmp', 'myFile2')}.gz`
    });
    assert.ok(logIncludes(logger.error, `Error while removing compressed file "${path.resolve('cacheFolder', 'tmp', 'myFile2')}.gz"`));

    // Third call — compress throws: the real error is captured (not swallowed), the file is sent
    // raw, and the downloaded temp file is still cleaned up (the sibling leak fix).
    utilsExports.compress.mock.mockImplementation(async () => {
      throw new Error('compression error');
    });
    await south.getFile(fileInfo, configuration.items[1], []);
    assert.deepStrictEqual(addContentMock.calls[2].arguments[0], {
      type: 'any',
      filePath: path.resolve('cacheFolder', 'tmp', 'myFile2')
    });
    assert.ok(
      logIncludes(
        logger.error,
        `Error compressing file "${path.resolve('cacheFolder', 'tmp', fileInfo.name)}": compression error. Sending it raw instead.`
      )
    );
    // fs.unlink was called to remove the raw temp file after the compress-failure fallback send.
    assert.ok(unlinkCallCount >= 4);
  });

  it('should clean up the downloaded temp file after sending it raw (no compression)', async () => {
    const configurationWithoutCompression = {
      ...configuration,
      settings: { ...configuration.settings, compression: false }
    };
    const southWithoutCompression = new SouthSftp(configurationWithoutCompression, addContentCallback, southCacheRepository, 'cacheFolder');
    await southWithoutCompression.start();

    const fileInfo = { name: 'myFile1', size: 123, modifyTime: Date.now() } as FileInfo;
    mock.method(
      southWithoutCompression,
      'addContent',
      mock.fn(async () => undefined)
    );
    const unlinkMock = mock.method(fs, 'unlink', async () => undefined);

    await southWithoutCompression.getFile(fileInfo, configuration.items[0], []);

    assert.ok(unlinkMock.mock.calls.some(c => c.arguments[0] === path.resolve('cacheFolder', 'tmp', fileInfo.name)));
  });

  it('should remove the local temp file after falling back to a raw send when compression fails', async () => {
    const mtimeMs = new Date('2020-02-02T02:02:02.222Z').getTime();
    const fileInfo = { name: 'myFile3', size: 123, modifyTime: mtimeMs } as FileInfo;

    mock.method(
      south,
      'addContent',
      mock.fn(async () => undefined)
    );
    utilsExports.compress = mock.fn(async () => {
      throw new Error('compression error');
    });
    mock.method(
      fs,
      'unlink',
      mock.fn(async () => undefined)
    );

    await south.getFile(fileInfo, configuration.items[1], []);

    const addContentMock = (south.addContent as unknown as { mock: { calls: Array<{ arguments: Array<unknown> }> } }).mock;
    assert.deepStrictEqual(addContentMock.calls[0].arguments[0], {
      type: 'any',
      filePath: path.resolve('cacheFolder', 'tmp', fileInfo.name)
    });

    const unlinkMock = (fs.unlink as unknown as { mock: { calls: Array<{ arguments: Array<unknown> }> } }).mock;
    assert.strictEqual(unlinkMock.calls.length, 1);
    assert.deepStrictEqual(unlinkMock.calls[0].arguments[0], path.resolve('cacheFolder', 'tmp', fileInfo.name));
  });

  it('should log an error but still complete when removing the local temp file fails after a compression failure fallback', async () => {
    const mtimeMs = new Date('2020-02-02T02:02:02.222Z').getTime();
    const fileInfo = { name: 'myFile4', size: 123, modifyTime: mtimeMs } as FileInfo;

    mock.method(
      south,
      'addContent',
      mock.fn(async () => undefined)
    );
    utilsExports.compress = mock.fn(async () => {
      throw new Error('compression error');
    });
    mock.method(
      fs,
      'unlink',
      mock.fn(async () => {
        throw new Error('unlink error');
      })
    );

    await south.getFile(fileInfo, configuration.items[1], []);

    const addContentMock = (south.addContent as unknown as { mock: { calls: Array<{ arguments: Array<unknown> }> } }).mock;
    assert.strictEqual(addContentMock.calls.length, 1);
    assert.ok(
      logger.error.mock.calls.some(c =>
        (c.arguments[1] as string).includes(
          `Error while removing file "${path.resolve('cacheFolder', 'tmp', fileInfo.name)}": unlink error`
        )
      )
    );
  });

  it('should update modifiedTime when file already in filesPreserved', async () => {
    const mtimeMs = new Date('2020-02-02T02:02:02.222Z').getTime();
    const fileInfo = { name: 'myFile1', size: 123, modifyTime: mtimeMs } as FileInfo;
    const filesPreserved: Array<{ filename: string; modifiedTime: number }> = [{ filename: 'myFile1', modifiedTime: 0 }];

    mock.method(
      south,
      'addContent',
      mock.fn(async () => undefined)
    );

    await south.getFile(fileInfo, configuration.items[1], filesPreserved);

    assert.strictEqual(filesPreserved.length, 1);
    assert.strictEqual(filesPreserved[0].modifiedTime, mtimeMs);
  });
});

describe('SouthSFTP test connection with private key', () => {
  let SouthSftp: typeof SouthSftpClass;
  let south: SouthSftpClass;

  const logger = new PinoLogger();
  const addContentCallback = mock.fn(async (_southId: string, _data: unknown, _queryTime: string, _items: unknown) => undefined);
  const southCacheRepository = new SouthCacheRepositoryMock() as unknown as SouthCacheRepository;

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
      compression: false,
      retryInterval: 10000
    },
    groups: [],
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
        startTimeOffset: null,
        endTimeOffset: null,
        recoveryStrategy: null,
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
        startTimeOffset: null,
        endTimeOffset: null,
        recoveryStrategy: null,
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
        startTimeOffset: null,
        endTimeOffset: null,
        recoveryStrategy: null,
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

  before(() => {
    mockModule(nodeRequire, '../../service/utils', utilsExports);
    mockModule(nodeRequire, 'ssh2-sftp-client', sftpClientExports);
    mockModule(nodeRequire, '../../service/encryption.service', {
      __esModule: true,
      encryptionService: encryptionServiceMock
    });
    mockModule(nodeRequire, '../../service/logger/logger.service', {
      loggerService: { createChildLogger: mock.fn(() => activeSftpLogger) },
      default: class {}
    });
    SouthSftp = reloadModule<{ default: typeof SouthSftpClass }>(nodeRequire, './south-sftp').default;
  });

  beforeEach(() => {
    activeSftpLogger = logger;
    mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date(testData.constants.dates.FAKE_NOW).getTime() });
    sftpClientDefaultFn.mock.resetCalls();
    mockSftpClient.connect = mock.fn(async () => undefined);
    mockSftpClient.list = mock.fn(async (_folder?: string, _callback?: (fi: FileInfo) => boolean) => [] as Array<FileInfo>);
    mockSftpClient.fastGet = mock.fn(async () => undefined);
    mockSftpClient.delete = mock.fn(async () => undefined);
    mockSftpClient.end = mock.fn(async () => undefined);
    utilsExports.checkAge.mock.mockImplementation(() => true);
    addContentCallback.mock.resetCalls();
    encryptionServiceMock.decryptText.mock.resetCalls();

    south = new SouthSftp(configuration, addContentCallback, southCacheRepository, 'cacheFolder');
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  it('should throw an error if connection fails', async () => {
    mock.method(
      fs,
      'readFile',
      mock.fn(async () => 'key-contents')
    );
    mockSftpClient.connect.mock.mockImplementation(async () => {
      throw new Error('connection fails');
    });

    await assert.rejects(
      south.testConnection(),
      new Error(`Access error on "${configuration.settings.host}:${configuration.settings.port}": connection fails`)
    );
  });

  it('should properly test connection', async () => {
    mock.method(
      fs,
      'access',
      mock.fn(async () => undefined)
    );
    mock.method(
      fs,
      'stat',
      mock.fn(async () => ({ isDirectory: () => true }))
    );
    mock.method(
      fs,
      'readFile',
      mock.fn(async () => 'key-contents')
    );

    const testResult = await south.testConnection();
    assert.deepStrictEqual(testResult, {
      items: [
        { key: 'Host', value: `${configuration.settings.host}:${configuration.settings.port}` },
        { key: 'Username', value: configuration.settings.username }
      ]
    });
    assert.strictEqual(logger.error.mock.calls.length, 0);
    assert.strictEqual(encryptionServiceMock.decryptText.mock.calls.length, 1);
    const readFileMock = fs.readFile as unknown as { mock: { calls: Array<unknown> } };
    assert.strictEqual(readFileMock.mock.calls.length, 1);
    // testConnection() always closes its own local client.
    assert.strictEqual(mockSftpClient.end.mock.calls.length, 1);

    // Without passphrase — no decryptText call
    configuration.settings.passphrase = '';
    await south.testConnection();
    assert.strictEqual(encryptionServiceMock.decryptText.mock.calls.length, 1);
    assert.strictEqual(readFileMock.mock.calls.length, 2);
  });

  it('should test item', async () => {
    mock.method(
      fs,
      'readFile',
      mock.fn(async () => 'key-contents')
    );
    mockSftpClient.list.mock.mockImplementation(async (_folder?: string, callback?: (fi: FileInfo) => boolean) => {
      mock.timers.tick(25);
      const fileInfo = { name: 'file.csv', modifyTime: DateTime.now().toMillis() } as FileInfo;
      if (callback) callback(fileInfo);
      return [fileInfo];
    });

    const result = await south.testItem(configuration.items[0], testData.south.itemTestingSettings);

    assert.deepStrictEqual(result, {
      result: {
        type: 'time-values',
        content: [
          {
            pointId: configuration.items[0].name,
            timestamp: DateTime.fromMillis(DateTime.fromISO(testData.constants.dates.FAKE_NOW).toMillis() + 25)
              .toUTC()
              .toISO(),
            data: { value: 'file.csv' }
          }
        ]
      },
      connectionDuration: 0,
      queryDuration: 25
    });
  });

  it('should test item and throw error', async () => {
    mock.method(
      fs,
      'readFile',
      mock.fn(async () => 'key-contents')
    );
    const error = new Error('Could not list files');
    mockSftpClient.list.mock.mockImplementation(async () => {
      throw error;
    });

    await assert.rejects(south.testItem(configuration.items[0], testData.south.itemTestingSettings), error);
  });
});
