import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import testData from '../../tests/utils/test-data';
import { mockModule, reloadModule, asLogger } from '../../tests/utils/test-utils';
import SouthCacheRepositoryMock from '../../tests/__mocks__/repository/cache/south-cache-repository.mock';
import SouthCacheServiceMock from '../../tests/__mocks__/service/south-cache-service.mock';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import type { SouthSFTPItemSettings, SouthSFTPSettings } from '../../../shared/model/south-settings.model';
import type { SouthConnectorEntity } from '../../model/south-connector.model';
import type SouthSftpClass from './south-sftp';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';
import type { FileInfo } from 'ssh2-sftp-client';
import { DateTime } from 'luxon';

const nodeRequire = createRequire(import.meta.url);

const encryptionServiceMock = new EncryptionServiceMock('', '');

const mockSftpClient = {
  connect: mock.fn(async () => undefined),
  list: mock.fn(async () => [] as Array<FileInfo>),
  fastGet: mock.fn(async () => undefined),
  delete: mock.fn(async () => undefined),
  end: mock.fn(async () => undefined)
};

const sftpClientExports = {
  __esModule: true,
  default: mock.fn(function () {
    return mockSftpClient;
  }) as unknown as new () => typeof mockSftpClient
};
(sftpClientExports as { default: { default: unknown } }).default.default = sftpClientExports.default;

const utilsExports = {
  checkAge: mock.fn(() => true),
  compress: mock.fn(async () => undefined),
  delay: mock.fn(async () => undefined),
  generateIntervals: mock.fn(() => []),
  groupItemsByGroup: mock.fn(() => []),
  validateCronExpression: mock.fn(() => ({ expression: '' }))
};

