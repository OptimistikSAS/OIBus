import assert from 'node:assert/strict';
import type { ReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { afterEach, before, beforeEach, describe, it, mock } from 'node:test';

import type SftpClient from 'ssh2-sftp-client';

import type { NorthSFTPSettings } from '../../../shared/model/connector/north-settings.model';
import type { CacheMetadata } from '../../../shared/model/domain/engine.model';

import type EncryptionService from '../../service/encryption.service';
import { createCacheServiceMock } from '../../tests/__mocks__/service/cache/cache-service.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../tests/utils/test-data';
import { buildNorthEntity, createMock, type Mocked, mockModule, reloadModule } from '../../tests/utils/test-utils';
import type NorthSftpClass from './north-sftp';

const nodeRequire = createRequire(import.meta.url);

// The stream is only handed to the (mocked) SFTP client
const mockStream = {} as ReadStream;
const mockReadFile = () => mock.method(fs, 'readFile', async () => 'actual-private-key-content');
const metadata: CacheMetadata = {
  contentFile: 'path/to/file/example-123.file',
  contentSize: 1234,
  numberOfElement: 1,
  createdAt: '2020-02-02T02:02:02.222Z',
  contentType: 'any'
};

describe('NorthSFTP', () => {
  let NorthSftp: typeof NorthSftpClass;
  let north: NorthSftpClass;
  let logger: PinoLogger;
  let sftpClient: Mocked<SftpClient>;
  let encryptionService: Mocked<EncryptionService>;
  let readFileMock: ReturnType<typeof mockReadFile>;

  const sftpExports = {
    __esModule: true,
    default: function () {
      return sftpClient;
    }
  };
  const encryptionExports: Record<string, unknown> = { __esModule: true };

  const createNorth = (settings: NorthSFTPSettings) => {
    north = new NorthSftp(buildNorthEntity<NorthSFTPSettings>('sftp', settings), createCacheServiceMock());
  };

  before(() => {
    mockModule(nodeRequire, 'ssh2-sftp-client', sftpExports);
    mockModule(nodeRequire, '../../service/encryption.service', encryptionExports);
    // No transformation here: don't pay for loading every transformer
    mockModule(nodeRequire, '../../service/transformer.service', {});
    mockModule(nodeRequire, '../../service/logger/logger.service', {
      loggerService: { createChildLogger: () => logger },
      default: class {}
    });

    NorthSftp = reloadModule<{ default: typeof NorthSftpClass }>(nodeRequire, './north-sftp').default;
  });

  beforeEach(() => {
    logger = new PinoLogger();
    sftpClient = createMock<SftpClient>({ exists: async () => 'd' });
    encryptionService = createMock<EncryptionService>({ decryptText: async text => text });
    encryptionExports.encryptionService = encryptionService;
    readFileMock = mockReadFile();
    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  describe('with suffix and prefix (Password Auth)', () => {
    beforeEach(() => {
      createNorth({
        host: '127.0.0.1',
        port: 2222,
        remoteFolder: 'remoteFolder',
        authentication: 'password',
        username: 'user',
        password: 'pass',
        prefix: 'prefix_',
        suffix: '_suffix'
      });
    });

    it('should retrieve supported types', () => {
      assert.deepStrictEqual(north.supportedTypes(), ['any']);
    });

    it('should properly handle files and call sendToSftpServer', async () => {
      const sendSpy = mock.method(north, 'sendToSftpServer', async () => undefined);

      await north.handleContent(mockStream, metadata);

      assert.strictEqual(sendSpy.mock.calls.length, 1);
      assert.deepStrictEqual(sendSpy.mock.calls[0].arguments, [mockStream, 'remoteFolder/prefix_example-123_suffix.file']);
    });

    it('should properly catch handle file error', async () => {
      mock.method(north, 'sendToSftpServer', async () => {
        throw new Error('Error handling files');
      });

      await assert.rejects(north.handleContent(mockStream, metadata), /Error handling files/);
    });

    it('should send content into SFTP server (Password Auth)', async () => {
      await north.sendToSftpServer(mockStream, 'remoteFolder/target');

      assert.strictEqual(sftpClient.connect.mock.calls.length, 1);
      assert.deepStrictEqual(sftpClient.put.mock.calls[0].arguments, [mockStream, 'remoteFolder/target']);
      assert.strictEqual(sftpClient.end.mock.calls.length, 1);
      assert.strictEqual(encryptionService.decryptText.mock.calls.length, 1);
      assert.deepStrictEqual(encryptionService.decryptText.mock.calls[0].arguments, ['pass']);
    });

    it('should send content into SFTP server without user and password', async () => {
      north.connectorConfiguration.settings.username = '';
      north.connectorConfiguration.settings.password = null;

      await north.sendToSftpServer(mockStream, 'remoteFolder/target');

      assert.strictEqual(sftpClient.connect.mock.calls.length, 1);
      assert.deepStrictEqual(sftpClient.put.mock.calls[0].arguments, [mockStream, 'remoteFolder/target']);
      assert.strictEqual(sftpClient.end.mock.calls.length, 1);
      assert.strictEqual(encryptionService.decryptText.mock.calls.length, 0);
    });
  });

  describe('without suffix or prefix (Private Key Auth)', () => {
    beforeEach(() => {
      createNorth({
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
    });

    it('should properly handle files (Direct Naming)', async () => {
      const sendSpy = mock.method(north, 'sendToSftpServer', async () => undefined);

      await north.handleContent(mockStream, metadata);

      assert.strictEqual(sendSpy.mock.calls.length, 1);
      assert.deepStrictEqual(sendSpy.mock.calls[0].arguments, [mockStream, 'remoteFolder/example-123.file']);
    });

    it('should use private key for connection', async () => {
      await north.sendToSftpServer(mockStream, 'target');

      assert.deepStrictEqual(readFileMock.mock.calls[0].arguments, ['path/to/private.key', 'utf8']);
      assert.strictEqual(encryptionService.decryptText.mock.calls.length, 1);
      assert.deepStrictEqual(encryptionService.decryptText.mock.calls[0].arguments, ['myPassphrase']);

      assert.strictEqual(sftpClient.connect.mock.calls.length, 1);
      const connectConfig = sftpClient.connect.mock.calls[0].arguments[0];
      assert.strictEqual(connectConfig.username, 'user');
      assert.strictEqual(connectConfig.privateKey, 'actual-private-key-content');
      assert.strictEqual(connectConfig.passphrase, 'myPassphrase');
    });

    it('should have access to output folder', async () => {
      const testResult = await north.testConnection();

      assert.strictEqual(sftpClient.connect.mock.calls.length, 1);
      assert.deepStrictEqual(sftpClient.exists.mock.calls[0].arguments, ['remoteFolder']);
      assert.strictEqual(sftpClient.end.mock.calls.length, 1);
      assert.deepStrictEqual(testResult, {
        items: [
          { key: 'Host', value: '127.0.0.1:2222' },
          { key: 'Remote Folder', value: 'remoteFolder' }
        ]
      });
    });

    it('should throw an error if no access', async () => {
      sftpClient.exists.mock.mockImplementation(async () => false);

      await assert.rejects(north.testConnection(), /Remote target .* does not exist/);
      assert.strictEqual(sftpClient.end.mock.calls.length, 1);
    });

    it('should throw an error if it is a file', async () => {
      sftpClient.exists.mock.mockImplementation(async () => '-');

      await assert.rejects(north.testConnection(), /is not a folder/);
      assert.strictEqual(sftpClient.end.mock.calls.length, 1);
    });

    it('should handle SFTP error', async () => {
      sftpClient.exists.mock.mockImplementation(async () => {
        throw new Error('sftp error');
      });

      await assert.rejects(north.testConnection(), /Access error on .* sftp error/);
      assert.strictEqual(sftpClient.end.mock.calls.length, 0);
    });
  });
});
