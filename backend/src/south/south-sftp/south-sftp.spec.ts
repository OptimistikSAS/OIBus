import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { afterEach, before, beforeEach, describe, it, type Mock, mock } from 'node:test';

import { DateTime } from 'luxon';
import type SftpClient from 'ssh2-sftp-client';
import type { FileInfo } from 'ssh2-sftp-client';

import type { OIBusContent } from '../../../shared/model/common/content.model';
import type { SouthItemSettings, SouthSFTPItemSettings, SouthSFTPSettings } from '../../../shared/model/connector/south-settings.model';

import type { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';
import type * as Utils from '../../service/utils';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../tests/utils/test-data';
import { createMock, type Mocked, mockModule, reloadModule } from '../../tests/utils/test-utils';
import type SouthSftpClass from './south-sftp';

const nodeRequire = createRequire(import.meta.url);

interface SftpCallbacks {
  error?: (error: unknown) => void;
  end?: () => void;
  close?: () => void;
}

const buildItem = (id: string, settings: Partial<SouthSFTPItemSettings>): SouthConnectorItemEntity<SouthSFTPItemSettings> => ({
  id,
  name: id.replace('id', 'item'),
  enabled: true,
  settings: {
    remoteFolder: 'input',
    regex: '.*.csv',
    preserveFiles: false,
    ignoreModifiedDate: false,
    minAge: 1000,
    maxFiles: 0,
    maxSize: 0,
    recursive: false,
    ...settings
  },
  scanMode: testData.scanMode.list[0],
  group: null,
  syncWithGroup: false,
  maxReadInterval: null,
  readDelay: null,
  startTimeOffset: null,
  endTimeOffset: null,
  recoveryStrategy: null,
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
});

const buildConfiguration = (
  settings: Partial<SouthSFTPSettings> = {},
  itemSettings: Partial<SouthSFTPItemSettings> = {}
): SouthConnectorEntity<SouthSFTPSettings, SouthSFTPItemSettings> => ({
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
    retryInterval: 10000,
    ...settings
  },
  items: [
    buildItem('id1', { regex: '.*.csv', ...itemSettings }),
    buildItem('id2', { regex: '.*.log', preserveFiles: true, ...itemSettings }),
    buildItem('id3', { regex: '.*.txt', preserveFiles: true, ignoreModifiedDate: true, ...itemSettings })
  ],
  groups: [],
  createdBy: '',
  updatedBy: '',
  createdAt: '',
  updatedAt: ''
});

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

const fileModifiedTwoMinutesAgo = (name: string, size: number) =>
  ({ name, size, modifyTime: DateTime.fromISO(testData.constants.dates.FAKE_NOW).minus({ minutes: 2 }).toMillis() }) as FileInfo;

