import { describe, it, before, beforeEach, afterEach, mock, type Mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import testData from '../../tests/utils/test-data';
import { mockModule, reloadModule } from '../../tests/utils/test-utils';
import SouthCacheRepositoryMock from '../../tests/__mocks__/repository/cache/south-cache-repository.mock';
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
  // Recreated fresh in beforeEach (not a shared const) — some tests override its methods
  // (e.g. getItemLastValue), which must not bleed into later tests.
  let southCacheRepository: SouthCacheRepository;

  const mockFtpClient = {
    access: mock.fn(async (_options?: AccessOptions) => undefined),
    list: mock.fn(async (_path?: string) => [] as Array<FileInfo>),
    downloadTo: mock.fn(async (_dest: string, _remote: string) => undefined),
    remove: mock.fn(async (_path: string) => undefined),
    close: mock.fn(() => undefined),
    closed: false
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
    mockModule(nodeRequire, '../../service/logger/logger.service', {
      loggerService: { createChildLogger: mock.fn(() => logger) },
      default: class {}
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

  // Some log calls are `logger.debug/error(logCtx, message)` (structured context first) and others
  // are plain `logger.debug/error(message)` — this checks either shape without caring which.
  const logIncludes = (mockFn: { mock: { calls: Array<{ arguments: Array<unknown> }> } }, text: string): boolean =>
    mockFn.mock.calls.some(c => c.arguments.some(arg => typeof arg === 'string' && arg.includes(text)));

  beforeEach(() => {
    southCacheRepository = new SouthCacheRepositoryMock() as unknown as SouthCacheRepository;
    addContentCallback.mock.resetCalls();

    ftpExports.Client.mock.resetCalls();

    mockFtpClient.access = mock.fn(async (_options?: AccessOptions) => undefined);
    mockFtpClient.list = mock.fn(async (_path?: string) => [] as Array<FileInfo>);
    mockFtpClient.downloadTo = mock.fn(async (_dest: string, _remote: string) => undefined);
    mockFtpClient.remove = mock.fn(async (_path: string) => undefined);
    mockFtpClient.close = mock.fn(() => undefined);
    mockFtpClient.closed = false;

    utilsExports.checkAge.mock.resetCalls();
    utilsExports.checkAge.mock.mockImplementation(() => true);
    utilsExports.compress.mock.resetCalls();
    utilsExports.compress.mock.mockImplementation(async (_input: string, _output: string) => undefined);
    utilsExports.getErrorMessage.mock.resetCalls();
    utilsExports.workUnitLogCtx.mock.resetCalls();

    encryptionExports.encryptionService.decryptText.mock.resetCalls();
    encryptionExports.encryptionService.decryptText.mock.mockImplementation(async (_text?: string | null) => 'decrypted-password');

    mock.method(fs, 'mkdir', async () => undefined);
    mock.method(fs, 'unlink', async () => undefined);

    mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date(testData.constants.dates.FAKE_NOW) });

    south = new SouthFtp(configuration, addContentCallback, southCacheRepository, 'cacheFolder');
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  describe('connect / disconnect / reconnect', () => {
    it('should properly connect and establish a persistent client', async () => {
      await south.connect();

      assert.strictEqual(ftpExports.Client.mock.calls.length, 1);
      assert.strictEqual(mockFtpClient.access.mock.calls.length, 1);
      assert.deepStrictEqual(mockFtpClient.access.mock.calls[0].arguments[0], {
        host: '127.0.0.1',
        port: 21,
        user: 'user',
        password: 'decrypted-password',
        secure: false
      });
      assert.strictEqual((south as unknown as Record<string, unknown>)['client'], mockFtpClient);
      assert.ok(logIncludes(logger.debug, 'Connecting to FTP server 127.0.0.1:21'));
      assert.ok(logIncludes(logger.info, 'Connected to FTP server 127.0.0.1:21'));
    });

    it('should reuse the same persistent client across multiple listFiles/getFile calls', async () => {
      await south.connect();
      const fileInfo = createMockFileInfo('test.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));
      mockFtpClient.list.mock.mockImplementation(async () => [fileInfo]);

      await south.listFiles(configuration.items[0], []);
      await south.getFile(fileInfo, configuration.items[0], []);
      await south.listFiles(configuration.items[0], []);

      // Only the connect() call created a client — listFiles/getFile reused it.
      assert.strictEqual(ftpExports.Client.mock.calls.length, 1);
      assert.strictEqual(mockFtpClient.access.mock.calls.length, 1);
      assert.strictEqual(mockFtpClient.close.mock.calls.length, 0);
    });

    it('should schedule a reconnect when connect() fails', async () => {
      mockFtpClient.access.mock.mockImplementation(async () => {
        throw new Error('connect error');
      });

      await south.connect();

      assert.strictEqual((south as unknown as Record<string, unknown>)['client'], null);
      assert.ok(logIncludes(logger.error, 'Error while connecting to FTP server 127.0.0.1:21: connect error'));

      mockFtpClient.access.mock.mockImplementation(async () => undefined);
      mock.timers.tick(configuration.settings.retryInterval);
      // Let the scheduled connect() (which is async) run to completion.
      await Promise.resolve();
      await Promise.resolve();

      assert.strictEqual(ftpExports.Client.mock.calls.length, 2);
    });

    it('should not schedule a reconnect on connect error when disconnecting is true', async () => {
      // Mock disconnect() so the real implementation's own disconnecting=false reset at the end
      // doesn't mask what we're testing here (mirrors south-modbus.spec.ts's equivalent test).
      const disconnectMock = mock.fn(async (): Promise<void> => undefined);
      south.disconnect = disconnectMock;
      (south as unknown as Record<string, unknown>)['disconnecting'] = true;
      mockFtpClient.access.mock.mockImplementation(async () => {
        throw new Error('connect error');
      });

      await south.connect();

      assert.strictEqual(disconnectMock.mock.calls.length, 1);
      mock.timers.tick(configuration.settings.retryInterval);
      assert.strictEqual(ftpExports.Client.mock.calls.length, 1);
    });

    it('should properly disconnect an active client', async () => {
      await south.connect();

      await south.disconnect();

      assert.strictEqual(mockFtpClient.close.mock.calls.length, 1);
      assert.strictEqual((south as unknown as Record<string, unknown>)['client'], null);
      assert.ok(logIncludes(logger.info, 'Disconnected from FTP server 127.0.0.1:21'));
    });

    it('should properly disconnect without an active client', async () => {
      await south.disconnect();
      // Nothing should throw, and close() must not be called since there was no client.
      assert.strictEqual(mockFtpClient.close.mock.calls.length, 0);
    });

    it('should clear a pending reconnect timeout on disconnect', async () => {
      (south as unknown as Record<string, unknown>)['reconnectTimeout'] = setTimeout(() => null, 1000);

      await south.disconnect();

      assert.strictEqual((south as unknown as Record<string, unknown>)['reconnectTimeout'], null);
    });

    it('should treat a listFiles failure as a lost connection and reconnect when the client reports itself closed', async () => {
      await south.connect();
      // basic-ftp closes the client automatically on a timeout/connection-level error — simulate
      // that real contract, not just an arbitrary thrown message.
      mockFtpClient.list.mock.mockImplementation(async () => {
        mockFtpClient.closed = true;
        throw new Error('Client is closed because of a timeout');
      });

      await assert.rejects(south.directQuery([configuration.items[0]]), new Error('Client is closed because of a timeout'));

      // The connection is torn down and a reconnect scheduled.
      assert.strictEqual((south as unknown as Record<string, unknown>)['client'], null);
      assert.strictEqual(mockFtpClient.close.mock.calls.length, 1);

      mockFtpClient.closed = false;
      mockFtpClient.list.mock.mockImplementation(async () => []);
      mock.timers.tick(configuration.settings.retryInterval);
      await Promise.resolve();
      await Promise.resolve();

      assert.strictEqual(ftpExports.Client.mock.calls.length, 2);
    });

    it('should not disconnect or reconnect when a listFiles failure leaves the client open', async () => {
      await south.connect();
      // An ordinary command failure (e.g. a permission-denied on one file) does not close the
      // client in basic-ftp — the connection is still fine, so nothing should be torn down.
      mockFtpClient.list.mock.mockImplementation(async () => {
        throw new Error('550 Permission denied');
      });

      await assert.rejects(south.directQuery([configuration.items[0]]), new Error('550 Permission denied'));

      assert.notStrictEqual((south as unknown as Record<string, unknown>)['client'], null);
      assert.strictEqual(mockFtpClient.close.mock.calls.length, 0);
      mock.timers.tick(configuration.settings.retryInterval);
      assert.strictEqual(ftpExports.Client.mock.calls.length, 1);
    });

    it('should not reconnect after a lost-connection directQuery failure while disconnecting', async () => {
      await south.connect();
      // Mock disconnect() so the real implementation's own disconnecting=false reset at the end
      // doesn't mask what we're testing here (mirrors south-modbus.spec.ts's equivalent test).
      const disconnectMock = mock.fn(async (): Promise<void> => undefined);
      south.disconnect = disconnectMock;
      (south as unknown as Record<string, unknown>)['disconnecting'] = true;
      mockFtpClient.list.mock.mockImplementation(async () => {
        mockFtpClient.closed = true;
        throw new Error('boom');
      });

      await assert.rejects(south.directQuery([configuration.items[0]]), new Error('boom'));

      assert.strictEqual(disconnectMock.mock.calls.length, 1);
      mock.timers.tick(configuration.settings.retryInterval);
      assert.strictEqual(ftpExports.Client.mock.calls.length, 1);
    });

    it('should throw from listFiles when the client is not connected', async () => {
      // No connect() call — this.client stays null.
      await assert.rejects(south.listFiles(configuration.items[0], []), new Error('FTP client is not connected'));
      assert.strictEqual(mockFtpClient.list.mock.calls.length, 0);
    });

    it('should throw from listFiles when the client reports itself as closed', async () => {
      await south.connect();
      mockFtpClient.closed = true;

      await assert.rejects(south.listFiles(configuration.items[0], []), new Error('FTP client is not connected'));
      assert.strictEqual(mockFtpClient.list.mock.calls.length, 0);
    });

    it('should throw from getFile when the client is not connected', async () => {
      const fileInfo = createMockFileInfo('test.csv', new Date());
      await assert.rejects(south.getFile(fileInfo, configuration.items[0], []), new Error('FTP client is not connected'));
      assert.strictEqual(mockFtpClient.downloadTo.mock.calls.length, 0);
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
      // testConnection() opened and closed its own local client.
      assert.strictEqual(ftpExports.Client.mock.calls.length, 1);
      assert.strictEqual(mockFtpClient.close.mock.calls.length, 1);
    });

    it('should never touch the persistent client in testItem', async () => {
      const sentinelClient = { marker: 'persistent-client-sentinel' };
      (south as unknown as Record<string, unknown>)['client'] = sentinelClient;
      const disconnectSpy = mock.method(south, 'disconnect');
      const fileInfo = createMockFileInfo('test.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));
      mockFtpClient.list.mock.mockImplementation(async () => [fileInfo]);

      const result = await south.testItem(configuration.items[0], { history: undefined });

      assert.strictEqual((south as unknown as Record<string, unknown>)['client'], sentinelClient);
      assert.strictEqual(disconnectSpy.mock.calls.length, 0);
      assert.strictEqual(ftpExports.Client.mock.calls.length, 1);
      assert.strictEqual(mockFtpClient.close.mock.calls.length, 1);
      assert.strictEqual(result.result.type, 'time-values');
    });

    it('should test connection', async () => {
      const testResult = await south.testConnection();

      assert.deepStrictEqual(mockFtpClient.access.mock.calls[0].arguments[0], {
        host: '127.0.0.1',
        port: 21,
        user: 'user',
        password: 'decrypted-password',
        secure: false
      });
      assert.strictEqual(mockFtpClient.close.mock.calls.length, 1);
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
      // The local test client is still closed even though access() failed.
      assert.strictEqual(mockFtpClient.close.mock.calls.length, 1);
    });

    it('should test item and separately measure connection and query duration', async () => {
      const fileInfo = createMockFileInfo('test.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));

      mockFtpClient.access.mock.mockImplementation(async () => {
        mock.timers.tick(15);
      });
      mockFtpClient.list.mock.mockImplementation(async () => {
        mock.timers.tick(25);
        return [fileInfo];
      });

      const item = configuration.items[0];
      const result = await south.testItem(item, { history: undefined });

      assert.strictEqual(result.result.type, 'time-values');
      const content = (result.result as { type: string; content: Array<{ pointId: string; timestamp: string; data: { value: string } }> })
        .content;
      assert.strictEqual(content.length, 1);
      assert.strictEqual(content[0].pointId, 'item1');
      assert.ok(typeof content[0].timestamp === 'string');
      assert.deepStrictEqual(content[0].data, { value: 'test.csv' });
      assert.strictEqual(result.connectionDuration, 15);
      assert.strictEqual(result.queryDuration, 25);
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

      mockFtpClient.list.mock.mockImplementation(async () => [fileInfoWithoutDate]);

      const item = configuration.items[0];
      const result = await south.testItem(item, { history: undefined });

      assert.strictEqual(result.result.type, 'time-values');
      assert.strictEqual((result.result as { type: string; content: Array<unknown> }).content.length, 1);
    });
  });

  describe('with a connected client', () => {
    beforeEach(async () => {
      await south.start();
    });

    it('should properly start', () => {
      assert.ok(logIncludes(logger.debug, 'enabled'));
    });

    it('should list files', async () => {
      const fileInfo = createMockFileInfo('test.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));

      mockFtpClient.list.mock.mockImplementation(async () => [fileInfo]);

      const item = configuration.items[0];
      const files = await south.listFiles(item, []);

      assert.deepStrictEqual(files, [fileInfo]);
      assert.deepStrictEqual(mockFtpClient.list.mock.calls[0].arguments[0], 'input');
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
      // getFile() no longer closes the persistent client after each file.
      assert.strictEqual(mockFtpClient.close.mock.calls.length, 0);
    });

    it('should get file with compression', async () => {
      const fileInfo = createMockFileInfo('test.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));

      utilsExports.compress.mock.mockImplementation(async () => undefined);

      const configurationWithCompression = {
        ...configuration,
        settings: { ...configuration.settings, compression: true }
      };

      const southWithCompression = new SouthFtp(configurationWithCompression, addContentCallback, southCacheRepository, 'cacheFolder');
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

      (southCacheRepository as unknown as SouthCacheRepositoryMock).getItemLastValue.mock.mockImplementation(() => null);

      const item = configuration.items[1]; // preserveFiles: true
      await south.getFile(fileInfo, item, []);

      assert.strictEqual(mockFtpClient.remove.mock.calls.length, 0);
    });

    it('should update modifiedTime when file already in filesPreserved', async () => {
      const fileInfo = createMockFileInfo('test.log', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));
      const filesPreserved: Array<{ filename: string; modifiedTime: number }> = [{ filename: 'test.log', modifiedTime: 0 }];

      const item = configuration.items[1]; // preserveFiles: true
      await south.getFile(fileInfo, item, filesPreserved);

      assert.strictEqual(filesPreserved.length, 1);
      assert.ok(filesPreserved[0].modifiedTime > 0);
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

    it('should capture the real error when compression fails and send the file raw instead', async () => {
      const fileInfo = createMockFileInfo('test.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));

      utilsExports.compress.mock.mockImplementation(async () => {
        throw new Error('Compression failed');
      });

      const configurationWithCompression = {
        ...configuration,
        settings: { ...configuration.settings, compression: true }
      };
      const southWithCompression = new SouthFtp(configurationWithCompression, addContentCallback, southCacheRepository, 'cacheFolder');
      await southWithCompression.start();

      const item = configuration.items[0];
      await southWithCompression.getFile(fileInfo, item, []);

      assert.deepStrictEqual(addContentCallback.mock.calls[0].arguments[1], {
        type: 'any',
        filePath: path.resolve('cacheFolder', 'tmp', 'test.csv')
      });
      // The real compression error is captured and logged, not swallowed.
      assert.ok(
        logger.error.mock.calls.some(
          (c: { arguments: Array<unknown> }) =>
            c.arguments.some(arg => typeof arg === 'string' && arg.includes('Error compressing file')) &&
            c.arguments.some(arg => typeof arg === 'string' && arg.includes('Compression failed'))
        )
      );
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
      const southRecursive = new SouthFtp(configRecursive, addContentCallback, southCacheRepository, 'cacheFolder');
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
      const fileWithNoSize = createMockFileInfo('test.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));
      fileWithNoSize.size = 0;

      mockFtpClient.list.mock.mockImplementation(async () => [fileWithNoSize]);

      await south.directQuery([configuration.items[0]]);

      assert.deepStrictEqual(mockFtpClient.downloadTo.mock.calls[0].arguments[0], path.resolve('cacheFolder', 'tmp', 'test.csv'));
    });

    it('should query files and use workUnitLogCtx for structured logging', async () => {
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
      assert.ok(
        utilsExports.workUnitLogCtx.mock.calls.some(c => Array.isArray(c.arguments[0]) && c.arguments[0][0] === configuration.items[0])
      );
    });

    it('should seed filesPreserved from the cached item value when it is an array', async () => {
      const cachedFilesPreserved = [{ filename: 'previous.csv', modifiedTime: 123 }];
      (southCacheRepository as unknown as SouthCacheRepositoryMock).getItemLastValue.mock.mockImplementation(() => ({
        itemId: configuration.items[0].id,
        groupId: null,
        queryTime: null,
        trackedInstant: null,
        value: cachedFilesPreserved
      }));

      mockFtpClient.list.mock.mockImplementation(async () => []);

      const result = await south.directQuery([configuration.items[0]]);

      assert.deepStrictEqual(result, cachedFilesPreserved);
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
      const southWithLimit = new SouthFtp(configWithLimit, addContentCallback, southCacheRepository, 'cacheFolder');
      await southWithLimit.start();

      const file1 = createMockFileInfo('file1.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));
      const file2 = createMockFileInfo('file2.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));
      const file3 = createMockFileInfo('file3.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));

      mockFtpClient.list.mock.mockImplementation(async () => [file1, file2, file3]);

      await southWithLimit.directQuery([configWithLimit.items[0]]);

      assert.strictEqual(mockFtpClient.downloadTo.mock.calls.length, 2);
      assert.ok(logIncludes(logger.debug, 'Max files limit (2) reached for item item1, skipping remaining files'));
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
      const southWithLimit = new SouthFtp(configWithLimit, addContentCallback, southCacheRepository, 'cacheFolder');
      await southWithLimit.start();

      const file1 = createMockFileInfo('file1.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));
      const file2 = createMockFileInfo('file2.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));
      const file3 = createMockFileInfo('file3.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));

      mockFtpClient.list.mock.mockImplementationOnce(async () => [file1, file2, file3]);

      await southWithLimit.directQuery(configWithLimit.items);

      assert.strictEqual(mockFtpClient.downloadTo.mock.calls.length, 2);
      assert.ok(logIncludes(logger.debug, 'Max files limit (2) reached for item item1, skipping remaining files'));
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
      const southWithLimit = new SouthFtp(configWithLimit, addContentCallback, southCacheRepository, 'cacheFolder');
      await southWithLimit.start();

      const file1 = createMockFileInfo('file1.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));
      file1.size = 600 * 1024;
      const file2 = createMockFileInfo('file2.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));
      file2.size = 600 * 1024;

      mockFtpClient.list.mock.mockImplementation(async () => [file1, file2]);

      await southWithLimit.directQuery([configWithLimit.items[0]]);

      assert.strictEqual(mockFtpClient.downloadTo.mock.calls.length, 1);
      assert.ok(logIncludes(logger.debug, 'Max size limit (1 MB) reached for item item1, skipping remaining files'));
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
      const southWithLimit = new SouthFtp(configWithLimit, addContentCallback, southCacheRepository, 'cacheFolder');
      await southWithLimit.start();

      const file1 = createMockFileInfo('file1.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));
      file1.size = 512 * 1024;
      const file2 = createMockFileInfo('file2.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));
      file2.size = 512 * 1024;
      const file3 = createMockFileInfo('file3.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));

      mockFtpClient.list.mock.mockImplementation(async () => [file1, file2, file3]);

      await southWithLimit.directQuery(configWithLimit.items);

      assert.strictEqual(mockFtpClient.downloadTo.mock.calls.length, 2);
      assert.ok(logIncludes(logger.debug, 'Max size limit (1 MB) reached for item item1, skipping remaining files'));
    });

    it('should start a connector with a different id', async () => {
      const configWithDifferentId = { ...configuration, id: 'southId-not-test' };
      const newSouth = new SouthFtp(configWithDifferentId, addContentCallback, southCacheRepository, 'cacheFolder');

      (logger.debug as Mock<(...args: Array<unknown>) => unknown>).mock.resetCalls();
      await newSouth.start();

      assert.ok(logIncludes(logger.debug, 'enabled'));
    });

    it('should handle download error', async () => {
      const fileInfo = createMockFileInfo('test.csv', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));

      mockFtpClient.downloadTo.mock.mockImplementation(async () => {
        throw new Error('Download failed');
      });

      const item = configuration.items[0];
      await assert.rejects(south.getFile(fileInfo, item, []), new Error('Download failed'));
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
      const southWithCompression = new SouthFtp(configurationWithCompression, addContentCallback, southCacheRepository, 'cacheFolder');
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
      const southWithoutCredentials = new SouthFtp(configWithoutCredentials, addContentCallback, southCacheRepository, 'cacheFolder');

      mockFtpClient.access.mock.resetCalls();
      await southWithoutCredentials.testConnection();

      assert.deepStrictEqual(mockFtpClient.access.mock.calls[0].arguments[0], {
        host: '127.0.0.1',
        port: 21,
        user: '',
        password: '',
        secure: false
      });
    });

    it('should handle preserveFiles with ignoreModifiedDate true', () => {
      const fileInfo = createMockFileInfo('test.txt', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));
      const item = configuration.items[2]; // preserveFiles: true, ignoreModifiedDate: true

      const result = south.checkCondition(item, fileInfo, []);
      assert.strictEqual(result, true);
    });

    it('should fall back to the current timestamp when modifiedAt is undefined', () => {
      const fileInfoWithoutDate: FileInfo = {
        ...createMockFileInfo('test.csv', new Date()),
        modifiedAt: undefined
      } as unknown as FileInfo;
      const item = configuration.items[0]; // regex: '.*.csv', no ignoreModifiedDate
      const now = DateTime.now().toMillis();

      // checkAge itself is mocked (always returns true) - assert on the mtimeMs it was called with
      // instead, since that's the actual behavior under test here: falling back to now + minAge.
      south.checkCondition(item, fileInfoWithoutDate, []);

      const lastCall = utilsExports.checkAge.mock.calls.at(-1)!;
      assert.strictEqual(lastCall.arguments[2], now + item.settings.minAge);
    });

    it('should handle regex not matching', () => {
      const fileInfo = createMockFileInfo('test.xml', new Date(DateTime.now().minus({ minutes: 2 }).toMillis()));
      const item = configuration.items[0]; // regex: '.*.csv'

      const result = south.checkCondition(item, fileInfo, []);
      assert.strictEqual(result, false);
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
      const southWithCompression = new SouthFtp(configurationWithCompression, addContentCallback, southCacheRepository, 'cacheFolder');
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
      const southWithEncryptedPassword = new SouthFtp(configWithEncryptedPassword, addContentCallback, southCacheRepository, 'cacheFolder');

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

      (southCacheRepository as unknown as SouthCacheRepositoryMock).getItemLastValue.mock.mockImplementation(() => ({
        itemId: 'id2',
        groupId: null,
        queryTime: null,
        trackedInstant: null,
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

      assert.ok(mockFtpClient.downloadTo.mock.calls.length > 0);
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
      const southWithCompression = new SouthFtp(configurationWithCompression, addContentCallback, southCacheRepository, 'cacheFolder');
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