describe('SouthSFTP', () => {
  let SouthSftp: typeof SouthSftpClass;
  let south: SouthSftpClass;

  const logger = new PinoLogger();
  const addContentCallback = mock.fn();
  const southCacheRepository = new SouthCacheRepositoryMock() as unknown as SouthCacheRepository;
  let southCacheService: SouthCacheServiceMock;

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
    mockModule(nodeRequire, '../../service/south-cache.service', {
      __esModule: true,
      default: function () {
        return southCacheService;
      }
    });
    SouthSftp = reloadModule<{ default: typeof SouthSftpClass }>(nodeRequire, './south-sftp').default;
  });

  beforeEach(() => {
    southCacheService = new SouthCacheServiceMock();
    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW).getTime() });
    mockSftpClient.connect.mock.resetCalls();
    mockSftpClient.list.mock.resetCalls();
    mockSftpClient.fastGet.mock.resetCalls();
    mockSftpClient.delete.mock.resetCalls();
    mockSftpClient.end.mock.resetCalls();
    mockSftpClient.list = mock.fn(async () => [] as Array<FileInfo>);
    utilsExports.checkAge = mock.fn(() => true);
    utilsExports.compress = mock.fn(async () => undefined);
    addContentCallback.mock.resetCalls();
    encryptionServiceMock.decryptText.mock.resetCalls();

    south = new SouthSftp(configuration, addContentCallback, southCacheRepository, asLogger(logger), 'cacheFolder');
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
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
    assert.ok(
      logger.debug.mock.calls.some(c =>
        (c.arguments[0] as string).includes(`Folder ${configuration.items[0].settings.remoteFolder} listed 2 files`)
      )
    );
    assert.strictEqual(getFileMock.calls.length, 2);
    assert.deepStrictEqual(getFileMock.calls[0].arguments[0], fileInfo1);
    assert.deepStrictEqual(getFileMock.calls[0].arguments[1], configuration.items[0]);
    assert.deepStrictEqual(getFileMock.calls[0].arguments[2], []);
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
    const southWithLimit = new SouthSftp(configWithLimit, addContentCallback, southCacheRepository, asLogger(logger), 'cacheFolder');
    await southWithLimit.start();

    const mtimeMs = DateTime.fromISO(testData.constants.dates.FAKE_NOW).minus({ minutes: 2 }).toMillis();
    const file1 = { name: 'file1.csv', size: 100, modifyTime: mtimeMs } as FileInfo;
    const file2 = { name: 'file2.csv', size: 100, modifyTime: mtimeMs } as FileInfo;
    const file3 = { name: 'file3.csv', size: 100, modifyTime: mtimeMs } as FileInfo;

    mockSftpClient.list = mock.fn(async () => [file1, file2, file3]);
    mockSftpClient.fastGet = mock.fn(async () => undefined);
    mockSftpClient.delete = mock.fn(async () => undefined);

    await southWithLimit.directQuery([configWithLimit.items[0]]);

    assert.strictEqual(mockSftpClient.fastGet.mock.calls.length, 2);
    assert.ok(
      logger.debug.mock.calls.some(c =>
        (c.arguments[0] as string).includes('Max files limit (2) reached for item item1, skipping remaining files')
      )
    );
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
    const southWithLimit = new SouthSftp(configWithLimit, addContentCallback, southCacheRepository, asLogger(logger), 'cacheFolder');
    await southWithLimit.start();

    const mtimeMs = DateTime.fromISO(testData.constants.dates.FAKE_NOW).minus({ minutes: 2 }).toMillis();
    const file1 = { name: 'file1.csv', size: 100, modifyTime: mtimeMs } as FileInfo;
    const file2 = { name: 'file2.csv', size: 100, modifyTime: mtimeMs } as FileInfo;
    const file3 = { name: 'file3.csv', size: 100, modifyTime: mtimeMs } as FileInfo;

    let listCallCount = 0;
    mockSftpClient.list = mock.fn(async () => {
      listCallCount++;
      return listCallCount === 1 ? [file1, file2, file3] : [];
    });
    mockSftpClient.fastGet = mock.fn(async () => undefined);
    mockSftpClient.delete = mock.fn(async () => undefined);

    await southWithLimit.directQuery(configWithLimit.items);

    assert.strictEqual(mockSftpClient.fastGet.mock.calls.length, 2);
    assert.ok(
      logger.debug.mock.calls.some(c =>
        (c.arguments[0] as string).includes('Max files limit (2) reached for item item1, skipping remaining files')
      )
    );
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
    const southWithLimit = new SouthSftp(configWithLimit, addContentCallback, southCacheRepository, asLogger(logger), 'cacheFolder');
    await southWithLimit.start();

    const mtimeMs = DateTime.fromISO(testData.constants.dates.FAKE_NOW).minus({ minutes: 2 }).toMillis();
    const file1 = { name: 'file1.csv', size: 600 * 1024, modifyTime: mtimeMs } as FileInfo;
    const file2 = { name: 'file2.csv', size: 600 * 1024, modifyTime: mtimeMs } as FileInfo;

    mockSftpClient.list = mock.fn(async () => [file1, file2]);
    mockSftpClient.fastGet = mock.fn(async () => undefined);
    mockSftpClient.delete = mock.fn(async () => undefined);

    await southWithLimit.directQuery([configWithLimit.items[0]]);

    assert.strictEqual(mockSftpClient.fastGet.mock.calls.length, 1);
    assert.ok(
      logger.debug.mock.calls.some(c =>
        (c.arguments[0] as string).includes('Max size limit (1 MB) reached for item item1, skipping remaining files')
      )
    );
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
    const southWithLimit = new SouthSftp(configWithLimit, addContentCallback, southCacheRepository, asLogger(logger), 'cacheFolder');
    await southWithLimit.start();

    const mtimeMs = DateTime.fromISO(testData.constants.dates.FAKE_NOW).minus({ minutes: 2 }).toMillis();
    const file1 = { name: 'file1.csv', size: 512 * 1024, modifyTime: mtimeMs } as FileInfo;
    const file2 = { name: 'file2.csv', size: 512 * 1024, modifyTime: mtimeMs } as FileInfo;
    const file3 = { name: 'file3.csv', size: 100, modifyTime: mtimeMs } as FileInfo;

    let listCallCount = 0;
    mockSftpClient.list = mock.fn(async () => {
      listCallCount++;
      return listCallCount === 1 ? [file1, file2, file3] : [];
    });
    mockSftpClient.fastGet = mock.fn(async () => undefined);
    mockSftpClient.delete = mock.fn(async () => undefined);

    await southWithLimit.directQuery(configWithLimit.items);

    assert.strictEqual(mockSftpClient.fastGet.mock.calls.length, 2);
    assert.ok(
      logger.debug.mock.calls.some(c =>
        (c.arguments[0] as string).includes('Max size limit (1 MB) reached for item item1, skipping remaining files')
      )
    );
  });

  it('should properly get file', async () => {
    mock.method(
      south,
      'addContent',
      mock.fn(async () => undefined)
    );

    const fileInfo = { name: 'myFile1', size: 123 } as FileInfo;
    await south.getFile(fileInfo, configuration.items[0], []);

    assert.strictEqual(mockSftpClient.connect.mock.calls.length, 1);
    assert.strictEqual(mockSftpClient.fastGet.mock.calls.length, 1);
    assert.strictEqual(mockSftpClient.delete.mock.calls.length, 1);
    assert.strictEqual(mockSftpClient.end.mock.calls.length, 1);

    const addContentMock = (south.addContent as unknown as { mock: { calls: Array<{ arguments: Array<unknown> }> } }).mock;
    assert.deepStrictEqual(addContentMock.calls[0].arguments[0], {
      type: 'any',
      filePath: path.resolve('cacheFolder', 'tmp', fileInfo.name)
    });
    assert.strictEqual(addContentMock.calls[0].arguments[1], testData.constants.dates.FAKE_NOW);
    assert.deepStrictEqual(addContentMock.calls[0].arguments[2], [configuration.items[0]]);
    assert.strictEqual(logger.error.mock.calls.length, 0);

    // Test delete error
    mockSftpClient.delete = mock.fn(async () => {
      throw new Error('delete error');
    });
    await south.getFile(fileInfo, configuration.items[0], []);

    assert.ok(
      logger.error.mock.calls.some(c =>
        (c.arguments[0] as string).includes(
          `Error while removing "${configuration.items[0].settings.remoteFolder}/${fileInfo.name}": ${new Error('delete error')}`
        )
      )
    );
    assert.strictEqual(addContentMock.calls.length, 2);
    assert.strictEqual(mockSftpClient.end.mock.calls.length, 2);
  });

  it('should properly list files', async () => {
    const fileInfo = { name: 'myFile' } as FileInfo;
    mock.method(
      south,
      'checkCondition',
      mock.fn(() => true)
    );
    mockSftpClient.list = mock.fn(async (_folder: string, callback?: (fi: FileInfo) => boolean) => {
      if (callback) callback(fileInfo);
      return [fileInfo];
    });
    configuration.settings.username = '';
    configuration.settings.password = '';
    const result = await south.listFiles(configuration.items[0], []);
    assert.strictEqual(encryptionServiceMock.decryptText.mock.calls.length, 0);
    assert.strictEqual(mockSftpClient.connect.mock.calls.length, 1);
    assert.strictEqual(mockSftpClient.end.mock.calls.length, 1);
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
    const southRecursive = new SouthSftp(configRecursive, addContentCallback, southCacheRepository, asLogger(logger), 'cacheFolder');
    await southRecursive.start();

    const mtimeMs = DateTime.fromISO(testData.constants.dates.FAKE_NOW).minus({ minutes: 2 }).toMillis();
    const dirEntry = { type: 'd', name: 'subdir' } as FileInfo;
    const fileInSubdir = { type: '-', name: 'file.csv', size: 100, modifyTime: mtimeMs } as FileInfo;
    const fileFailsCondition = { type: '-', name: 'other.xml', size: 100, modifyTime: mtimeMs } as FileInfo;

    let listCallCount = 0;
    mockSftpClient.list = mock.fn(async () => {
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
});

describe('SouthFTP with preserve file and compression', () => {
  let SouthSftp: typeof SouthSftpClass;
  let south: SouthSftpClass;

  const logger = new PinoLogger();
  const addContentCallback = mock.fn();
  const southCacheRepository = new SouthCacheRepositoryMock() as unknown as SouthCacheRepository;
  let southCacheService: SouthCacheServiceMock;

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

  before(() => {
    mockModule(nodeRequire, '../../service/utils', utilsExports);
    mockModule(nodeRequire, 'ssh2-sftp-client', sftpClientExports);
    mockModule(nodeRequire, '../../service/encryption.service', {
      __esModule: true,
      encryptionService: encryptionServiceMock
    });
    mockModule(nodeRequire, '../../service/south-cache.service', {
      __esModule: true,
      default: function () {
        return southCacheService;
      }
    });
    SouthSftp = reloadModule<{ default: typeof SouthSftpClass }>(nodeRequire, './south-sftp').default;
  });

  beforeEach(async () => {
    southCacheService = new SouthCacheServiceMock();
    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW).getTime() });
    mockSftpClient.connect.mock.resetCalls();
    mockSftpClient.list.mock.resetCalls();
    mockSftpClient.fastGet.mock.resetCalls();
    mockSftpClient.delete.mock.resetCalls();
    mockSftpClient.end.mock.resetCalls();
    mockSftpClient.list = mock.fn(async () => [] as Array<FileInfo>);
    mockSftpClient.fastGet = mock.fn(async () => undefined);
    mockSftpClient.delete = mock.fn(async () => undefined);
    utilsExports.compress = mock.fn(async () => undefined);
    addContentCallback.mock.resetCalls();
    encryptionServiceMock.decryptText.mock.resetCalls();

    south = new SouthSftp(configuration, addContentCallback, southCacheRepository, asLogger(logger), 'cacheFolder');
    await south.start();
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  it('should properly add compressed file', async () => {
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
    assert.strictEqual(mockSftpClient.end.mock.calls.length, 1);

    // Second call — 3rd unlink throws
    fileInfo.name = 'myFile2';
    await south.getFile(fileInfo, configuration.items[1], []);
    assert.deepStrictEqual(addContentMock.calls[1].arguments[0], {
      type: 'any',
      filePath: `${path.resolve('cacheFolder', 'tmp', 'myFile2')}.gz`
    });
    assert.ok(
      logger.error.mock.calls.some(c =>
        (c.arguments[0] as string).includes(`Error while removing compressed file "${path.resolve('cacheFolder', 'tmp', 'myFile2')}.gz"`)
      )
    );

    // Third call — compress throws
    utilsExports.compress = mock.fn(async () => {
      throw new Error('compression error');
    });
    await south.getFile(fileInfo, configuration.items[1], []);
    assert.deepStrictEqual(addContentMock.calls[2].arguments[0], {
      type: 'any',
      filePath: path.resolve('cacheFolder', 'tmp', 'myFile2')
    });
    assert.ok(
      logger.error.mock.calls.some(c =>
        (c.arguments[0] as string).includes(
          `Error compressing file "${path.resolve('cacheFolder', 'tmp', fileInfo.name)}". Sending it raw instead`
        )
      )
    );
  });
});

describe('SouthSFTP test connection with private key', () => {
  let SouthSftp: typeof SouthSftpClass;
  let south: SouthSftpClass;

  const logger = new PinoLogger();
  const addContentCallback = mock.fn();
  const southCacheRepository = new SouthCacheRepositoryMock() as unknown as SouthCacheRepository;
  let southCacheService: SouthCacheServiceMock;

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

  before(() => {
    mockModule(nodeRequire, '../../service/utils', utilsExports);
    mockModule(nodeRequire, 'ssh2-sftp-client', sftpClientExports);
    mockModule(nodeRequire, '../../service/encryption.service', {
      __esModule: true,
      encryptionService: encryptionServiceMock
    });
    mockModule(nodeRequire, '../../service/south-cache.service', {
      __esModule: true,
      default: function () {
        return southCacheService;
      }
    });
    SouthSftp = reloadModule<{ default: typeof SouthSftpClass }>(nodeRequire, './south-sftp').default;
  });

  beforeEach(() => {
    southCacheService = new SouthCacheServiceMock();
    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW).getTime() });
    mockSftpClient.connect.mock.resetCalls();
    mockSftpClient.list.mock.resetCalls();
    mockSftpClient.fastGet.mock.resetCalls();
    mockSftpClient.delete.mock.resetCalls();
    mockSftpClient.end.mock.resetCalls();
    mockSftpClient.connect = mock.fn(async () => undefined);
    utilsExports.checkAge = mock.fn(() => true);
    addContentCallback.mock.resetCalls();
    encryptionServiceMock.decryptText.mock.resetCalls();

    south = new SouthSftp(configuration, addContentCallback, southCacheRepository, asLogger(logger), 'cacheFolder');
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
    mockSftpClient.connect = mock.fn(async () => {
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

    // Without passphrase — no decryptText call
    configuration.settings.passphrase = '';
    await south.testConnection();
    assert.strictEqual(encryptionServiceMock.decryptText.mock.calls.length, 1);
    assert.strictEqual(readFileMock.mock.calls.length, 2);
  });

  it('should test item', async () => {
    mock.method(
      south,
      'listFiles',
      mock.fn(async () => [{ name: 'file.csv', modifyTime: DateTime.now().toMillis() }])
    );

    const result = await south.testItem(configuration.items[0], testData.south.itemTestingSettings);

    const listFilesMock = (south.listFiles as unknown as { mock: { calls: Array<unknown> } }).mock;
    assert.strictEqual(listFilesMock.calls.length, 1);
    assert.deepStrictEqual(result, {
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
    mock.method(
      south,
      'listFiles',
      mock.fn(async () => {
        throw error;
      })
    );

    await assert.rejects(south.testItem(configuration.items[0], testData.south.itemTestingSettings), error);

    const listFilesMock = (south.listFiles as unknown as { mock: { calls: Array<unknown> } }).mock;
    assert.strictEqual(listFilesMock.calls.length, 1);
  });
});
