import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { afterEach, before, beforeEach, describe, it, type Mock, mock } from 'node:test';

import { type Client as FTPClient, FileInfo, FileType } from 'basic-ftp';
import { DateTime } from 'luxon';

import type { OIBusContent } from '../../../shared/model/common/content.model';
import type { SouthFTPItemSettings, SouthFTPSettings, SouthItemSettings } from '../../../shared/model/connector/south-settings.model';

import type { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';
import type * as Utils from '../../service/utils';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../tests/utils/test-data';
import { createMock, type Mocked, mockModule, reloadModule } from '../../tests/utils/test-utils';
import type SouthFtpClass from './south-ftp';

const nodeRequire = createRequire(import.meta.url);

const buildItem = (id: string, settings: Partial<SouthFTPItemSettings>): SouthConnectorItemEntity<SouthFTPItemSettings> => ({
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
  settings: Partial<SouthFTPSettings> = {},
  itemSettings: Partial<SouthFTPItemSettings> = {}
): SouthConnectorEntity<SouthFTPSettings, SouthFTPItemSettings> => ({
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

// A basic-ftp file entry of 100 bytes modified two minutes ago, unless overridden
const createFileInfo = (name: string, overrides: Partial<Pick<FileInfo, 'type' | 'size' | 'modifiedAt'>> = {}): FileInfo =>
  Object.assign(new FileInfo(name), {
    type: FileType.File,
    size: 100,
    modifiedAt: new Date(DateTime.now().minus({ minutes: 2 }).toMillis()),
    ...overrides
  });

// Some log calls are `logger.debug/error(logCtx, message)` (structured context first) and others
// are plain `logger.debug/error(message)` — this checks either shape without caring which.
const logIncludes = (mockFn: { mock: { calls: Array<{ arguments: Array<unknown> }> } }, text: string): boolean =>
  mockFn.mock.calls.some(c => c.arguments.some(arg => typeof arg === 'string' && arg.includes(text)));

describe('SouthFTP', () => {
  let SouthFtp: typeof SouthFtpClass;
  let south: SouthFtpClass;

  let logger: PinoLogger;
  let addContentCallback: Mock<
    (southId: string, data: OIBusContent, queryTime: string, items: Array<SouthConnectorItemEntity<SouthItemSettings>>) => Promise<void>
  >;
  let southCacheRepository: Mocked<SouthCacheRepository>;
  let ftpClient: Mocked<FTPClient>;
  let ftpClientConstructor: Mock<() => FTPClient>;
  let decryptText: Mock<(text?: string | null) => Promise<string>>;
  let unlink: Mock<typeof fs.unlink>;

  const ftpExports: Record<string, unknown> = { __esModule: true, Client: undefined };
  const encryptionExports: Record<string, unknown> = { __esModule: true };

  const realUtils: typeof Utils = nodeRequire('../../service/utils');
  const createUtilsMocks = () => ({
    checkAge: mock.fn((..._args: Parameters<typeof Utils.checkAge>) => true),
    compress: mock.fn(async (_input: string, _output: string): Promise<void> => undefined),
    workUnitLogCtx: mock.fn(realUtils.workUnitLogCtx)
  });
  const utilsExports = { ...realUtils, ...createUtilsMocks() };

  const configuration = buildConfiguration();

  before(() => {
    mockModule(nodeRequire, 'basic-ftp', ftpExports);
    mockModule(nodeRequire, '../../service/utils', utilsExports);
    mockModule(nodeRequire, '../../service/encryption.service', encryptionExports);
    mockModule(nodeRequire, '../../service/logger/logger.service', {
      loggerService: { createChildLogger: () => logger },
      default: class {}
    });

    SouthFtp = reloadModule<{ default: typeof SouthFtpClass }>(nodeRequire, './south-ftp').default;
  });

  beforeEach(() => {
    logger = new PinoLogger();
    addContentCallback = mock.fn(async () => undefined);
    southCacheRepository = createMock<SouthCacheRepository>();
    ftpClient = createMock<FTPClient>({ list: async () => [], closed: false });
    ftpClientConstructor = mock.fn(function () {
      return ftpClient;
    });
    ftpExports.Client = ftpClientConstructor;
    decryptText = mock.fn(async () => 'decrypted-password');
    encryptionExports.encryptionService = { decryptText };
    Object.assign(utilsExports, createUtilsMocks());
    mock.method(fs, 'mkdir', async () => undefined);
    unlink = mock.method(fs, 'unlink', async () => undefined);
    mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date(testData.constants.dates.FAKE_NOW) });

    south = createSouth(configuration);
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  const createSouth = (southConfiguration: SouthConnectorEntity<SouthFTPSettings, SouthFTPItemSettings>) =>
    new SouthFtp(southConfiguration, addContentCallback, southCacheRepository, 'cacheFolder');

  // basic-ftp exposes `closed` as a read-only getter: the mock stores it as a plain property
  const setClientClosed = (closed: boolean) => Object.assign(ftpClient, { closed });

  describe('connect / disconnect / reconnect', () => {
    it('should properly connect and establish a persistent client', async () => {
      await south.connect();

      assert.strictEqual(ftpClientConstructor.mock.calls.length, 1);
      assert.strictEqual(ftpClient.access.mock.calls.length, 1);
      assert.deepStrictEqual(ftpClient.access.mock.calls[0].arguments[0], {
        host: '127.0.0.1',
        port: 21,
        user: 'user',
        password: 'decrypted-password',
        secure: false
      });
      assert.strictEqual(south['client'], ftpClient);
      assert.ok(logIncludes(logger.debug, 'Connecting to FTP server 127.0.0.1:21'));
      assert.ok(logIncludes(logger.info, 'Connected to FTP server 127.0.0.1:21'));
    });

    it('should reuse the same persistent client across multiple listFiles/getFile calls', async () => {
      await south.connect();
      const fileInfo = createFileInfo('test.csv');
      ftpClient.list.mock.mockImplementation(async () => [fileInfo]);

      await south.listFiles(configuration.items[0], []);
      await south.getFile(fileInfo, configuration.items[0], []);
      await south.listFiles(configuration.items[0], []);

      // Only the connect() call created a client — listFiles/getFile reused it.
      assert.strictEqual(ftpClientConstructor.mock.calls.length, 1);
      assert.strictEqual(ftpClient.access.mock.calls.length, 1);
      assert.strictEqual(ftpClient.close.mock.calls.length, 0);
    });

    it('should schedule a reconnect when connect() fails', async () => {
      ftpClient.access.mock.mockImplementationOnce(async () => {
        throw new Error('connect error');
      });

      await south.connect();

      assert.strictEqual(south['client'], null);
      assert.ok(logIncludes(logger.error, 'Error while connecting to FTP server 127.0.0.1:21: connect error'));

      mock.timers.tick(configuration.settings.retryInterval);
      // Let the scheduled connect() (which is async) run to completion.
      await Promise.resolve();
      await Promise.resolve();

      assert.strictEqual(ftpClientConstructor.mock.calls.length, 2);
    });

    it('should not schedule a reconnect on connect error when disconnecting is true', async () => {
      // Mock disconnect() so the real implementation's own disconnecting=false reset at the end
      // doesn't mask what we're testing here (mirrors south-modbus.spec.ts's equivalent test).
      const disconnect = mock.method(south, 'disconnect', async () => undefined);
      south['disconnecting'] = true;
      ftpClient.access.mock.mockImplementation(async () => {
        throw new Error('connect error');
      });

      await south.connect();

      assert.strictEqual(disconnect.mock.calls.length, 1);
      mock.timers.tick(configuration.settings.retryInterval);
      assert.strictEqual(ftpClientConstructor.mock.calls.length, 1);
    });

    it('should properly disconnect an active client', async () => {
      await south.connect();

      await south.disconnect();

      assert.strictEqual(ftpClient.close.mock.calls.length, 1);
      assert.strictEqual(south['client'], null);
      assert.ok(logIncludes(logger.info, 'Disconnected from FTP server 127.0.0.1:21'));
    });

    it('should properly disconnect without an active client', async () => {
      await south.disconnect();
      // Nothing should throw, and close() must not be called since there was no client.
      assert.strictEqual(ftpClient.close.mock.calls.length, 0);
    });

    it('should clear a pending reconnect timeout on disconnect', async () => {
      south['reconnectTimeout'] = setTimeout(() => null, 1000);

      await south.disconnect();

      assert.strictEqual(south['reconnectTimeout'], null);
    });

    it('should treat a listFiles failure as a lost connection and reconnect when the client reports itself closed', async () => {
      await south.connect();
      // basic-ftp closes the client automatically on a timeout/connection-level error — simulate
      // that real contract, not just an arbitrary thrown message.
      ftpClient.list.mock.mockImplementationOnce(async () => {
        setClientClosed(true);
        throw new Error('Client is closed because of a timeout');
      });

      await assert.rejects(south.directQuery([configuration.items[0]]), new Error('Client is closed because of a timeout'));

      // The connection is torn down and a reconnect scheduled.
      assert.strictEqual(south['client'], null);
      assert.strictEqual(ftpClient.close.mock.calls.length, 1);

      setClientClosed(false);
      mock.timers.tick(configuration.settings.retryInterval);
      await Promise.resolve();
      await Promise.resolve();

      assert.strictEqual(ftpClientConstructor.mock.calls.length, 2);
    });

    it('should not disconnect or reconnect when a listFiles failure leaves the client open', async () => {
      await south.connect();
      // An ordinary command failure (e.g. a permission-denied on one file) does not close the
      // client in basic-ftp — the connection is still fine, so nothing should be torn down.
      ftpClient.list.mock.mockImplementation(async () => {
        throw new Error('550 Permission denied');
      });

      await assert.rejects(south.directQuery([configuration.items[0]]), new Error('550 Permission denied'));

      assert.notStrictEqual(south['client'], null);
      assert.strictEqual(ftpClient.close.mock.calls.length, 0);
      mock.timers.tick(configuration.settings.retryInterval);
      assert.strictEqual(ftpClientConstructor.mock.calls.length, 1);
    });

    it('should not reconnect after a lost-connection directQuery failure while disconnecting', async () => {
      await south.connect();
      // Mock disconnect() so the real implementation's own disconnecting=false reset at the end
      // doesn't mask what we're testing here (mirrors south-modbus.spec.ts's equivalent test).
      const disconnect = mock.method(south, 'disconnect', async () => undefined);
      south['disconnecting'] = true;
      ftpClient.list.mock.mockImplementation(async () => {
        setClientClosed(true);
        throw new Error('boom');
      });

      await assert.rejects(south.directQuery([configuration.items[0]]), new Error('boom'));

      assert.strictEqual(disconnect.mock.calls.length, 1);
      mock.timers.tick(configuration.settings.retryInterval);
      assert.strictEqual(ftpClientConstructor.mock.calls.length, 1);
    });

    it('should throw from listFiles when the client is not connected', async () => {
      // No connect() call — this.client stays null.
      await assert.rejects(south.listFiles(configuration.items[0], []), new Error('FTP client is not connected'));
      assert.strictEqual(ftpClient.list.mock.calls.length, 0);
    });

    it('should throw from listFiles when the client reports itself as closed', async () => {
      await south.connect();
      setClientClosed(true);

      await assert.rejects(south.listFiles(configuration.items[0], []), new Error('FTP client is not connected'));
      assert.strictEqual(ftpClient.list.mock.calls.length, 0);
    });

    it('should throw from getFile when the client is not connected', async () => {
      const fileInfo = createFileInfo('test.csv', { modifiedAt: new Date() });
      await assert.rejects(south.getFile(fileInfo, configuration.items[0], []), new Error('FTP client is not connected'));
      assert.strictEqual(ftpClient.downloadTo.mock.calls.length, 0);
    });
  });

  describe('testConnection / testItem isolation', () => {
    it('should never touch the persistent client in testConnection', async () => {
      const persistentClient = createMock<FTPClient>();
      south['client'] = persistentClient;
      const disconnectSpy = mock.method(south, 'disconnect');

      await south.testConnection();

      assert.strictEqual(south['client'], persistentClient);
      assert.strictEqual(disconnectSpy.mock.calls.length, 0);
      // testConnection() opened and closed its own local client.
      assert.strictEqual(ftpClientConstructor.mock.calls.length, 1);
      assert.strictEqual(ftpClient.close.mock.calls.length, 1);
    });

    it('should never touch the persistent client in testItem', async () => {
      const persistentClient = createMock<FTPClient>();
      south['client'] = persistentClient;
      const disconnectSpy = mock.method(south, 'disconnect');
      ftpClient.list.mock.mockImplementation(async () => [createFileInfo('test.csv')]);

      const result = await south.testItem(configuration.items[0], { history: undefined });

      assert.strictEqual(south['client'], persistentClient);
      assert.strictEqual(disconnectSpy.mock.calls.length, 0);
      assert.strictEqual(ftpClientConstructor.mock.calls.length, 1);
      assert.strictEqual(ftpClient.close.mock.calls.length, 1);
      assert.strictEqual(result.result.type, 'time-values');
    });

    it('should test connection', async () => {
      const testResult = await south.testConnection();

      assert.deepStrictEqual(ftpClient.access.mock.calls[0].arguments[0], {
        host: '127.0.0.1',
        port: 21,
        user: 'user',
        password: 'decrypted-password',
        secure: false
      });
      assert.strictEqual(ftpClient.close.mock.calls.length, 1);
      assert.deepStrictEqual(testResult, {
        items: [
          { key: 'Host', value: `${configuration.settings.host}:${configuration.settings.port}` },
          { key: 'Username', value: configuration.settings.username }
        ]
      });
    });

    it('should test connection with error', async () => {
      ftpClient.access.mock.mockImplementation(async () => {
        throw new Error('Connection failed');
      });

      await assert.rejects(south.testConnection(), new Error('Access error on "127.0.0.1:21": Connection failed'));
      // The local test client is still closed even though access() failed.
      assert.strictEqual(ftpClient.close.mock.calls.length, 1);
    });

    it('should test item and separately measure connection and query duration', async () => {
      const fileInfo = createFileInfo('test.csv');
      ftpClient.access.mock.mockImplementation(async () => {
        mock.timers.tick(15);
        return { code: 220, message: 'connected' };
      });
      ftpClient.list.mock.mockImplementation(async () => {
        mock.timers.tick(25);
        return [fileInfo];
      });

      const result = await south.testItem(configuration.items[0], { history: undefined });

      assert.ok(result.result.type === 'time-values');
      const content = result.result.content;
      assert.strictEqual(content.length, 1);
      assert.strictEqual(content[0].pointId, 'item1');
      assert.ok(typeof content[0].timestamp === 'string');
      assert.deepStrictEqual(content[0].data, { value: 'test.csv' });
      assert.strictEqual(result.connectionDuration, 15);
      assert.strictEqual(result.queryDuration, 25);
    });

    it('should test item with file without modifiedAt date', async () => {
      ftpClient.list.mock.mockImplementation(async () => [createFileInfo('test.csv', { modifiedAt: undefined })]);

      const result = await south.testItem(configuration.items[0], { history: undefined });

      assert.ok(result.result.type === 'time-values');
      assert.strictEqual(result.result.content.length, 1);
    });
  });

  describe('with a connected client', () => {
    beforeEach(async () => {
      await south.start();
    });

    // A started connector with the given connector settings and the given settings on all its items
    const startSouthWith = async (settings: Partial<SouthFTPSettings>, itemSettings: Partial<SouthFTPItemSettings> = {}) => {
      const otherSouth = createSouth(buildConfiguration(settings, itemSettings));
      await otherSouth.start();
      return otherSouth;
    };

    it('should properly start', () => {
      assert.ok(logIncludes(logger.debug, 'enabled'));
    });

    it('should list files', async () => {
      const fileInfo = createFileInfo('test.csv');
      ftpClient.list.mock.mockImplementation(async () => [fileInfo]);

      const files = await south.listFiles(configuration.items[0], []);

      assert.deepStrictEqual(files, [fileInfo]);
      assert.deepStrictEqual(ftpClient.list.mock.calls[0].arguments[0], 'input');
    });

    it('should filter files by regex', async () => {
      const fileInfo1 = createFileInfo('test.csv');
      const fileInfo2 = createFileInfo('test.txt');
      ftpClient.list.mock.mockImplementation(async () => [fileInfo1, fileInfo2]);

      const files = await south.listFiles(configuration.items[0], []); // regex: '.*.csv'

      assert.deepStrictEqual(files, [fileInfo1]);
    });

    it('should get file', async () => {
      const item = configuration.items[0]; // preserveFiles: false
      await south.getFile(createFileInfo('test.csv'), item, []);

      assert.deepStrictEqual(ftpClient.downloadTo.mock.calls[0].arguments[0], path.resolve('cacheFolder', 'tmp', 'test.csv'));
      assert.deepStrictEqual(ftpClient.downloadTo.mock.calls[0].arguments[1], 'input/test.csv');
      assert.deepStrictEqual(ftpClient.remove.mock.calls[0].arguments[0], 'input/test.csv');
      assert.strictEqual(addContentCallback.mock.calls[0].arguments[0], 'southId');
      assert.deepStrictEqual(addContentCallback.mock.calls[0].arguments[1], {
        type: 'any',
        filePath: path.resolve('cacheFolder', 'tmp', 'test.csv')
      });
      assert.strictEqual(addContentCallback.mock.calls[0].arguments[2], testData.constants.dates.FAKE_NOW);
      assert.deepStrictEqual(addContentCallback.mock.calls[0].arguments[3], [item]);
      // getFile() no longer closes the persistent client after each file.
      assert.strictEqual(ftpClient.close.mock.calls.length, 0);
    });

    it('should get file with compression', async () => {
      const southWithCompression = await startSouthWith({ compression: true });

      const item = configuration.items[0];
      await southWithCompression.getFile(createFileInfo('test.csv'), item, []);

      assert.deepStrictEqual(utilsExports.compress.mock.calls[0].arguments[0], path.resolve('cacheFolder', 'tmp', 'test.csv'));
      assert.deepStrictEqual(utilsExports.compress.mock.calls[0].arguments[1], path.resolve('cacheFolder', 'tmp', 'test.csv.gz'));
      assert.deepStrictEqual(addContentCallback.mock.calls[0].arguments[1], {
        type: 'any',
        filePath: path.resolve('cacheFolder', 'tmp', 'test.csv.gz')
      });
      assert.deepStrictEqual(addContentCallback.mock.calls[0].arguments[3], [item]);
    });

    it('should preserve files when configured', async () => {
      southCacheRepository.getItemLastValue.mock.mockImplementation(() => null);

      await south.getFile(createFileInfo('test.log'), configuration.items[1], []); // preserveFiles: true

      assert.strictEqual(ftpClient.remove.mock.calls.length, 0);
    });

    it('should update modifiedTime when file already in filesPreserved', async () => {
      const filesPreserved: Array<{ filename: string; modifiedTime: number }> = [{ filename: 'test.log', modifiedTime: 0 }];

      await south.getFile(createFileInfo('test.log'), configuration.items[1], filesPreserved); // preserveFiles: true

      assert.strictEqual(filesPreserved.length, 1);
      assert.ok(filesPreserved[0].modifiedTime > 0);
    });

    it('should handle file removal error', async () => {
      ftpClient.remove.mock.mockImplementation(async () => {
        throw new Error('Remove failed');
      });

      const item = configuration.items[0];
      await south.getFile(createFileInfo('test.csv'), item, []);

      assert.deepStrictEqual(ftpClient.remove.mock.calls[0].arguments[0], 'input/test.csv');
      assert.deepStrictEqual(addContentCallback.mock.calls[0].arguments[1], {
        type: 'any',
        filePath: path.resolve('cacheFolder', 'tmp', 'test.csv')
      });
      assert.deepStrictEqual(addContentCallback.mock.calls[0].arguments[3], [item]);
    });

    it('should capture the real error when compression fails and send the file raw instead', async () => {
      utilsExports.compress.mock.mockImplementation(async () => {
        throw new Error('Compression failed');
      });
      const southWithCompression = await startSouthWith({ compression: true });

      await southWithCompression.getFile(createFileInfo('test.csv'), configuration.items[0], []);

      assert.deepStrictEqual(addContentCallback.mock.calls[0].arguments[1], {
        type: 'any',
        filePath: path.resolve('cacheFolder', 'tmp', 'test.csv')
      });
      // The real compression error is captured and logged, not swallowed.
      assert.ok(
        logger.error.mock.calls.some(
          c =>
            c.arguments.some(arg => typeof arg === 'string' && arg.includes('Error compressing file')) &&
            c.arguments.some(arg => typeof arg === 'string' && arg.includes('Compression failed'))
        )
      );
    });

    it('should list files recursively when recursive is true', async () => {
      const southRecursive = await startSouthWith({}, { recursive: true });
      const dirEntry = createFileInfo('subdir', { type: FileType.Directory });
      const fileInSubdir = createFileInfo('file.csv');
      const fileFailsCondition = createFileInfo('other.xml');
      ftpClient.list.mock.mockImplementation(async () =>
        ftpClient.list.mock.callCount() === 0 ? [dirEntry] : [fileInSubdir, fileFailsCondition]
      );

      const result = await southRecursive.listFiles(southRecursive.connectorConfiguration.items[0], []);

      assert.deepStrictEqual(ftpClient.list.mock.calls[0].arguments[0], 'input');
      assert.deepStrictEqual(ftpClient.list.mock.calls[1].arguments[0], 'input/subdir');
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].name, 'subdir/file.csv');
    });

    it('should query files with file that has zero size', async () => {
      ftpClient.list.mock.mockImplementation(async () => [createFileInfo('test.csv', { size: 0 })]);

      await south.directQuery([configuration.items[0]]);

      assert.deepStrictEqual(ftpClient.downloadTo.mock.calls[0].arguments[0], path.resolve('cacheFolder', 'tmp', 'test.csv'));
    });

    it('should query files and use workUnitLogCtx for structured logging', async () => {
      ftpClient.list.mock.mockImplementation(async () => [createFileInfo('test.csv')]);

      await south.directQuery([configuration.items[0]]);

      assert.deepStrictEqual(ftpClient.list.mock.calls[0].arguments[0], 'input');
      assert.deepStrictEqual(ftpClient.downloadTo.mock.calls[0].arguments[0], path.resolve('cacheFolder', 'tmp', 'test.csv'));
      assert.deepStrictEqual(ftpClient.downloadTo.mock.calls[0].arguments[1], 'input/test.csv');
      assert.deepStrictEqual(addContentCallback.mock.calls[0].arguments[1], {
        type: 'any',
        filePath: path.resolve('cacheFolder', 'tmp', 'test.csv')
      });
      assert.deepStrictEqual(addContentCallback.mock.calls[0].arguments[3], [configuration.items[0]]);
      assert.ok(utilsExports.workUnitLogCtx.mock.calls.some(c => c.arguments[0][0] === configuration.items[0]));
    });

    it('should seed filesPreserved from the cached item value when it is an array', async () => {
      const cachedFilesPreserved = [{ filename: 'previous.csv', modifiedTime: 123 }];
      southCacheRepository.getItemLastValue.mock.mockImplementation(() => ({
        itemId: configuration.items[0].id,
        groupId: null,
        queryTime: null,
        trackedInstant: null,
        value: cachedFilesPreserved
      }));

      const result = await south.directQuery([configuration.items[0]]);

      assert.deepStrictEqual(result, cachedFilesPreserved);
    });

    it('should respect max files limit and skip remaining files', async () => {
      const southWithLimit = await startSouthWith({}, { maxFiles: 2, maxSize: 0 });
      ftpClient.list.mock.mockImplementation(async () => [
        createFileInfo('file1.csv'),
        createFileInfo('file2.csv'),
        createFileInfo('file3.csv')
      ]);

      await southWithLimit.directQuery([southWithLimit.connectorConfiguration.items[0]]);

      assert.strictEqual(ftpClient.downloadTo.mock.calls.length, 2);
      assert.ok(logIncludes(logger.debug, 'Max files limit (2) reached for item item1, skipping remaining files'));
    });

    it('should respect max files limit and stop file query across items', async () => {
      const southWithLimit = await startSouthWith({}, { maxFiles: 2, maxSize: 0 });
      ftpClient.list.mock.mockImplementationOnce(async () => [
        createFileInfo('file1.csv'),
        createFileInfo('file2.csv'),
        createFileInfo('file3.csv')
      ]);

      await southWithLimit.directQuery(southWithLimit.connectorConfiguration.items);

      assert.strictEqual(ftpClient.downloadTo.mock.calls.length, 2);
      assert.ok(logIncludes(logger.debug, 'Max files limit (2) reached for item item1, skipping remaining files'));
    });

    it('should respect max size limit and skip remaining files', async () => {
      const southWithLimit = await startSouthWith({}, { maxFiles: 0, maxSize: 1 });
      ftpClient.list.mock.mockImplementation(async () => [
        createFileInfo('file1.csv', { size: 600 * 1024 }),
        createFileInfo('file2.csv', { size: 600 * 1024 })
      ]);

      await southWithLimit.directQuery([southWithLimit.connectorConfiguration.items[0]]);

      assert.strictEqual(ftpClient.downloadTo.mock.calls.length, 1);
      assert.ok(logIncludes(logger.debug, 'Max size limit (1 MB) reached for item item1, skipping remaining files'));
    });

    it('should respect max size limit and stop file query across items', async () => {
      const southWithLimit = await startSouthWith({}, { maxFiles: 0, maxSize: 1 });
      ftpClient.list.mock.mockImplementation(async () => [
        createFileInfo('file1.csv', { size: 512 * 1024 }),
        createFileInfo('file2.csv', { size: 512 * 1024 }),
        createFileInfo('file3.csv')
      ]);

      await southWithLimit.directQuery(southWithLimit.connectorConfiguration.items);

      assert.strictEqual(ftpClient.downloadTo.mock.calls.length, 2);
      assert.ok(logIncludes(logger.debug, 'Max size limit (1 MB) reached for item item1, skipping remaining files'));
    });

    it('should start a connector with a different id', async () => {
      const newSouth = createSouth({ ...configuration, id: 'southId-not-test' });
      // Forget the logs of the connector started in beforeEach (they share the logger)
      logger.debug.mock.resetCalls();

      await newSouth.start();

      assert.ok(logIncludes(logger.debug, 'enabled'));
    });

    it('should handle download error', async () => {
      ftpClient.downloadTo.mock.mockImplementation(async () => {
        throw new Error('Download failed');
      });

      await assert.rejects(south.getFile(createFileInfo('test.csv'), configuration.items[0], []), new Error('Download failed'));
    });

    it('should handle file unlink error after compression', async () => {
      unlink.mock.mockImplementation(async () => {
        throw new Error('Unlink failed');
      });
      const southWithCompression = await startSouthWith({ compression: true });

      await southWithCompression.getFile(createFileInfo('test.csv'), configuration.items[0], []);

      assert.deepStrictEqual(addContentCallback.mock.calls[0].arguments[1], {
        type: 'any',
        filePath: path.resolve('cacheFolder', 'tmp', 'test.csv.gz')
      });
    });

    it('should handle empty username and password', async () => {
      const southWithoutCredentials = createSouth(buildConfiguration({ username: '', password: '' }));

      await southWithoutCredentials.testConnection();

      assert.deepStrictEqual(ftpClient.access.mock.calls.at(-1)!.arguments[0], {
        host: '127.0.0.1',
        port: 21,
        user: '',
        password: '',
        secure: false
      });
    });

    it('should handle preserveFiles with ignoreModifiedDate true', () => {
      const item = configuration.items[2]; // preserveFiles: true, ignoreModifiedDate: true

      const result = south.checkCondition(item, createFileInfo('test.txt'), []);
      assert.strictEqual(result, true);
    });

    it('should fall back to the current timestamp when modifiedAt is undefined', () => {
      const item = configuration.items[0]; // regex: '.*.csv', no ignoreModifiedDate
      const now = DateTime.now().toMillis();

      // checkAge itself is mocked (always returns true) - assert on the mtimeMs it was called with
      // instead, since that's the actual behavior under test here: falling back to now + minAge.
      south.checkCondition(item, createFileInfo('test.csv', { modifiedAt: undefined }), []);

      const lastCall = utilsExports.checkAge.mock.calls.at(-1)!;
      assert.strictEqual(lastCall.arguments[2], now + item.settings.minAge);
    });

    it('should handle regex not matching', () => {
      const result = south.checkCondition(configuration.items[0], createFileInfo('test.xml'), []); // regex: '.*.csv'
      assert.strictEqual(result, false);
    });

    it('should handle try-catch blocks properly in getFile with compression error and unlink error', async () => {
      utilsExports.compress.mock.mockImplementation(async () => {
        throw new Error('Compression failed');
      });
      unlink.mock.mockImplementation(async () => {
        throw new Error('Unlink failed');
      });
      const southWithCompression = await startSouthWith({ compression: true });

      await southWithCompression.getFile(createFileInfo('test.csv'), configuration.items[0], []);

      assert.deepStrictEqual(addContentCallback.mock.calls[0].arguments[1], {
        type: 'any',
        filePath: path.resolve('cacheFolder', 'tmp', 'test.csv')
      });
    });

    it('should handle password decryption', async () => {
      const southWithEncryptedPassword = createSouth(buildConfiguration({ password: 'encrypted-password' }));

      await southWithEncryptedPassword.testConnection();

      assert.ok(decryptText.mock.calls.some(c => c.arguments[0] === 'encrypted-password'));
      assert.deepStrictEqual(ftpClient.access.mock.calls.at(-1)!.arguments[0], {
        host: '127.0.0.1',
        port: 21,
        user: 'user',
        password: 'decrypted-password',
        secure: false
      });
    });

    it('should handle file with modifiedAt date that is newer than cached version', () => {
      southCacheRepository.getItemLastValue.mock.mockImplementation(() => ({
        itemId: 'id2',
        groupId: null,
        queryTime: null,
        trackedInstant: null,
        value: [{ filename: 'test.log', modifiedTime: DateTime.now().minus({ minutes: 5 }).toMillis() }]
      }));
      const fileInfo = createFileInfo('test.log', { modifiedAt: new Date(DateTime.now().minus({ minutes: 1 }).toMillis()) });

      const result = south.checkCondition(configuration.items[1], fileInfo, []); // preserveFiles: true, ignoreModifiedDate: false

      assert.strictEqual(result, true);
    });

    it('should handle file with undefined modifiedAt date in getFile', async () => {
      await south.getFile(createFileInfo('test.csv', { modifiedAt: undefined }), configuration.items[1], []); // preserveFiles: true

      assert.ok(ftpClient.downloadTo.mock.calls.length > 0);
    });

    it('should handle file unlink error in non-compression mode', async () => {
      unlink.mock.mockImplementation(async () => {
        throw new Error('Unlink failed');
      });

      await south.getFile(createFileInfo('test.csv'), configuration.items[0], []);

      assert.deepStrictEqual(addContentCallback.mock.calls[0].arguments[1], {
        type: 'any',
        filePath: path.resolve('cacheFolder', 'tmp', 'test.csv')
      });
    });

    it('should handle compression error and unlink error', async () => {
      utilsExports.compress.mock.mockImplementation(async () => {
        throw new Error('Compression failed');
      });
      unlink.mock.mockImplementation(async () => {
        throw new Error('Unlink failed');
      });
      const southWithCompression = await startSouthWith({ compression: true });

      await southWithCompression.getFile(createFileInfo('test.csv'), configuration.items[0], []);

      assert.deepStrictEqual(addContentCallback.mock.calls[0].arguments[1], {
        type: 'any',
        filePath: path.resolve('cacheFolder', 'tmp', 'test.csv')
      });
    });
  });
});
