import crypto from 'node:crypto';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';

import {
  ServerCertificateValidation,
  ServerIdentity,
  ServerIdentityTrustStatus,
  X509ServerIdentityDetails
} from '../../shared/model/domain/server-identity.model';

import { toX509ServerIdentity } from './utils-server-identity';

/** The settings of a TLS connector telling how it validates the certificate of its server */
export interface TlsTrustSettings {
  certificateValidation: ServerCertificateValidation;
  trustedCertificateId?: string | null;
}

/**
 * The options of `tls.connect` validating the certificate of a server: none for the standard validation, or the trusted
 * certificate. Passed as they are to the TLS clients (undici, mqtt.js, pg...), which give them to Node.js.
 */
export interface TlsTrust {
  ca?: Array<string>;
  allowPartialTrustChain?: boolean;
  checkServerIdentity?: (hostname: string, certificate: tls.PeerCertificate) => Error | undefined;
}

/** The code of the error of a server not presenting the trusted certificate */
export const CERTIFICATE_NOT_TRUSTED_ERROR_CODE = 'ERR_OIBUS_CERTIFICATE_NOT_TRUSTED';

/**
 * The TLS options validating the certificate of a server against a trusted certificate (PEM), or the standard validation
 * without one:
 * - a certification authority validates the certificates it issued, with the standard checks (host name included);
 * - another certificate is trusted as is: the server must present exactly this certificate, whatever its host name (it is
 *   given as the only authority, accepted although it is not a root, and its fingerprint is checked instead of the name).
 */
export const toTlsTrust = (trustedCertificate: string | null): TlsTrust => {
  if (!trustedCertificate) {
    return {};
  }
  const certificate = new crypto.X509Certificate(trustedCertificate);
  if (certificate.ca) {
    return { ca: [trustedCertificate] };
  }
  const fingerprint = certificate.fingerprint256;
  return {
    ca: [trustedCertificate],
    allowPartialTrustChain: true,
    checkServerIdentity: (_hostname, presented) => {
      if (presented.fingerprint256 === fingerprint) {
        return undefined;
      }
      return Object.assign(
        new Error(`The server presents the certificate ${presented.fingerprint256}, not the trusted one (${fingerprint})`),
        {
          code: CERTIFICATE_NOT_TRUSTED_ERROR_CODE
        }
      );
    }
  };
};

/**
 * The JSON path (in SQLite) of the settings of a connector telling how it validates the certificate of its server: the
 * settings themselves, or their object attribute named by the `serverTrustSettingsKey` of its manifest
 */
export const toTrustSettingsJsonPath = (settingsKey?: string): string => {
  if (!settingsKey) {
    return '$';
  }
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(settingsKey)) {
    throw new Error(`Invalid settings key "${settingsKey}"`);
  }
  return `$.${settingsKey}`;
};

/**
 * The TLS options refusing every certificate: a connector validating the certificate of its server against a trusted
 * certificate it has not selected yet refuses its server, instead of falling back on the standard validation.
 */
export const REFUSE_EVERY_CERTIFICATE: TlsTrust = Object.freeze({ ca: [] }) as TlsTrust;

/**
 * The certificate a TLS connector trusts (PEM), from the identity trusted in the form of the connector (not saved yet), or
 * else from its settings, `null` for the standard validation. `undefined` when the settings ask for a trusted certificate
 * without selecting one.
 */
export const getTrustedCertificate = (
  settings: TlsTrustSettings,
  formIdentity: ServerIdentity | null,
  findCertificate: (certificateId: string) => { certificate: string }
): string | null | undefined => {
  const formCertificate = formIdentity?.type === 'x509' ? (formIdentity.details as X509ServerIdentityDetails).certificate : undefined;
  if (formCertificate) {
    return formCertificate;
  }
  if (settings.certificateValidation !== 'trusted') {
    return null;
  }
  return settings.trustedCertificateId ? findCertificate(settings.trustedCertificateId).certificate : undefined;
};

/** The TLS options of a TLS connector, from the certificate it trusts (see `getTrustedCertificate`) */
export const resolveTlsTrust = (trustedCertificate: string | null | undefined): TlsTrust =>
  trustedCertificate === undefined ? REFUSE_EVERY_CERTIFICATE : toTlsTrust(trustedCertificate);

