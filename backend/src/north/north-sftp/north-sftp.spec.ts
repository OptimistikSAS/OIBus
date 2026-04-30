import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { ReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import testData from '../../tests/utils/test-data';
import { mockModule, reloadModule, asLogger, buildNorthEntity } from '../../tests/utils/test-utils';
import CacheServiceMock from '../../tests/__mocks__/service/cache/cache-service.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import OIBusTransformerMock from '../../tests/__mocks__/service/transformers/oibus-transformer.mock';
import type { NorthSFTPSettings } from '../../../shared/model/north-settings.model';
import type { NorthConnectorEntity } from '../../model/north-connector.model';
import type NorthSftpClass from './north-sftp';

const nodeRequire = createRequire(import.meta.url);

describe('NorthSFTP', () => {
  let NorthSftp: typeof NorthSftpClass;
  let north: NorthSftpClass;

  const logger = new PinoLogger();
  const cacheService = new CacheServiceMock();
  const oiBusTransformer = new OIBusTransformerMock();

  const mockSftpClient = {
    connect: mock.fn(async () => undefined),
    list: mock.fn(async () => []),
    put: mock.fn(async () => undefined),
    delete: mock.fn(async () => undefined),
    end: mock.fn(async () => undefined),
    exists: mock.fn(async () => 'd' as false | 'd' | '-' | 'l')
  };

  const sftpExports = {
    __esModule: true,
    default: function () {
      return mockSftpClient;
    }
  };

  const transformerExports = {
    createTransformer: mock.fn(() => oiBusTransformer)
  };

  const encryptionExports = {
    __esModule: true,
    encryptionService: {
      decryptText: mock.fn(async (text: string) => text)
    }
  };

  let configuration: NorthConnectorEntity<NorthSFTPSettings>;

  before(() => {
    mockModule(nodeRequire, 'ssh2-sftp-client', sftpExports);
    mockModule(nodeRequire, '../../service/transformer.service', transformerExports);
    mockModule(nodeRequire, '../../service/encryption.service', encryptionExports);
    mockModule(nodeRequire, '../../service/utils', {
      checkAge: mock.fn(() => true),
      compress: mock.fn(async () => undefined),
      delay: mock.fn(async () => undefined),
      generateIntervals: mock.fn(() => []),
      groupItemsByGroup: mock.fn(() => []),
      validateCronExpression: mock.fn(() => ({ expression: '' }))
    });
    mockModule(nodeRequire, '../../service/cache/cache.service', {
      __esModule: true,
      default: function () {
        return cacheService;
      }
    });
    NorthSftp = reloadModule<{ default: typeof NorthSftpClass }>(nodeRequire, './north-sftp').default;
  });

  beforeEach(async () => {
    logger.trace.mock.resetCalls();
    logger.debug.mock.resetCalls();
    logger.info.mock.resetCalls();
    logger.warn.mock.resetCalls();
    logger.error.mock.resetCalls();

    transformerExports.createTransformer.mock.resetCalls();
    encryptionExports.encryptionService.decryptText.mock.resetCalls();
    encryptionExports.encryptionService.decryptText.mock.mockImplementation(async (text: string) => text);

    mockSftpClient.connect = mock.fn(async () => undefined);
    mockSftpClient.list = mock.fn(async () => []);
    mockSftpClient.put = mock.fn(async () => undefined);
    mockSftpClient.delete = mock.fn(async () => undefined);
    mockSftpClient.end = mock.fn(async () => undefined);
    mockSftpClient.exists = mock.fn(async () => 'd' as false | 'd' | '-' | 'l');

    mock.method(fs, 'readFile', async () => 'private-key-content');
    mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date(testData.constants.dates.FAKE_NOW) });

    configuration = buildNorthEntity<NorthSFTPSettings>('sftp', {
      host: '127.0.0.1',
      port: 2222,
      remoteFolder: 'remoteFolder',
      authentication: 'password',
      username: 'user',
      password: 'pass',
      prefix: 'prefix_',
      suffix: '_suffix'
    });

    north = new NorthSftp(configuration, asLogger(logger), cacheService);
    await north.start();
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
    cacheService.cacheSizeEventEmitter.removeAllListeners();
  });

  it('should retrieve supported types', () => {
    assert.deepStrictEqual(north.supportedTypes(), ['any']);
  });

  it('should properly handle files and call sendToSftpServer', async () => {
    const mockStream = {} as ReadStream;
    const expectedFileName = 'prefix_example-123_suffix.file';
    const expectedTarget = `remoteFolder/${expectedFileName}`;

    mock.method(north, 'sendToSftpServer', async () => undefined);

    await north.handleContent(mockStream, {
      contentFile: 'path/to/file/example-123.file',
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'any'
    });

    const sendSpy = north.sendToSftpServer as ReturnType<typeof mock.fn>;
    assert.strictEqual(sendSpy.mock.calls.length, 1);
    assert.deepStrictEqual(sendSpy.mock.calls[0].arguments, [mockStream, expectedTarget]);
  });

  it('should properly catch handle file error', async () => {
    mock.method(north, 'sendToSftpServer', async () => {
      throw new Error('Error handling files');
    });

    const mockStream = {} as ReadStream;
    await assert.rejects(async () => {
      await north.handleContent(mockStream, {
        contentFile: 'path/to/file/example-123.file',
        contentSize: 1234,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'any'
      });
    }, /Error handling files/);
  });

  it('should send content into SFTP server (Password Auth)', async () => {
    const mockStream = {} as ReadStream;
    await north.sendToSftpServer(mockStream, 'remoteFolder/target');

    assert.strictEqual(mockSftpClient.connect.mock.calls.length, 1);
    assert.deepStrictEqual(mockSftpClient.put.mock.calls[0].arguments, [mockStream, 'remoteFolder/target']);
    assert.strictEqual(mockSftpClient.end.mock.calls.length, 1);
    assert.strictEqual(encryptionExports.encryptionService.decryptText.mock.calls.length, 1);
    assert.deepStrictEqual(encryptionExports.encryptionService.decryptText.mock.calls[0].arguments, ['pass']);
  });

  it('should send content into SFTP server without user and password', async () => {
    configuration.settings.username = '';
    configuration.settings.password = null;
    const mockStream = {} as ReadStream;

    await north.sendToSftpServer(mockStream, 'remoteFolder/target');

    assert.strictEqual(mockSftpClient.connect.mock.calls.length, 1);
    assert.deepStrictEqual(mockSftpClient.put.mock.calls[0].arguments, [mockStream, 'remoteFolder/target']);
    assert.strictEqual(mockSftpClient.end.mock.calls.length, 1);
    assert.strictEqual(encryptionExports.encryptionService.decryptText.mock.calls.length, 0);
  });
});

