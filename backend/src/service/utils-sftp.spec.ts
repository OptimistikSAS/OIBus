import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { before, beforeEach, describe, it, type Mock, mock } from 'node:test';

import type SftpClient from 'ssh2-sftp-client';
import type { ConnectOptions } from 'ssh2-sftp-client';

import type { ServerIdentity } from '../../shared/model/domain/server-identity.model';

import { createMock, type Mocked, mockModule, reloadModule } from '../tests/utils/test-utils';
import type * as UtilsSftp from './utils-sftp';

const nodeRequire = createRequire(import.meta.url);

/** A host key in the SSH wire format: the length of the key type, the key type, then the key */
const sshHostKey = (keyType: string): Buffer => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(keyType.length);
  return Buffer.concat([length, Buffer.from(keyType, 'ascii'), Buffer.from('key-data')]);
};

/** The fingerprint `ssh-keygen -l` shows for this host key */
const sshFingerprint = (hostKey: Buffer): string =>
  `SHA256:${crypto.createHash('sha256').update(hostKey).digest('base64').replace(/=+$/, '')}`;

describe('Service utils SFTP', () => {
  let utilsSftp: typeof UtilsSftp;
  let sftpClient: Mocked<SftpClient>;
  let sftpClientConstructor: Mock<() => SftpClient>;

  // `default` is declared up front so the interop wrapper of the SUT exposes it (its value is set per test)
  const sftpExports: Record<string, unknown> = { __esModule: true, default: undefined };

  before(() => {
    mockModule(nodeRequire, 'ssh2-sftp-client', sftpExports);
    utilsSftp = reloadModule<typeof UtilsSftp>(nodeRequire, './utils-sftp');
  });

  beforeEach(() => {
    sftpClient = createMock<SftpClient>({ end: async () => true });
    sftpClientConstructor = mock.fn(function () {
      return sftpClient;
    });
    sftpExports.default = sftpClientConstructor;
  });

  describe('createHostVerifier', () => {
    it('should check the identity of the host key presented', () => {
      const hostKey = sshHostKey('ssh-ed25519');
      const isServerTrusted = mock.fn((_identity: ServerIdentity) => true);
      const hostVerifier = utilsSftp.createHostVerifier(isServerTrusted);

      assert.strictEqual(hostVerifier(hostKey), true);
      assert.deepStrictEqual(isServerTrusted.mock.calls[0].arguments, [
        { type: 'ssh-host-key', fingerprint: sshFingerprint(hostKey), details: { keyType: 'ssh-ed25519' } }
      ]);
    });

    it('should refuse the host key of a server not trusted', () => {
      const hostVerifier = utilsSftp.createHostVerifier(() => false);

      assert.strictEqual(hostVerifier(sshHostKey('ssh-rsa')), false);
    });
  });

  describe('retrieveSshServerIdentity', () => {
    /** Makes the connection present this host key: the host verifier refuses it, so ssh2 fails the connection */
    const presentHostKey = (hostKey: Buffer) =>
      sftpClient.connect.mock.mockImplementation(async (options: ConnectOptions) => {
        (options.hostVerifier as (key: Buffer) => boolean)(hostKey);
        throw new Error('Host denied (verification failed)');
      });

    it('should retrieve the host key presented, refusing it to send no credential', async () => {
      const hostKey = sshHostKey('ecdsa-sha2-nistp256');
      presentHostKey(hostKey);

      const identity = await utilsSftp.retrieveSshServerIdentity('localhost', 2222, 'user');

      assert.deepStrictEqual(identity, {
        type: 'ssh-host-key',
        fingerprint: sshFingerprint(hostKey),
        details: { keyType: 'ecdsa-sha2-nistp256' }
      });
      assert.strictEqual(sftpClientConstructor.mock.calls.length, 1);
      const options = sftpClient.connect.mock.calls[0].arguments[0];
      // Only what the key exchange needs: neither password nor private key
      assert.deepStrictEqual(Object.keys(options).sort(), ['host', 'hostVerifier', 'port', 'username']);
      assert.strictEqual(options.host, 'localhost');
      assert.strictEqual(options.port, 2222);
      assert.strictEqual(options.username, 'user');
      assert.strictEqual((options.hostVerifier as (key: Buffer) => boolean)(hostKey), false);
      assert.strictEqual(sftpClient.end.mock.calls.length, 1);
    });

    it('should ignore the error of closing the connection already closed', async () => {
      presentHostKey(sshHostKey('ssh-ed25519'));
      sftpClient.end.mock.mockImplementation(async () => {
        throw new Error('No SFTP connection');
      });

      const identity = await utilsSftp.retrieveSshServerIdentity('localhost', 22, 'user');

      assert.strictEqual(identity.type, 'ssh-host-key');
      assert.strictEqual(sftpClient.end.mock.calls.length, 1);
    });

    it('should throw the connection error when the server presented no host key', async () => {
      const error = new Error('connect ECONNREFUSED');
      sftpClient.connect.mock.mockImplementation(async () => {
        throw error;
      });

      await assert.rejects(utilsSftp.retrieveSshServerIdentity('localhost', 22, 'user'), (thrown: unknown) => {
        assert.strictEqual(thrown, error);
        return true;
      });
      assert.strictEqual(sftpClient.end.mock.calls.length, 1);
    });

    it('should throw when the connection succeeds without any host key', async () => {
      await assert.rejects(
        utilsSftp.retrieveSshServerIdentity('localhost', 22, 'user'),
        new Error('The SSH server localhost:22 presented no host key')
      );
      assert.strictEqual(sftpClient.end.mock.calls.length, 1);
    });
  });
});