describe('SouthSFTP', () => {
  let SouthSftp: typeof SouthSftpClass;
  let south: SouthSftpClass;

  let logger: PinoLogger;
  let addContentCallback: Mock<
    (southId: string, data: OIBusContent, queryTime: string, items: Array<SouthConnectorItemEntity<SouthItemSettings>>) => Promise<void>
  >;
  let southCacheRepository: Mocked<SouthCacheRepository>;
  let encryptionService: EncryptionServiceMock;
  let sftpClient: Mocked<SftpClient>;
  let sftpClientConstructor: Mock<(name?: string, callbacks?: SftpCallbacks) => SftpClient>;
  let unlink: Mock<typeof fs.unlink>;
  // Callbacks passed to the most recent `new sftpClient(name, callbacks)`, so tests can simulate
  // the underlying ssh2 socket's 'close'/'error' events by invoking these directly.
  let lastSftpCallbacks: SftpCallbacks | undefined;

  // `default` is declared up front so the interop wrapper of the SUT exposes it (its value is set per test)
  const sftpExports: Record<string, unknown> = { __esModule: true, default: undefined };
  const encryptionExports: Record<string, unknown> = { __esModule: true };

  const realUtils: typeof Utils = nodeRequire('../../service/utils');
  const createUtilsMocks = () => ({
    checkAge: mock.fn((..._args: Parameters<typeof Utils.checkAge>) => true),
    compress: mock.fn(async (_input: string, _output: string): Promise<void> => undefined)
  });
  const utilsExports = { ...realUtils, ...createUtilsMocks() };

  before(() => {
    mockModule(nodeRequire, '../../service/utils', utilsExports);
    mockModule(nodeRequire, 'ssh2-sftp-client', sftpExports);
    mockModule(nodeRequire, '../../service/encryption.service', encryptionExports);
    mockModule(nodeRequire, '../../service/logger/logger.service', {
      loggerService: { createChildLogger: () => logger },
      default: class {}
    });

    SouthSftp = reloadModule<{ default: typeof SouthSftpClass }>(nodeRequire, './south-sftp').default;
  });

  beforeEach(() => {
    logger = new PinoLogger();
    addContentCallback = mock.fn(async () => undefined);
    southCacheRepository = createMock<SouthCacheRepository>();
    encryptionService = new EncryptionServiceMock('', '');
    encryptionExports.encryptionService = encryptionService;
    sftpClient = createMock<SftpClient>({ list: async () => [] });
    lastSftpCallbacks = undefined;
    sftpClientConstructor = mock.fn(function (_name?: string, callbacks?: SftpCallbacks) {
      lastSftpCallbacks = callbacks;
      return sftpClient;
    });
    sftpExports.default = sftpClientConstructor;
    Object.assign(utilsExports, createUtilsMocks());
    unlink = mock.method(fs, 'unlink', async () => undefined);
    mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date(testData.constants.dates.FAKE_NOW).getTime() });
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  const createSouth = (configuration: SouthConnectorEntity<SouthSFTPSettings, SouthSFTPItemSettings>) =>
    new SouthSftp(configuration, addContentCallback, southCacheRepository, 'cacheFolder');

  describe('with password authentication', () => {
    const configuration = buildConfiguration();

    beforeEach(() => {
      south = createSouth(configuration);
    });

    describe('connect / disconnect / reconnect', () => {
      it('should properly connect and establish a persistent client', async () => {
        await south.connect();

        assert.strictEqual(sftpClientConstructor.mock.calls.length, 1);
        assert.strictEqual(sftpClient.connect.mock.calls.length, 1);
        assert.strictEqual(south['client'], sftpClient);
        assert.ok(logIncludes(logger.debug, 'Connecting to SFTP server 127.0.0.1:2222'));
        assert.ok(logIncludes(logger.info, 'Connected to SFTP server 127.0.0.1:2222'));
      });

      it('should reuse the same persistent client across multiple listFiles/getFile calls', async () => {
        await south.connect();
        const fileInfo = { name: 'file1', size: 100, modifyTime: DateTime.now().toMillis() } as FileInfo;
        sftpClient.list.mock.mockImplementation(async () => [fileInfo]);

        await south.listFiles(configuration.items[0], []);
        await south.getFile(fileInfo, configuration.items[0], []);
        await south.listFiles(configuration.items[0], []);

        assert.strictEqual(sftpClientConstructor.mock.calls.length, 1);
        assert.strictEqual(sftpClient.connect.mock.calls.length, 1);
        assert.strictEqual(sftpClient.end.mock.calls.length, 0);
      });

      it('should schedule a reconnect when connect() fails', async () => {
        sftpClient.connect.mock.mockImplementationOnce(async () => {
          throw new Error('connect error');
        });

        await south.connect();

        assert.strictEqual(south['client'], null);
        assert.ok(logIncludes(logger.error, 'Error while connecting to SFTP server 127.0.0.1:2222: connect error'));

        mock.timers.tick(configuration.settings.retryInterval);
        await Promise.resolve();
        await Promise.resolve();

        assert.strictEqual(sftpClientConstructor.mock.calls.length, 2);
      });

      it('should not schedule a reconnect on connect error when disconnecting is true', async () => {
        const disconnect = mock.method(south, 'disconnect', async () => undefined);
        south['disconnecting'] = true;
        sftpClient.connect.mock.mockImplementation(async () => {
          throw new Error('connect error');
        });

        await south.connect();

        assert.strictEqual(disconnect.mock.calls.length, 1);
        mock.timers.tick(configuration.settings.retryInterval);
        assert.strictEqual(sftpClientConstructor.mock.calls.length, 1);
      });

      it('should properly disconnect an active client', async () => {
        await south.connect();

        await south.disconnect();

        assert.strictEqual(sftpClient.end.mock.calls.length, 1);
        assert.strictEqual(south['client'], null);
        assert.ok(logIncludes(logger.info, 'Disconnected from SFTP server 127.0.0.1:2222'));
      });

      it('should properly disconnect without an active client', async () => {
        await south.disconnect();
        assert.strictEqual(sftpClient.end.mock.calls.length, 0);
      });

      it('should log and still null the client if end() throws during disconnect', async () => {
        await south.connect();
        sftpClient.end.mock.mockImplementation(async () => {
          throw new Error('end error');
        });

        await south.disconnect();

        assert.strictEqual(south['client'], null);
        assert.ok(logIncludes(logger.error, 'Error while disconnecting from SFTP server 127.0.0.1:2222: end error'));
      });

      it('should clear a pending reconnect timeout on disconnect', async () => {
        south['reconnectTimeout'] = setTimeout(() => null, 1000);

        await south.disconnect();

        assert.strictEqual(south['reconnectTimeout'], null);
      });

      it('should proactively reconnect when the client reports an unexpected close', async () => {
        await south.connect();
        assert.ok(lastSftpCallbacks?.close);

        lastSftpCallbacks.close();
        // The close handler is fire-and-forget (not awaited by ssh2-sftp-client) — flush microtasks.
        await flushMicrotasks();

        assert.strictEqual(south['client'], null);
        assert.ok(logIncludes(logger.warn, 'SFTP client closed unexpectedly'));

        mock.timers.tick(configuration.settings.retryInterval);
        await flushMicrotasks();
        assert.strictEqual(sftpClientConstructor.mock.calls.length, 2);
      });

      it('should proactively reconnect when the client reports an unexpected error', async () => {
        await south.connect();
        assert.ok(lastSftpCallbacks?.error);

        lastSftpCallbacks.error(new Error('socket reset'));
        await flushMicrotasks();

        assert.strictEqual(south['client'], null);
        assert.ok(logIncludes(logger.warn, 'SFTP client error: socket reset'));

        mock.timers.tick(configuration.settings.retryInterval);
        await flushMicrotasks();
        assert.strictEqual(sftpClientConstructor.mock.calls.length, 2);
      });

      it('should ignore a close callback triggered while we are disconnecting ourselves', async () => {
        await south.connect();
        south['disconnecting'] = true;

        lastSftpCallbacks!.close!();
        await flushMicrotasks();

        assert.strictEqual(sftpClientConstructor.mock.calls.length, 1);
        mock.timers.tick(configuration.settings.retryInterval);
        assert.strictEqual(sftpClientConstructor.mock.calls.length, 1);
      });

      it('should throw from listFiles when the client is not connected', async () => {
        await assert.rejects(south.listFiles(configuration.items[0], []), new Error('SFTP client is not connected'));
        assert.strictEqual(sftpClient.list.mock.calls.length, 0);
      });

      it('should throw from getFile when the client is not connected', async () => {
        const fileInfo = { name: 'myFile1', size: 123 } as FileInfo;
        await assert.rejects(south.getFile(fileInfo, configuration.items[0], []), new Error('SFTP client is not connected'));
        assert.strictEqual(sftpClient.fastGet.mock.calls.length, 0);
      });
    });

    describe('testConnection / testItem isolation', () => {
      it('should never touch the persistent client in testConnection', async () => {
        const persistentClient = createMock<SftpClient>();
        south['client'] = persistentClient;
        const disconnectSpy = mock.method(south, 'disconnect');

        await south.testConnection();

        assert.strictEqual(south['client'], persistentClient);
        assert.strictEqual(disconnectSpy.mock.calls.length, 0);
        assert.strictEqual(sftpClientConstructor.mock.calls.length, 1);
        assert.strictEqual(sftpClient.end.mock.calls.length, 1);
      });

      it('should never touch the persistent client in testItem', async () => {
        const persistentClient = createMock<SftpClient>();
        south['client'] = persistentClient;
        const disconnectSpy = mock.method(south, 'disconnect');
        sftpClient.list.mock.mockImplementation(async () => [{ name: 'file.csv', modifyTime: DateTime.now().toMillis() } as FileInfo]);

        const result = await south.testItem(configuration.items[0], testData.south.itemTestingSettings);

        assert.strictEqual(south['client'], persistentClient);
        assert.strictEqual(disconnectSpy.mock.calls.length, 0);
        assert.strictEqual(sftpClientConstructor.mock.calls.length, 1);
        assert.strictEqual(sftpClient.end.mock.calls.length, 1);
        assert.strictEqual(result.result.type, 'record-list');
      });
    });

    describe('with a connected client', () => {
      beforeEach(async () => {
        await south.start();
      });

      // A started connector whose items all share the given settings
      const startSouthWith = async (itemSettings: Partial<SouthSFTPItemSettings>) => {
        const southWithSettings = createSouth(buildConfiguration({}, itemSettings));
        await southWithSettings.start();
        return southWithSettings;
      };

      it('directQuery should manage file retrieval', async () => {
        const fileInfo1 = { name: 'file1' } as FileInfo;
        const fileInfo2 = { name: 'file2' } as FileInfo;
        const listFiles = mock.method(south, 'listFiles', async () => [fileInfo1, fileInfo2]);
        const getFile = mock.method(south, 'getFile', async () => undefined);

        await south.directQuery(configuration.items);

        assert.strictEqual(listFiles.mock.calls.length, 1);
        assert.ok(logIncludes(logger.debug, `Folder ${configuration.items[0].settings.remoteFolder} listed 2 files`));
        assert.strictEqual(getFile.mock.calls.length, 2);
        assert.deepStrictEqual(getFile.mock.calls[0].arguments[0], fileInfo1);
        assert.deepStrictEqual(getFile.mock.calls[0].arguments[1], configuration.items[0]);
        assert.deepStrictEqual(getFile.mock.calls[0].arguments[2], []);
      });

      it('directQuery should reuse filesPreserved from the south cache when available', async () => {
        const preserved = [{ filename: 'cached.csv', modifiedTime: 123 }];
        southCacheRepository.getItemLastValue.mock.mockImplementation(() => ({
          itemId: 'id1',
          groupId: null,
          queryTime: null,
          trackedInstant: null,
          value: preserved
        }));
        mock.method(south, 'listFiles', async (_item: unknown, filesPreserved: unknown) => {
          assert.deepStrictEqual(filesPreserved, preserved);
          return [];
        });

        const result = await south.directQuery(configuration.items);
        assert.deepStrictEqual(result, preserved);
      });

      it('should respect max files limit and skip remaining files', async () => {
        const southWithLimit = await startSouthWith({ maxFiles: 2, maxSize: 0 });
        sftpClient.list.mock.mockImplementation(async () => [
          fileModifiedTwoMinutesAgo('file1.csv', 100),
          fileModifiedTwoMinutesAgo('file2.csv', 100),
          fileModifiedTwoMinutesAgo('file3.csv', 100)
        ]);

        await southWithLimit.directQuery([southWithLimit.connectorConfiguration.items[0]]);

        assert.strictEqual(sftpClient.fastGet.mock.calls.length, 2);
        assert.ok(logIncludes(logger.debug, 'Max files limit (2) reached for item item1, skipping remaining files'));
      });

      it('should respect max files limit and stop file query across items', async () => {
        const southWithLimit = await startSouthWith({ maxFiles: 2, maxSize: 0 });
        const files = [
          fileModifiedTwoMinutesAgo('file1.csv', 100),
          fileModifiedTwoMinutesAgo('file2.csv', 100),
          fileModifiedTwoMinutesAgo('file3.csv', 100)
        ];
        sftpClient.list.mock.mockImplementation(async () => (sftpClient.list.mock.callCount() === 0 ? files : []));

        await southWithLimit.directQuery(southWithLimit.connectorConfiguration.items);

        assert.strictEqual(sftpClient.fastGet.mock.calls.length, 2);
        assert.ok(logIncludes(logger.debug, 'Max files limit (2) reached for item item1, skipping remaining files'));
      });

      it('should respect max size limit and skip remaining files', async () => {
        const southWithLimit = await startSouthWith({ maxFiles: 0, maxSize: 1 });
        sftpClient.list.mock.mockImplementation(async () => [
          fileModifiedTwoMinutesAgo('file1.csv', 600 * 1024),
          fileModifiedTwoMinutesAgo('file2.csv', 600 * 1024)
        ]);

        await southWithLimit.directQuery([southWithLimit.connectorConfiguration.items[0]]);

        assert.strictEqual(sftpClient.fastGet.mock.calls.length, 1);
        assert.ok(logIncludes(logger.debug, 'Max size limit (1 MB) reached for item item1, skipping remaining files'));
      });

      it('should retrieve a single file bigger than max size', async () => {
        const southWithLimit = await startSouthWith({ maxFiles: 0, maxSize: 1 });
        sftpClient.list.mock.mockImplementation(async () => [fileModifiedTwoMinutesAgo('file1.csv', 2 * 1024 * 1024)]);

        await southWithLimit.directQuery([southWithLimit.connectorConfiguration.items[0]]);

        assert.strictEqual(sftpClient.fastGet.mock.calls.length, 1);
      });

      it('should respect max size limit and stop file query across items', async () => {
        const southWithLimit = await startSouthWith({ maxFiles: 0, maxSize: 1 });
        const files = [
          fileModifiedTwoMinutesAgo('file1.csv', 512 * 1024),
          fileModifiedTwoMinutesAgo('file2.csv', 512 * 1024),
          fileModifiedTwoMinutesAgo('file3.csv', 100)
        ];
        sftpClient.list.mock.mockImplementation(async () => (sftpClient.list.mock.callCount() === 0 ? files : []));

        await southWithLimit.directQuery(southWithLimit.connectorConfiguration.items);

        assert.strictEqual(sftpClient.fastGet.mock.calls.length, 2);
        assert.ok(logIncludes(logger.debug, 'Max size limit (1 MB) reached for item item1, skipping remaining files'));
      });

      it('should properly get file using the persistent client', async () => {
        const addContent = mock.method(south, 'addContent', async () => undefined);

        const fileInfo = { name: 'myFile1', size: 123 } as FileInfo;
        await south.getFile(fileInfo, configuration.items[0], []);

        // connect() (from start()) is the only connection ever opened.
        assert.strictEqual(sftpClient.connect.mock.calls.length, 1);
        assert.strictEqual(sftpClient.fastGet.mock.calls.length, 1);
        assert.strictEqual(sftpClient.delete.mock.calls.length, 1);
        assert.strictEqual(sftpClient.end.mock.calls.length, 0);

        assert.deepStrictEqual(addContent.mock.calls[0].arguments[0], {
          type: 'any',
          filePath: path.resolve('cacheFolder', 'tmp', fileInfo.name)
        });
        assert.strictEqual(addContent.mock.calls[0].arguments[1], testData.constants.dates.FAKE_NOW);
        assert.deepStrictEqual(addContent.mock.calls[0].arguments[2], [configuration.items[0]]);
        assert.strictEqual(logger.error.mock.calls.length, 0);

        // The downloaded temp file must be cleaned up once it has been sent raw
        assert.strictEqual(unlink.mock.calls.length, 1);
        assert.deepStrictEqual(unlink.mock.calls[0].arguments[0], path.resolve('cacheFolder', 'tmp', fileInfo.name));

        // Test delete error — logged, not propagated, and the persistent client stays connected.
        sftpClient.delete.mock.mockImplementation(async () => {
          throw new Error('delete error');
        });
        await south.getFile(fileInfo, configuration.items[0], []);

        assert.ok(
          logIncludes(logger.error, `Error while removing "${configuration.items[0].settings.remoteFolder}/${fileInfo.name}": delete error`)
        );
        assert.strictEqual(addContent.mock.calls.length, 2);
        assert.strictEqual(sftpClient.end.mock.calls.length, 0);
        assert.strictEqual(sftpClient.connect.mock.calls.length, 1);
      });

      it('should log an error but still complete when removing the local temp file fails (no compression)', async () => {
        const addContent = mock.method(south, 'addContent', async () => undefined);
        unlink.mock.mockImplementation(async () => {
          throw new Error('unlink error');
        });

        const fileInfo = { name: 'myFile1', size: 123 } as FileInfo;
        await south.getFile(fileInfo, configuration.items[0], []);

        assert.strictEqual(addContent.mock.calls.length, 1);
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
        mock.method(south, 'checkCondition', () => true);
        sftpClient.list.mock.mockImplementation(async (_folder, callback) => {
          if (callback) callback(fileInfo);
          return [fileInfo];
        });

        const result = await south.listFiles(configuration.items[0], []);

        assert.strictEqual(sftpClient.connect.mock.calls.length, 1);
        assert.strictEqual(sftpClient.end.mock.calls.length, 0);
        assert.deepStrictEqual(result, [fileInfo]);
      });

      it('should list files recursively when recursive is true', async () => {
        const southRecursive = await startSouthWith({ recursive: true });
        const dirEntry = { type: 'd', name: 'subdir' } as FileInfo;
        const fileInSubdir = { ...fileModifiedTwoMinutesAgo('file.csv', 100), type: '-' } as FileInfo;
        const fileFailsCondition = { ...fileModifiedTwoMinutesAgo('other.xml', 100), type: '-' } as FileInfo;
        sftpClient.list.mock.mockImplementation(async () =>
          sftpClient.list.mock.callCount() === 0 ? [dirEntry] : [fileInSubdir, fileFailsCondition]
        );

        const result = await southRecursive.listFiles(southRecursive.connectorConfiguration.items[0], []);

        const listCalls = sftpClient.list.mock.calls;
        assert.ok(listCalls.some(c => c.arguments[0] === 'input'));
        assert.ok(listCalls.some(c => c.arguments[0] === 'input/subdir'));
        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].name, 'subdir/file.csv');
        // The preserved files are stored by relative path: the age check must look them up the same way
        assert.ok(utilsExports.checkAge.mock.calls.some(c => c.arguments[1] === 'subdir/file.csv'));
        assert.ok(!utilsExports.checkAge.mock.calls.some(c => c.arguments[1] === 'file.csv'));
      });

      it('should update modifiedTime when file already in filesPreserved', async () => {
        const mtimeMs = new Date('2020-02-02T02:02:02.222Z').getTime();
        const fileInfo = { name: 'myFile1', size: 123, modifyTime: mtimeMs } as FileInfo;
        const filesPreserved: Array<{ filename: string; modifiedTime: number }> = [{ filename: 'myFile1', modifiedTime: 0 }];
        mock.method(south, 'addContent', async () => undefined);

        await south.getFile(fileInfo, configuration.items[1], filesPreserved);

        assert.strictEqual(filesPreserved.length, 1);
        assert.strictEqual(filesPreserved[0].modifiedTime, mtimeMs);
      });
    });
  });

  describe('with preserve file and compression', () => {
    const configuration = buildConfiguration({ compression: true });
    let addContent: Mock<SouthSftpClass['addContent']>;

    beforeEach(async () => {
      south = createSouth(configuration);
      await south.start();
      addContent = mock.method(south, 'addContent', async () => undefined);
    });

    it('should properly add compressed file and capture the real compression error', async () => {
      const mtimeMs = new Date('2020-02-02T02:02:02.222Z').getTime();
      const fileInfo = { name: 'myFile1', size: 123, modifyTime: mtimeMs } as FileInfo;
      unlink.mock.mockImplementation(async () => {
        if (unlink.mock.callCount() === 2) throw new Error('error');
      });

      await south.getFile(fileInfo, configuration.items[1], []);

      assert.strictEqual(sftpClient.fastGet.mock.calls.length, 1);
      assert.strictEqual(utilsExports.compress.mock.calls.length, 1);
      assert.deepStrictEqual(utilsExports.compress.mock.calls[0].arguments, [
        path.resolve('cacheFolder', 'tmp', fileInfo.name),
        `${path.resolve('cacheFolder', 'tmp', 'myFile1')}.gz`
      ]);

      assert.deepStrictEqual(addContent.mock.calls[0].arguments[0], {
        type: 'any',
        filePath: path.resolve('cacheFolder', 'tmp', `${fileInfo.name}.gz`)
      });
      assert.strictEqual(addContent.mock.calls[0].arguments[1], testData.constants.dates.FAKE_NOW);
      assert.deepStrictEqual(addContent.mock.calls[0].arguments[2], [configuration.items[1]]);
      assert.strictEqual(logger.error.mock.calls.length, 0);
      // The persistent client is never closed per-file.
      assert.strictEqual(sftpClient.end.mock.calls.length, 0);

      // Second call — 3rd unlink throws
      fileInfo.name = 'myFile2';
      await south.getFile(fileInfo, configuration.items[1], []);
      assert.deepStrictEqual(addContent.mock.calls[1].arguments[0], {
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
      assert.deepStrictEqual(addContent.mock.calls[2].arguments[0], {
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
      assert.ok(unlink.mock.callCount() >= 4);
    });

    it('should clean up the downloaded temp file after sending it raw (no compression)', async () => {
      const southWithoutCompression = createSouth(buildConfiguration({ compression: false }));
      await southWithoutCompression.start();
      const fileInfo = { name: 'myFile1', size: 123, modifyTime: Date.now() } as FileInfo;
      mock.method(southWithoutCompression, 'addContent', async () => undefined);

      await southWithoutCompression.getFile(fileInfo, configuration.items[0], []);

      assert.ok(unlink.mock.calls.some(c => c.arguments[0] === path.resolve('cacheFolder', 'tmp', fileInfo.name)));
    });

    it('should remove the local temp file after falling back to a raw send when compression fails', async () => {
      const mtimeMs = new Date('2020-02-02T02:02:02.222Z').getTime();
      const fileInfo = { name: 'myFile3', size: 123, modifyTime: mtimeMs } as FileInfo;
      utilsExports.compress.mock.mockImplementation(async () => {
        throw new Error('compression error');
      });

      await south.getFile(fileInfo, configuration.items[1], []);

      assert.deepStrictEqual(addContent.mock.calls[0].arguments[0], {
        type: 'any',
        filePath: path.resolve('cacheFolder', 'tmp', fileInfo.name)
      });
      assert.strictEqual(unlink.mock.calls.length, 1);
      assert.deepStrictEqual(unlink.mock.calls[0].arguments[0], path.resolve('cacheFolder', 'tmp', fileInfo.name));
    });

    it('should log an error but still complete when removing the local temp file fails after a compression failure fallback', async () => {
      const mtimeMs = new Date('2020-02-02T02:02:02.222Z').getTime();
      const fileInfo = { name: 'myFile4', size: 123, modifyTime: mtimeMs } as FileInfo;
      utilsExports.compress.mock.mockImplementation(async () => {
        throw new Error('compression error');
      });
      unlink.mock.mockImplementation(async () => {
        throw new Error('unlink error');
      });

      await south.getFile(fileInfo, configuration.items[1], []);

      assert.strictEqual(addContent.mock.calls.length, 1);
      assert.ok(
        logger.error.mock.calls.some(c =>
          (c.arguments[1] as string).includes(
            `Error while removing file "${path.resolve('cacheFolder', 'tmp', fileInfo.name)}": unlink error`
          )
        )
      );
    });
  });

  describe('test connection with private key', () => {
    let configuration: SouthConnectorEntity<SouthSFTPSettings, SouthSFTPItemSettings>;
    let readFile: Mock<() => Promise<string>>;

    beforeEach(() => {
      configuration = buildConfiguration({
        authentication: 'private-key',
        privateKey: 'myPrivateKey',
        passphrase: 'myPassphrase',
        username: '',
        password: undefined
      });
      readFile = mock.fn(async () => 'key-contents');
      mock.method(fs, 'readFile', readFile);
      south = createSouth(configuration);
    });

    it('should throw an error if connection fails', async () => {
      sftpClient.connect.mock.mockImplementation(async () => {
        throw new Error('connection fails');
      });

      await assert.rejects(
        south.testConnection(),
        new Error(`Access error on "${configuration.settings.host}:${configuration.settings.port}": connection fails`)
      );
    });

    it('should properly test connection', async () => {
      const testResult = await south.testConnection();
      assert.deepStrictEqual(testResult, {
        items: [
          { key: 'Host', value: `${configuration.settings.host}:${configuration.settings.port}` },
          { key: 'Username', value: configuration.settings.username }
        ]
      });
      assert.strictEqual(logger.error.mock.calls.length, 0);
      assert.strictEqual(encryptionService.decryptText.mock.calls.length, 1);
      assert.strictEqual(readFile.mock.calls.length, 1);
      // testConnection() always closes its own local client.
      assert.strictEqual(sftpClient.end.mock.calls.length, 1);

      // Without passphrase — no decryptText call
      configuration.settings.passphrase = '';
      await south.testConnection();
      assert.strictEqual(encryptionService.decryptText.mock.calls.length, 1);
      assert.strictEqual(readFile.mock.calls.length, 2);
    });

    it('should test item', async () => {
      sftpClient.list.mock.mockImplementation(async (_folder, callback) => {
        mock.timers.tick(25);
        const fileInfo = { name: 'file.csv', modifyTime: DateTime.now().toMillis() } as FileInfo;
        if (callback) callback(fileInfo);
        return [fileInfo];
      });

      const result = await south.testItem(configuration.items[0], testData.south.itemTestingSettings);

      assert.deepStrictEqual(result, {
        result: {
          type: 'record-list',
          content: [
            {
              pointId: configuration.items[0].name,
              timestamp: DateTime.fromMillis(DateTime.fromISO(testData.constants.dates.FAKE_NOW).toMillis() + 25)
                .toUTC()
                .toISO(),
              value: 'file.csv'
            }
          ]
        },
        connectionDuration: 0,
        queryDuration: 25
      });
    });

    it('should test item with the content of the most recent matching file to transform', async () => {
      sftpClient.list.mock.mockImplementation(async () => [
        { name: 'old.csv', modifyTime: 1000 } as FileInfo,
        { name: 'recent.csv', modifyTime: 2000 } as FileInfo
      ]);
      sftpClient.get.mock.mockImplementation(async () => Buffer.from('a;b'));

      const result = await south.testItem(configuration.items[0], {
        ...testData.south.itemTestingSettings,
        transformer: { transformerId: 'transformerId', options: {} }
      });

      assert.deepStrictEqual(result.result, { type: 'any', filePath: 'recent.csv', filename: 'recent.csv', content: 'a;b' });
      assert.strictEqual(sftpClient.get.mock.calls[0].arguments[0], `${configuration.items[0].settings.remoteFolder}/recent.csv`);
    });

    it('should throw when no file matches to transform', async () => {
      sftpClient.list.mock.mockImplementation(async () => []);

      await assert.rejects(
        south.testItem(configuration.items[0], {
          ...testData.south.itemTestingSettings,
          transformer: { transformerId: 'transformerId', options: {} }
        }),
        /No file matching .* to transform/
      );
    });

    it('should test item and throw error', async () => {
      const error = new Error('Could not list files');
      sftpClient.list.mock.mockImplementation(async () => {
        throw error;
      });

      await assert.rejects(south.testItem(configuration.items[0], testData.south.itemTestingSettings), error);
    });
  });
});