describe('NorthSFTP without suffix or prefix (Private Key Auth)', () => {
  let NorthSftp: typeof NorthSftpClass;
  let north: NorthSftpClass;

  const logger = new PinoLogger();
  const cacheService = new CacheServiceMock();
  const oiBusTransformer = new OIBusTransformerMock();

  const mockSftpClient = {
    connect: mock.fn(async () => undefined),
    list: mock.fn(async () => []),
    put: mock.fn(async () => undefined),
    delete: mock.fn(async () => undefined),
    end: mock.fn(async () => undefined),
    exists: mock.fn(async () => 'd' as false | 'd' | '-' | 'l')
  };

  const sftpExports = {
    __esModule: true,
    default: function () {
      return mockSftpClient;
    }
  };

  const transformerExports = {
    createTransformer: mock.fn(() => oiBusTransformer)
  };

  const encryptionExports = {
    __esModule: true,
    encryptionService: {
      decryptText: mock.fn(async (text: string) => text)
    }
  };

  let configuration: NorthConnectorEntity<NorthSFTPSettings>;

  before(() => {
    mockModule(nodeRequire, 'ssh2-sftp-client', sftpExports);
    mockModule(nodeRequire, '../../service/transformer.service', transformerExports);
    mockModule(nodeRequire, '../../service/encryption.service', encryptionExports);
    mockModule(nodeRequire, '../../service/utils', {
      checkAge: mock.fn(() => true),
      compress: mock.fn(async () => undefined),
      delay: mock.fn(async () => undefined),
      generateIntervals: mock.fn(() => []),
      groupItemsByGroup: mock.fn(() => []),
      validateCronExpression: mock.fn(() => ({ expression: '' }))
    });
    mockModule(nodeRequire, '../../service/cache/cache.service', {
      __esModule: true,
      default: function () {
        return cacheService;
      }
    });
    NorthSftp = reloadModule<{ default: typeof NorthSftpClass }>(nodeRequire, './north-sftp').default;
  });

  beforeEach(async () => {
    logger.trace.mock.resetCalls();
    logger.debug.mock.resetCalls();
    logger.info.mock.resetCalls();
    logger.warn.mock.resetCalls();
    logger.error.mock.resetCalls();

    transformerExports.createTransformer.mock.resetCalls();
    encryptionExports.encryptionService.decryptText.mock.resetCalls();
    encryptionExports.encryptionService.decryptText.mock.mockImplementation(async (text: string) => text);

    mockSftpClient.connect = mock.fn(async () => undefined);
    mockSftpClient.list = mock.fn(async () => []);
    mockSftpClient.put = mock.fn(async () => undefined);
    mockSftpClient.delete = mock.fn(async () => undefined);
    mockSftpClient.end = mock.fn(async () => undefined);
    mockSftpClient.exists = mock.fn(async () => 'd' as false | 'd' | '-' | 'l');

    mock.method(fs, 'readFile', async () => 'actual-private-key-content');
    mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date(testData.constants.dates.FAKE_NOW) });

    configuration = buildNorthEntity<NorthSFTPSettings>('sftp', {
      host: '127.0.0.1',
      port: 2222,
      remoteFolder: 'remoteFolder',
      authentication: 'private-key',
      username: 'user',
      privateKey: 'path/to/private.key',
      passphrase: 'myPassphrase',
      prefix: '',
      suffix: ''
    });

    north = new NorthSftp(configuration, asLogger(logger), cacheService);
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
    cacheService.cacheSizeEventEmitter.removeAllListeners();
  });

  it('should properly handle files (Direct Naming)', async () => {
    mock.method(north, 'sendToSftpServer', async () => undefined);
    const mockStream = {} as ReadStream;

    await north.handleContent(mockStream, {
      contentFile: 'path/to/file/example-123.file',
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'any'
    });

    const sendSpy = north.sendToSftpServer as ReturnType<typeof mock.fn>;
    assert.strictEqual(sendSpy.mock.calls.length, 1);
    assert.deepStrictEqual(sendSpy.mock.calls[0].arguments, [mockStream, 'remoteFolder/example-123.file']);
  });

  it('should use private key for connection', async () => {
    const mockStream = {} as ReadStream;
    await north.sendToSftpServer(mockStream, 'target');

    const readFileSpy = fs.readFile as ReturnType<typeof mock.fn>;
    assert.deepStrictEqual(readFileSpy.mock.calls[0].arguments, ['path/to/private.key', 'utf8']);
    assert.strictEqual(encryptionExports.encryptionService.decryptText.mock.calls.length, 1);
    assert.deepStrictEqual(encryptionExports.encryptionService.decryptText.mock.calls[0].arguments, ['myPassphrase']);

    assert.strictEqual(mockSftpClient.connect.mock.calls.length, 1);
    const connectArg = mockSftpClient.connect.mock.calls[0].arguments[0] as Record<string, unknown>;
    assert.strictEqual(connectArg.username, 'user');
    assert.strictEqual(connectArg.privateKey, 'actual-private-key-content');
    assert.strictEqual(connectArg.passphrase, 'myPassphrase');
  });

  it('should have access to output folder', async () => {
    mockSftpClient.exists = mock.fn(async () => 'd' as false | 'd' | '-' | 'l');

    const testResult = await north.testConnection();

    assert.strictEqual(mockSftpClient.connect.mock.calls.length, 1);
    assert.deepStrictEqual(mockSftpClient.exists.mock.calls[0].arguments, ['remoteFolder']);
    assert.strictEqual(mockSftpClient.end.mock.calls.length, 1);
    assert.deepStrictEqual(testResult, {
      items: [
        { key: 'Host', value: `${configuration.settings.host}:${configuration.settings.port}` },
        { key: 'Remote Folder', value: configuration.settings.remoteFolder }
      ]
    });
  });

  it('should throw an error if no access', async () => {
    mockSftpClient.exists = mock.fn(async () => false as false | 'd' | '-' | 'l');

    await assert.rejects(async () => {
      await north.testConnection();
    }, /Remote target .* does not exist/);
    assert.strictEqual(mockSftpClient.end.mock.calls.length, 1);
  });

  it('should throw an error if it is a file', async () => {
    mockSftpClient.exists = mock.fn(async () => '-' as false | 'd' | '-' | 'l');

    await assert.rejects(async () => {
      await north.testConnection();
    }, /is not a folder/);
    assert.strictEqual(mockSftpClient.end.mock.calls.length, 1);
  });

  it('should handle SFTP error', async () => {
    mockSftpClient.exists = mock.fn(async () => {
      throw new Error('sftp error');
    });

    await assert.rejects(async () => {
      await north.testConnection();
    }, /Access error on .* sftp error/);

    assert.strictEqual(mockSftpClient.end.mock.calls.length, 0);
  });
});