/**
 * How the certificate a server presents compares with the trust of the connector: trusted when it validates, otherwise
 * changed when the connector trusts a certificate, unknown when it trusts none (the standard validation failed)
 */
export const toTlsTrustStatus = (authorized: boolean, trustedCertificate: string | null | undefined): ServerIdentityTrustStatus => {
  if (authorized) {
    return 'trusted';
  }
  return trustedCertificate ? 'changed' : 'unknown';
};

/** The identity of a server presenting this certificate (DER), with the certificate itself, to be added to the store */
export const toTlsServerIdentity = (certificate: Buffer): ServerIdentity => {
  const identity = toX509ServerIdentity(certificate);
  return {
    ...identity,
    details: { ...(identity.details as X509ServerIdentityDetails), certificate: new crypto.X509Certificate(certificate).toString() }
  };
};

/** A proxy the connection to the server goes through, with its credentials */
export interface TlsProbeProxy {
  url: string;
  username?: string | null;
  password?: string | null;
}

/**
 * A protocol negotiating TLS on its connection before the TLS handshake:
 * - `postgresql`: the client sends an SSL request, which the server accepts with `S`
 */
export type TlsStartProtocol = 'postgresql';

/** The SSL request of the PostgreSQL protocol: its length, then its code */
const POSTGRESQL_SSL_REQUEST = Buffer.from([0, 0, 0, 8, 0x04, 0xd2, 0x16, 0x2f]);

/**
 * Connects to a TLS server without validating its certificate, only to read it and to tell whether it validates with these
 * options: nothing is sent to the server once the handshake is done, but what the protocol negotiating TLS needs before it
 * (`startTls`). Through the HTTP proxy the connector uses, when it uses one.
 */
export const probeTlsServer = async (
  url: string,
  defaultPort: number,
  trust: TlsTrust,
  proxy: TlsProbeProxy | null,
  timeoutMs: number,
  startTls: TlsStartProtocol | null = null
): Promise<{ identity: ServerIdentity; authorized: boolean }> => {
  const target = new URL(url);
  const host = target.hostname.replace(/^\[(.*)\]$/, '$1');
  const port = target.port ? Number(target.port) : defaultPort;
  // the whole probe (proxy tunnel, negotiation of TLS and handshake) is given the timeout
  const deadline = Date.now() + timeoutMs;
  const remaining = () => Math.max(deadline - Date.now(), 0);
  let socket = proxy ? await openProxyTunnel(proxy, host, port, remaining()) : null;
  if (startTls === 'postgresql') {
    socket = await requestPostgreSQLTls(socket ?? net.connect({ host, port }), host, port, remaining());
  }
  const handshakeTimeoutMs = remaining();
  return await new Promise((resolve, reject) => {
    const secureSocket = tls.connect({
      ...(socket ? { socket } : { host, port }),
      servername: net.isIP(host) ? undefined : host,
      ...trust,
      rejectUnauthorized: false
    });
    const timeout = setTimeout(() => {
      secureSocket.destroy();
      reject(new Error(`Connection timeout: no certificate received from ${host}:${port} after ${timeoutMs} ms`));
    }, handshakeTimeoutMs);
    secureSocket.once('secureConnect', () => {
      clearTimeout(timeout);
      const presented = secureSocket.getPeerCertificate(true);
      const authorized = secureSocket.authorized;
      secureSocket.end();
      if (!presented?.raw) {
        reject(new Error(`The server ${host}:${port} presented no certificate`));
        return;
      }
      resolve({ identity: toTlsServerIdentity(presented.raw), authorized });
    });
    secureSocket.once('error', error => {
      clearTimeout(timeout);
      reject(error);
    });
  });
};

/** Sends the SSL request of the PostgreSQL protocol on the connection: the TLS handshake follows when the server accepts it */
const requestPostgreSQLTls = (socket: net.Socket, host: string, port: number, timeoutMs: number): Promise<net.Socket> =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error(`Connection timeout: ${host}:${port} did not answer the SSL request after ${timeoutMs} ms`));
    }, timeoutMs);
    const send = () => socket.write(POSTGRESQL_SSL_REQUEST);
    socket.once('data', (answer: Buffer) => {
      clearTimeout(timeout);
      socket.removeListener('error', fail);
      if (answer[0] === 0x53) {
        resolve(socket);
      } else {
        socket.destroy();
        reject(new Error(`The server ${host}:${port} does not accept TLS connections`));
      }
    });
    const fail = (error: Error) => {
      clearTimeout(timeout);
      reject(error);
    };
    socket.once('error', fail);
    if (socket.connecting) {
      socket.once('connect', send);
    } else {
      send();
    }
  });

