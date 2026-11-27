import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import net from 'node:net';
import tls from 'node:tls';
import { after, before, describe, it, mock } from 'node:test';

import * as forge from 'node-forge';

import { ServerIdentity, X509ServerIdentityDetails } from '../../shared/model/domain/server-identity.model';

import {
  getTrustedCertificate,
  isCertificateError,
  probeTlsServer,
  REFUSE_EVERY_CERTIFICATE,
  resolveTlsTrust,
  TlsServerTrust,
  toTlsServerIdentity,
  toTlsTrust,
  toTlsTrustStatus,
  toTrustSettingsJsonPath
} from './utils-tls';

interface KeyPair {
  certificate: string;
  privateKey: string;
}

/** A certificate signed by the issuer (self-signed without), for the host names given */
const createCertificate = (
  commonName: string,
  issuer: KeyPair | null,
  options: { ca?: boolean; dnsNames?: Array<string>; validTo?: Date } = {}
): KeyPair => {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const certificate = forge.pki.createCertificate();
  certificate.publicKey = keys.publicKey;
  certificate.serialNumber = '01' + forge.util.bytesToHex(forge.random.getBytesSync(8));
  certificate.validity.notAfter = options.validTo ?? new Date(Date.now() + 24 * 3600_000);
  certificate.validity.notBefore = new Date(certificate.validity.notAfter.getTime() - 2 * 24 * 3600_000);
  const subject = [{ shortName: 'CN', value: commonName }];
  certificate.setSubject(subject);
  certificate.setIssuer(issuer ? forge.pki.certificateFromPem(issuer.certificate).subject.attributes : subject);
  certificate.setExtensions([
    { name: 'basicConstraints', cA: options.ca ?? false },
    ...(options.dnsNames ? [{ name: 'subjectAltName', altNames: options.dnsNames.map(value => ({ type: 2, value })) }] : [])
  ]);
  certificate.sign(issuer ? forge.pki.privateKeyFromPem(issuer.privateKey) : keys.privateKey, forge.md.sha256.create());
  return { certificate: forge.pki.certificateToPem(certificate), privateKey: forge.pki.privateKeyToPem(keys.privateKey) };
};

const fingerprintOf = (pem: string) => new crypto.X509Certificate(pem).fingerprint256;

/** A TLS server presenting this certificate, answering nothing */
const startServer = async (keyPair: KeyPair): Promise<{ server: tls.Server; port: number }> => {
  const server = tls.createServer({ cert: keyPair.certificate, key: keyPair.privateKey }, socket => socket.end());
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  return { server, port: (server.address() as net.AddressInfo).port };
};

/** Connects with these TLS options, validating the certificate: the error code when refused */
const connect = (port: number, trust: object): Promise<string> =>
  new Promise(resolve => {
    const socket = tls.connect({ host: '127.0.0.1', port, servername: 'localhost', ...trust }, () => {
      socket.end();
      resolve('connected');
    });
    socket.on('error', (error: NodeJS.ErrnoException) => resolve(isCertificateError(error) ? 'certificate refused' : error.code!));
  });

