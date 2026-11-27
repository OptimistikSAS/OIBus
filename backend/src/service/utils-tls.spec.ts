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
  options: { ca?: boolean; dnsNames?: Array<string> } = {}
): KeyPair => {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const certificate = forge.pki.createCertificate();
  certificate.publicKey = keys.publicKey;
  certificate.serialNumber = '01' + forge.util.bytesToHex(forge.random.getBytesSync(8));
  certificate.validity.notBefore = new Date(Date.now() - 60_000);
  certificate.validity.notAfter = new Date(Date.now() + 24 * 3600_000);
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

      assert.strictEqual(await trust.refuseIfNotTrusted(Object.assign(new Error('x'), { code: 'ECONNRESET' })), false);
      assert.strictEqual(refuse.mock.calls.length, 1);
    });

    it('should refuse a server trusted when connecting, but not when probing, as changed', async () => {
      // the probe validates the certificate, the connection failed on it: the server changed meanwhile
      const { trust, refuse } = create(`https://localhost:${selfSignedServer.port}`, 'selfSigned');

      await trust.refuseIfNotTrusted(Object.assign(new Error('x'), { code: 'CERT_HAS_EXPIRED' }));

      assert.strictEqual(refuse.mock.calls[0].arguments[1], 'changed');
    });
  });
});