/** Opens a tunnel to the server through an HTTP(S) proxy (`CONNECT`), the TLS connection to the server going through it */
const openProxyTunnel = (proxy: TlsProbeProxy, host: string, port: number, timeoutMs: number): Promise<net.Socket> => {
  const proxyUrl = new URL(proxy.url);
  const username = proxy.username ?? decodeURIComponent(proxyUrl.username);
  const password = proxy.password ?? decodeURIComponent(proxyUrl.password);
  const authority = `${net.isIPv6(host) ? `[${host}]` : host}:${port}`;
  const request = (proxyUrl.protocol === 'https:' ? https : http).request({
    host: proxyUrl.hostname,
    port: proxyUrl.port || (proxyUrl.protocol === 'https:' ? 443 : 80),
    method: 'CONNECT',
    path: authority,
    timeout: timeoutMs,
    headers: {
      host: authority,
      ...(username ? { 'proxy-authorization': `Basic ${Buffer.from(`${username}:${password ?? ''}`).toString('base64')}` } : {})
    }
  });
  return new Promise((resolve, reject) => {
    request.once('connect', (response, socket) => {
      if (response.statusCode !== 200) {
        socket.destroy();
        reject(
          new Error(`The proxy ${proxyUrl.host} refused to connect to ${authority}: ${response.statusCode} ${response.statusMessage}`)
        );
        return;
      }
      resolve(socket);
    });
    request.once('timeout', () => request.destroy(new Error(`Connection timeout: the proxy ${proxyUrl.host} did not answer`)));
    request.once('error', reject);
    request.end();
  });
};

/** The codes of the errors of a certificate which does not validate (OpenSSL, Node.js, and the trusted certificate) */
const CERTIFICATE_ERROR_CODES = new Set([
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'CERT_HAS_EXPIRED',
  'CERT_NOT_YET_VALID',
  'CERT_UNTRUSTED',
  'CERT_REJECTED',
  'CERT_SIGNATURE_FAILURE',
  'CERT_CHAIN_TOO_LONG',
  'CERT_REVOKED',
  'INVALID_CA',
  'INVALID_PURPOSE',
  'PATH_LENGTH_EXCEEDED',
  'UNABLE_TO_DECRYPT_CERT_SIGNATURE',
  'UNABLE_TO_DECODE_ISSUER_PUBLIC_KEY',
  'ERROR_IN_CERT_NOT_BEFORE_FIELD',
  'ERROR_IN_CERT_NOT_AFTER_FIELD',
  'HOSTNAME_MISMATCH',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'ERR_TLS_CERT_SIGNATURE_ALGORITHM_UNSUPPORTED',
  CERTIFICATE_NOT_TRUSTED_ERROR_CODE
]);

/** Whether a certificate is out of its validity period now: trusting it again would not make it validate */
const isOutOfValidity = (identity: ServerIdentity): boolean => {
  if (identity.type !== 'x509') {
    return false;
  }
  const { validFrom, validTo } = identity.details as X509ServerIdentityDetails;
  const now = Date.now();
  return now < new Date(validFrom).getTime() || now > new Date(validTo).getTime();
};

/** Whether a connection failed because the certificate of the server does not validate (the error or one of its causes) */
export const isCertificateError = (error: unknown): boolean => {
  let current: unknown = error;
  for (let depth = 0; current && typeof current === 'object' && depth < 5; depth++) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === 'string' && CERTIFICATE_ERROR_CODES.has(code)) {
      return true;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return false;
};

/** Where a TLS connector connects to, to read the certificate of its server (see `probeTlsServer`) */
export interface TlsProbeTarget {
  url: string;
  defaultPort: number;
  proxy: TlsProbeProxy | null;
  timeoutMs: number;
  /** The protocol negotiating TLS on the connection before its handshake, when it is not TLS from the start */
  startTls?: TlsStartProtocol;
}