describe('Service utils TLS', () => {
  let ca: KeyPair;
  let issued: KeyPair;
  let selfSigned: KeyPair;
  let other: KeyPair;
  let issuedServer: { server: tls.Server; port: number };
  let selfSignedServer: { server: tls.Server; port: number };

  before(async () => {
    ca = createCertificate('OIBus test CA', null, { ca: true });
    issued = createCertificate('localhost', ca, { dnsNames: ['localhost'] });
    selfSigned = createCertificate('self-signed', null, { dnsNames: ['another-host'] });
    other = createCertificate('self-signed', null);
    issuedServer = await startServer(issued);
    selfSignedServer = await startServer(selfSigned);
  });

  after(() => {
    issuedServer.server.close();
    selfSignedServer.server.close();
  });

  it('should use the standard validation without trusted certificate', () => {
    assert.deepStrictEqual(toTlsTrust(null), {});
  });

  it('should validate the certificates a trusted certification authority issued, with their host name', async () => {
    const trust = toTlsTrust(ca.certificate);

    assert.deepStrictEqual(trust, { ca: [ca.certificate] });
    assert.strictEqual(await connect(issuedServer.port, trust), 'connected');
    assert.strictEqual(await connect(selfSignedServer.port, trust), 'certificate refused');
  });

  it('should only accept a trusted server certificate itself, whatever its host name', async () => {
    assert.strictEqual(await connect(selfSignedServer.port, toTlsTrust(selfSigned.certificate)), 'connected');
    // trusted as is, although issued by a certification authority the connector does not trust
    assert.strictEqual(await connect(issuedServer.port, toTlsTrust(issued.certificate)), 'connected');
    // another certificate with the same name
    assert.strictEqual(await connect(selfSignedServer.port, toTlsTrust(other.certificate)), 'certificate refused');
    assert.strictEqual(await connect(issuedServer.port, toTlsTrust(other.certificate)), 'certificate refused');
  });

  it('should refuse every certificate when the trusted certificate is not selected yet', async () => {
    assert.strictEqual(resolveTlsTrust(undefined), REFUSE_EVERY_CERTIFICATE);
    assert.deepStrictEqual(resolveTlsTrust(null), {});
    assert.strictEqual(await connect(selfSignedServer.port, REFUSE_EVERY_CERTIFICATE), 'certificate refused');
  });

  it('should read the certificate a server presents without validating it, telling whether it validates', async () => {
    const unknown = await probeTlsServer(`https://localhost:${selfSignedServer.port}`, 443, {}, null, 5000);
    const trusted = await probeTlsServer(`https://localhost:${selfSignedServer.port}`, 443, toTlsTrust(selfSigned.certificate), null, 5000);

    assert.strictEqual(unknown.authorized, false);
    assert.strictEqual(trusted.authorized, true);
    assert.strictEqual(unknown.identity.fingerprint, fingerprintOf(selfSigned.certificate));
    const details = unknown.identity.details as X509ServerIdentityDetails;
    assert.strictEqual(details.subject, 'CN=self-signed');
    assert.strictEqual(details.selfSigned, true);
    assert.strictEqual(fingerprintOf(details.certificate!), fingerprintOf(selfSigned.certificate));
  });

  it('should read the certificate of a PostgreSQL server, after its SSL request', async () => {
    let request: Buffer | null = null;
    // a PostgreSQL server accepting TLS ('S') or not ('N') once it receives the SSL request
    const startPostgreSQL = async (acceptsTls: boolean) => {
      const server = net.createServer(socket => {
        socket.once('data', (data: Buffer) => {
          request = data;
          socket.write(acceptsTls ? 'S' : 'N');
          if (acceptsTls) {
            const secure = new tls.TLSSocket(socket, {
              isServer: true,
              secureContext: tls.createSecureContext({ cert: selfSigned.certificate, key: selfSigned.privateKey })
            });
            secure.on('error', () => undefined);
          } else {
            socket.end();
          }
        });
      });
      await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
      return { server, port: (server.address() as net.AddressInfo).port };
    };
    const accepting = await startPostgreSQL(true);
    const refusing = await startPostgreSQL(false);
    try {
      const { identity, authorized } = await probeTlsServer(`postgresql://127.0.0.1:${accepting.port}`, 5432, {}, null, 5000, 'postgresql');

      assert.deepStrictEqual(request, Buffer.from([0, 0, 0, 8, 0x04, 0xd2, 0x16, 0x2f]));
      assert.strictEqual(identity.fingerprint, fingerprintOf(selfSigned.certificate));
      assert.strictEqual(authorized, false);
      await assert.rejects(probeTlsServer(`postgresql://127.0.0.1:${refusing.port}`, 5432, {}, null, 5000, 'postgresql'), {
        message: `The server 127.0.0.1:${refusing.port} does not accept TLS connections`
      });
    } finally {
      accepting.server.close();
      refusing.server.close();
    }
  });

  it('should give the whole probe of a PostgreSQL server the timeout, its SSL request included', async () => {
    // accepts TLS late, then never completes the handshake
    const connections = new Set<net.Socket>();
    const slow = net.createServer(socket => {
      connections.add(socket);
      socket.once('data', () => setTimeout(() => socket.write('S'), 150));
    });
    await new Promise<void>(resolve => slow.listen(0, '127.0.0.1', resolve));
    const port = (slow.address() as net.AddressInfo).port;
    try {
      const start = Date.now();
      await assert.rejects(probeTlsServer(`postgresql://127.0.0.1:${port}`, 5432, {}, null, 300, 'postgresql'), {
        message: `Connection timeout: no certificate received from 127.0.0.1:${port} after 300 ms`
      });
      assert.ok(Date.now() - start < 550);
    } finally {
      connections.forEach(socket => socket.destroy());
      slow.close();
    }
  });

  it('should time out when a PostgreSQL server does not answer the SSL request', async () => {
    const connections = new Set<net.Socket>();
    const silent = net.createServer(socket => connections.add(socket));
    await new Promise<void>(resolve => silent.listen(0, '127.0.0.1', resolve));
    const port = (silent.address() as net.AddressInfo).port;
    try {
      await assert.rejects(probeTlsServer(`postgresql://127.0.0.1:${port}`, 5432, {}, null, 100, 'postgresql'), {
        message: `Connection timeout: 127.0.0.1:${port} did not answer the SSL request after 100 ms`
      });
      await assert.rejects(probeTlsServer('postgresql://127.0.0.1:1', 5432, {}, null, 1000, 'postgresql'));
    } finally {
      connections.forEach(socket => socket.destroy());
      silent.close();
    }
  });

  it('should read the certificate a server presents through an HTTP proxy', async () => {
    let tunnelled: string | null = null;
    let authorization: string | undefined;
    const proxy = net.createServer(client => {
      client.once('data', data => {
        const request = data.toString();
        tunnelled = request.split(' ')[1];
        authorization = /proxy-authorization: (.*)\r\n/i.exec(request)?.[1];
        const [host, port] = tunnelled.split(':');
        const upstream = net.connect(Number(port), host === 'localhost' ? '127.0.0.1' : host, () => {
          client.write('HTTP/1.1 200 Connection established\r\n\r\n');
          upstream.pipe(client);
          client.pipe(upstream);
        });
        upstream.on('error', () => client.destroy());
      });
    });
    await new Promise<void>(resolve => proxy.listen(0, '127.0.0.1', resolve));
    try {
      const { identity } = await probeTlsServer(
        `https://localhost:${issuedServer.port}/api`,
        443,
        toTlsTrust(ca.certificate),
        { url: `http://127.0.0.1:${(proxy.address() as net.AddressInfo).port}`, username: 'user', password: 'pass' },
        5000
      );

      assert.strictEqual(identity.fingerprint, fingerprintOf(issued.certificate));
      assert.strictEqual(tunnelled, `localhost:${issuedServer.port}`);
      assert.strictEqual(authorization, `Basic ${Buffer.from('user:pass').toString('base64')}`);
    } finally {
      proxy.close();
    }
  });

  it('should fail to read the certificate of an unreachable server', async () => {
    const closed = net.createServer();
    await new Promise<void>(resolve => closed.listen(0, '127.0.0.1', resolve));
    const port = (closed.address() as net.AddressInfo).port;
    closed.close();

    await assert.rejects(probeTlsServer(`https://127.0.0.1:${port}`, 443, {}, null, 5000), { code: 'ECONNREFUSED' });
  });

  it('should take the certificate trusted in the form, else the one selected, else the standard validation', () => {
    const findCertificate = mock.fn((_id: string) => ({ certificate: ca.certificate }));
    const formIdentity = toTlsServerIdentity(new crypto.X509Certificate(selfSigned.certificate).raw);

    assert.strictEqual(
      getTrustedCertificate({ certificateValidation: 'trusted', trustedCertificateId: 'ca' }, formIdentity, findCertificate),
      (formIdentity.details as X509ServerIdentityDetails).certificate
    );
    assert.strictEqual(
      getTrustedCertificate({ certificateValidation: 'trusted', trustedCertificateId: 'ca' }, null, findCertificate),
      ca.certificate
    );
    assert.deepStrictEqual(findCertificate.mock.calls[0].arguments, ['ca']);
    assert.strictEqual(
      getTrustedCertificate({ certificateValidation: 'trusted', trustedCertificateId: null }, null, findCertificate),
      undefined
    );
    assert.strictEqual(
      getTrustedCertificate({ certificateValidation: 'standard', trustedCertificateId: 'ca' }, null, findCertificate),
      null
    );
    // an identity trusted in the form without its certificate (an OPC UA one)
    const withoutCertificate: ServerIdentity = { ...formIdentity, details: { ...formIdentity.details, certificate: undefined } };
    assert.strictEqual(getTrustedCertificate({ certificateValidation: 'standard' }, withoutCertificate, findCertificate), null);
  });

  it('should tell how the certificate a server presents compares with the trust of the connector', () => {
    assert.strictEqual(toTlsTrustStatus(true, null), 'trusted');
    assert.strictEqual(toTlsTrustStatus(false, ca.certificate), 'changed');
    assert.strictEqual(toTlsTrustStatus(false, null), 'unknown');
    assert.strictEqual(toTlsTrustStatus(false, undefined), 'unknown');
  });

  it('should tell the errors of a certificate which does not validate', () => {
    assert.ok(isCertificateError(Object.assign(new Error('self-signed'), { code: 'DEPTH_ZERO_SELF_SIGNED_CERT' })));
    // as undici wraps them
    assert.ok(
      isCertificateError(new Error('fetch failed', { cause: Object.assign(new Error('x'), { code: 'ERR_TLS_CERT_ALTNAME_INVALID' }) }))
    );
    assert.ok(!isCertificateError(Object.assign(new Error('refused'), { code: 'ECONNREFUSED' })));
    assert.ok(!isCertificateError('error'));
  });

  it('should give the JSON path of the settings telling how the certificate is validated', () => {
    assert.strictEqual(toTrustSettingsJsonPath(), '$');
    assert.strictEqual(toTrustSettingsJsonPath('specificSettings'), '$.specificSettings');
    assert.throws(() => toTrustSettingsJsonPath("a'"), { message: `Invalid settings key "a'"` });
  });

  describe('TlsServerTrust', () => {
    const create = (url: string | null, trustedCertificateId: string | null) => {
      const refuse = mock.fn();
      const certificates: Record<string, string> = { ca: ca.certificate, selfSigned: selfSigned.certificate };
      const trust = new TlsServerTrust(
        () => ({ certificateValidation: trustedCertificateId ? 'trusted' : 'standard', trustedCertificateId }),
        () => null,
        id => ({ certificate: certificates[id] }),
        () => (url ? { url, defaultPort: 443, proxy: null, timeoutMs: 5000 } : null),
        refuse
      );
      return { trust, refuse };
    };

    it('should not read any certificate without TLS', async () => {
      const { trust } = create(null, null);

      assert.strictEqual(await trust.retrieveServerIdentity(), null);
      assert.deepStrictEqual(trust.tls(), {});
    });

    it('should read the certificate of the server, and tell whether it validates against the trusted one', async () => {
      const trusting = create(`https://localhost:${selfSignedServer.port}`, 'selfSigned');
      const presented = (await trusting.trust.retrieveServerIdentity())!;
      assert.strictEqual(trusting.trust.status(presented), 'trusted');

      const otherCertificate = create(`https://localhost:${selfSignedServer.port}`, 'ca');
      assert.strictEqual(otherCertificate.trust.status((await otherCertificate.trust.retrieveServerIdentity())!), 'changed');
      // an identity it did not read
      assert.strictEqual(otherCertificate.trust.status({ ...presented, fingerprint: 'other' }), 'unknown');
    });

    it('should keep the certificate of a server which does not validate as pending', async () => {
      const { trust, refuse } = create(`https://localhost:${selfSignedServer.port}`, null);

      assert.strictEqual(await trust.refuseIfNotTrusted(Object.assign(new Error('x'), { code: 'DEPTH_ZERO_SELF_SIGNED_CERT' })), true);
      assert.strictEqual(refuse.mock.calls[0].arguments[0].fingerprint, fingerprintOf(selfSigned.certificate));
      assert.strictEqual(refuse.mock.calls[0].arguments[1], 'unknown');
      // the standard validation: no certificate awaited, to trust at the first connection
      assert.strictEqual(refuse.mock.calls[0].arguments[2], false);

      assert.strictEqual(await trust.refuseIfNotTrusted(Object.assign(new Error('x'), { code: 'ECONNRESET' })), false);
      assert.strictEqual(refuse.mock.calls.length, 1);
    });

    it('should validate the certificate trusted at the first connection, until the settings select it', async () => {
      const trust = new TlsServerTrust(
        () => ({ certificateValidation: 'trusted', trustedCertificateId: null }),
        () => null,
        () => ({ certificate: '' }),
        () => ({ url: `https://localhost:${selfSignedServer.port}`, defaultPort: 443, proxy: null, timeoutMs: 5000 }),
        (_presented, _status, awaitingCertificate) => awaitingCertificate
      );
      // no certificate selected yet: every certificate is refused
      assert.strictEqual(trust.tls(), REFUSE_EVERY_CERTIFICATE);

      assert.strictEqual(await trust.refuseIfNotTrusted(Object.assign(new Error('x'), { code: 'CERT_UNTRUSTED' })), true);

      assert.strictEqual(await connect(selfSignedServer.port, trust.tls()), 'connected');
      assert.strictEqual(trust.status((await trust.retrieveServerIdentity())!), 'trusted');
    });

    it('should refuse a server trusted when connecting, but not when probing, as changed', async () => {
      // the probe validates the certificate against the trusted authority, the connection failed on it: the server changed
      const { trust, refuse } = create(`https://localhost:${issuedServer.port}`, 'ca');

      await trust.refuseIfNotTrusted(Object.assign(new Error('x'), { code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' }));

      assert.strictEqual(refuse.mock.calls[0].arguments[1], 'changed');
    });

    it('should not refuse the trusted certificate itself: trusting it again would not make it validate', async () => {
      const { trust, refuse } = create(`https://localhost:${selfSignedServer.port}`, 'selfSigned');

      // e.g. the certificate expired, or is not meant for a server
      assert.strictEqual(await trust.refuseIfNotTrusted(Object.assign(new Error('x'), { code: 'INVALID_PURPOSE' })), true);

      assert.strictEqual(refuse.mock.calls.length, 0);
      assert.strictEqual(trust.status((await trust.retrieveServerIdentity())!), 'trusted');
    });

    it('should not refuse a certificate out of its validity period: trusting it would not make it validate', async () => {
      const expired = createCertificate('expired', null, { validTo: new Date(Date.now() - 86_400_000) });
      const expiredServer = await startServer(expired);
      try {
        const refuse = mock.fn(() => true);
        const trust = new TlsServerTrust(
          () => ({ certificateValidation: 'trusted', trustedCertificateId: null }),
          () => null,
          () => ({ certificate: '' }),
          () => ({ url: `https://localhost:${expiredServer.port}`, defaultPort: 443, proxy: null, timeoutMs: 5000 }),
          refuse
        );

        assert.strictEqual(await trust.refuseIfNotTrusted(Object.assign(new Error('x'), { code: 'CERT_HAS_EXPIRED' })), true);

        // neither kept for review nor trusted at the first connection
        assert.strictEqual(refuse.mock.calls.length, 0);
        assert.strictEqual(trust.tls(), REFUSE_EVERY_CERTIFICATE);
      } finally {
        expiredServer.server.close();
      }
    });
  });
});
