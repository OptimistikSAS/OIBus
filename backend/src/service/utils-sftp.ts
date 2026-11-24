import sftpClient from 'ssh2-sftp-client';

import { ServerIdentity } from '../../shared/model/domain/server-identity.model';

import { toSshHostKeyServerIdentity } from './utils-server-identity';

/**
 * The `hostVerifier` of an SSH connection: whether the connection goes on with the server presenting this host key. ssh2
 * calls it during the key exchange, before the authentication, so a server refused never receives any credential.
 */
export const createHostVerifier =
  (isServerTrusted: (identity: ServerIdentity) => boolean) =>
  (hostKey: Buffer): boolean =>
    isServerTrusted(toSshHostKeyServerIdentity(hostKey));

/**
 * The identity (the host key) the SSH server presents, obtained by refusing it during the key exchange: the connection
 * stops before the authentication, so no credential is sent.
 */
export const retrieveSshServerIdentity = async (host: string, port: number, username: string): Promise<ServerIdentity> => {
  let identity: ServerIdentity | null = null;
  const client = new sftpClient();
  try {
    await client.connect({
      host,
      port,
      username,
      hostVerifier: (hostKey: Buffer) => {
        identity = toSshHostKeyServerIdentity(hostKey);
        return false;
      }
    });
  } catch (error: unknown) {
    if (!identity) {
      throw error;
    }
  } finally {
    await client.end().catch(() => {
      /* the connection is already closed by the refused host key */
    });
  }
  if (!identity) {
    throw new Error(`The SSH server ${host}:${port} presented no host key`);
  }
  return identity;
};