/**
 * The validation of the certificate of the server of a TLS connector, shared by the TLS connectors: the TLS options of
 * their connections, the identity their server presents (and whether it validates), and the refusal of a server whose
 * certificate does not validate, kept as pending until a user trusts it.
 */
export class TlsServerTrust {
  private lastProbe: { identity: ServerIdentity; status: ServerIdentityTrustStatus; isTrustedCertificate: boolean } | null = null;
  /** The certificate trusted at the first connection, until the settings selecting it are reloaded */
  private trustedOnFirstUse: ServerIdentity | null = null;

  constructor(
    private readonly getSettings: () => TlsTrustSettings,
    private readonly getFormIdentity: () => ServerIdentity | null,
    private readonly findCertificate: (certificateId: string) => { certificate: string },
    private readonly getProbeTarget: () => TlsProbeTarget | null,
    /**
     * Refuses the certificate presented, unless it trusts it at the first connection (then true): only possible while the
     * settings ask for a trusted certificate without selecting one (`awaitingCertificate`)
     */
    private readonly refuse: (
      presented: ServerIdentity,
      status: Exclude<ServerIdentityTrustStatus, 'trusted'>,
      awaitingCertificate: boolean
    ) => boolean | void
  ) {}

  /** The certificate trusted (see `getTrustedCertificate`), or the one trusted at the first connection */
  private trustedCertificate(): string | null | undefined {
    const trusted = getTrustedCertificate(this.getSettings(), this.getFormIdentity(), this.findCertificate);
    if (trusted === undefined && this.trustedOnFirstUse) {
      return (this.trustedOnFirstUse.details as X509ServerIdentityDetails).certificate ?? undefined;
    }
    return trusted;
  }

  /** The TLS options of the connections to the server */
  tls(): TlsTrust {
    return resolveTlsTrust(this.trustedCertificate());
  }

  /**
   * The identity the server presents, without validating it nor sending anything: `null` without TLS (an `http://`
   * server). Also tells whether it validates (see `status`).
   */
  async retrieveServerIdentity(): Promise<ServerIdentity | null> {
    const target = this.getProbeTarget();
    if (!target) {
      this.lastProbe = null;
      return null;
    }
    const trustedCertificate = this.trustedCertificate();
    const { identity, authorized } = await probeTlsServer(
      target.url,
      target.defaultPort,
      resolveTlsTrust(trustedCertificate),
      target.proxy,
      target.timeoutMs,
      target.startTls ?? null
    );
    // the trusted certificate itself, refused for its validity period: trusting it again would change nothing, the connection
    // reports why it is refused
    const isTrustedCertificate =
      !!trustedCertificate && new crypto.X509Certificate(trustedCertificate).fingerprint256 === identity.fingerprint;
    this.lastProbe = {
      identity,
      status: isTrustedCertificate ? 'trusted' : toTlsTrustStatus(authorized, trustedCertificate),
      isTrustedCertificate
    };
    return identity;
  }

  /** Whether the identity the server presented at the last `retrieveServerIdentity` validates */
  status(presented: ServerIdentity): ServerIdentityTrustStatus {
    return this.lastProbe?.identity.fingerprint === presented.fingerprint ? this.lastProbe.status : 'unknown';
  }

  /**
   * After a connection failing because the certificate of the server does not validate, reads the certificate the server
   * presents and keeps it as pending, for a user to review and trust it, unless it is trusted at the first connection (the
   * next connections then validate it). Other errors are left to the caller.
   */
  async refuseIfNotTrusted(error: unknown): Promise<boolean> {
    if (!isCertificateError(error)) {
      return false;
    }
    try {
      const presented = await this.retrieveServerIdentity();
      // trusting the trusted certificate itself, or a certificate out of its validity period, would not make it validate: the
      // error of the connection tells why it is refused (e.g. the certificate of the server expired, to renew)
      if (presented && !this.lastProbe?.isTrustedCertificate && !isOutOfValidity(presented)) {
        const status = this.status(presented);
        const awaitingCertificate = this.trustedCertificate() === undefined;
        // trusted when probing, but refused when connecting: the server changed meanwhile
        if (this.refuse(presented, status === 'trusted' ? 'changed' : status, awaitingCertificate) === true) {
          this.trustedOnFirstUse = presented;
        }
      }
    } catch {
      // the error of the connection is the one worth reporting
    }
    return true;
  }
}
