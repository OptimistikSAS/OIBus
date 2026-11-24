/**
 * The kinds of identity a server presents to a connector:
 * - `x509`: the X.509 certificate of the server (OPC UA application certificate, TLS certificate)
 * - `ssh-host-key`: the host key of an SSH server (SFTP)
 */
export const SERVER_IDENTITY_TYPES = ['x509', 'ssh-host-key'] as const;

/**
 * The kind of identity a server presents.
 *
 * @example 'x509'
 */
export type ServerIdentityType = (typeof SERVER_IDENTITY_TYPES)[number];
