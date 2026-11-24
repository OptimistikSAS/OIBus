import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import type { ReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { afterEach, before, beforeEach, describe, it, type Mock, mock } from 'node:test';

import type SftpClient from 'ssh2-sftp-client';

import type { NorthSFTPSettings } from '../../../shared/model/connector/north-settings.model';
import type { CacheMetadata } from '../../../shared/model/domain/engine.model';
import type { ServerIdentity } from '../../../shared/model/domain/server-identity.model';

import { OIBusError } from '../../model/engine.model';
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
  contentType: 'file'
};

/** A host key in the SSH wire format: the length of the key type, the key type, then the key */
const sshHostKey = (keyType: string): Buffer => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(keyType.length);
  return Buffer.concat([length, Buffer.from(keyType, 'ascii'), Buffer.from('key-data')]);
};

const sshFingerprint = (hostKey: Buffer): string =>
  `SHA256:${crypto.createHash('sha256').update(hostKey).digest('base64').replace(/=+$/, '')}`;

type HostVerifier = (hostKey: Buffer) => boolean;

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
  // The real utils-sftp (the host verifier), the retrieval of the identity of the server being controlled
  const utilsSftpExports: Record<string, unknown> = {};
  let retrieveSshServerIdentity: Mock<(host: string, port: number, username: string) => Promise<ServerIdentity>>;

  const createNorth = (settings: NorthSFTPSettings) => {
    north = new NorthSftp(buildNorthEntity<NorthSFTPSettings>('sftp', settings), createCacheServiceMock());
  };

  before(() => {
    mockModule(nodeRequire, 'ssh2-sftp-client', sftpExports);
    Object.assign(utilsSftpExports, reloadModule(nodeRequire, '../../service/utils-sftp'));
    mockModule(nodeRequire, '../../service/utils-sftp', utilsSftpExports);
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
    encryptionService = createMock<EncryptionService>({ decryptText: text => text });
    encryptionExports.encryptionService = encryptionService;
    readFileMock = mockReadFile();
    retrieveSshServerIdentity = mock.fn(async () => ({
      type: 'ssh-host-key',
      fingerprint: 'SHA256:abc',
      details: { keyType: 'ssh-ed25519' }
    }));
    utilsSftpExports.retrieveSshServerIdentity = retrieveSshServerIdentity;
    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  describe('with Password Auth', () => {
    beforeEach(() => {
      createNorth({
        host: '127.0.0.1',
        port: 2222,
        remoteFolder: 'remoteFolder',
        authentication: 'password',
        username: 'user',
        password: 'pass'
      });
    });

    it('should retrieve supported types', () => {
      assert.deepStrictEqual(north.supportedTypes(), ['file']);
    });

    it('should send the files under the name given by their transformer, without their sub-folder', async () => {
      const sendSpy = mock.method(north, 'sendToSftpServer', async () => undefined);

      await north.handleContent(mockStream, { ...metadata, contentFile: path.join('sub', metadata.contentFile) });

      assert.strictEqual(sendSpy.mock.calls.length, 1);
      assert.deepStrictEqual(sendSpy.mock.calls[0].arguments, [mockStream, 'remoteFolder/example-123.file']);
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

    describe('server identity trust', () => {
      const getHostVerifier = (): HostVerifier =>
        (sftpClient.connect.mock.calls[0].arguments[0] as { hostVerifier: HostVerifier }).hostVerifier;

      it('should verify the host key of the server when connecting', async () => {
        await north.sendToSftpServer(mockStream, 'remoteFolder/target');

        const hostKey = sshHostKey('ecdsa-sha2-nistp256');
        const verify = mock.method(north.serverIdentityVerifier, 'verify', () => true);
        assert.strictEqual(getHostVerifier()(hostKey), true);
        verify.mock.mockImplementation(() => false);
        assert.strictEqual(getHostVerifier()(hostKey), false);
        assert.deepStrictEqual(
          verify.mock.calls.map(call => call.arguments[0]),
          [
            { type: 'ssh-host-key', fingerprint: sshFingerprint(hostKey), details: { keyType: 'ecdsa-sha2-nistp256' } },
            { type: 'ssh-host-key', fingerprint: sshFingerprint(hostKey), details: { keyType: 'ecdsa-sha2-nistp256' } }
          ]
        );
      });

      it('should retrieve the host key of the server without its credentials', async () => {
        assert.deepStrictEqual(await north.retrieveServerIdentity(), {
          type: 'ssh-host-key',
          fingerprint: 'SHA256:abc',
          details: { keyType: 'ssh-ed25519' }
        });
        assert.deepStrictEqual(retrieveSshServerIdentity.mock.calls[0].arguments, ['127.0.0.1', 2222, 'user']);
      });

      it('should keep the content to send again when the server is not trusted', async () => {
        const hostKey = sshHostKey('ssh-ed25519');
        sftpClient.connect.mock.mockImplementationOnce(async options => {
          // ssh2 refuses the connection, before the authentication, when the host verifier returns false (not trusted here)
          (options as { hostVerifier: HostVerifier }).hostVerifier(hostKey);
          throw new Error('Host denied (verification failed)');
        });

        await assert.rejects(
          north.sendToSftpServer(mockStream, 'remoteFolder/target'),
          new OIBusError('The server is not trusted: Host denied (verification failed)', true)
        );
        assert.strictEqual(north.isServerNotTrusted(), true);
        assert.deepStrictEqual(north.getPendingServerIdentity(), {
          identity: { type: 'ssh-host-key', fingerprint: sshFingerprint(hostKey), details: { keyType: 'ssh-ed25519' } },
          status: 'unknown'
        });
        assert.strictEqual(sftpClient.put.mock.calls.length, 0);
      });

      it('should rethrow a connection error when the server is trusted', async () => {
        const error = new Error('connection refused');
        sftpClient.connect.mock.mockImplementationOnce(async () => {
          throw error;
        });

        await assert.rejects(north.sendToSftpServer(mockStream, 'remoteFolder/target'), (thrown: unknown) => {
          assert.strictEqual(thrown, error);
          return true;
        });
        assert.strictEqual(sftpClient.put.mock.calls.length, 0);
      });
    });
  });

  describe('with Private Key Auth', () => {
    beforeEach(() => {
      createNorth({
        host: '127.0.0.1',
        port: 2222,
        remoteFolder: 'remoteFolder',
        authentication: 'private-key',
        username: 'user',
        privateKey: 'path/to/private.key',
        passphrase: 'myPassphrase'
      });
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
      // The host key is verified with a private key authentication too
      assert.strictEqual((connectConfig.hostVerifier as HostVerifier)(sshHostKey('ssh-ed25519')), false);
      assert.strictEqual(north.isServerNotTrusted(), true);
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
