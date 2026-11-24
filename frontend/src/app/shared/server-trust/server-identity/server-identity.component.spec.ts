import { TestBed } from '@angular/core/testing';

import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { ServerIdentity, X509ServerIdentityDetails } from '@oibus/shared/domain/server-identity.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { provideCurrentUser } from '../../current-user-testing';
import { ServerIdentityComponent } from './server-identity.component';

const x509Details: X509ServerIdentityDetails = {
  subject: 'CN=My OPC UA Server\nO=Optimistik',
  issuer: 'CN=My OPC UA Server\nO=Optimistik',
  serialNumber: '5E2A0C',
  validFrom: '2020-01-01T00:00:00.000Z',
  validTo: '2099-01-01T00:00:00.000Z',
  uris: ['urn:my-server:UA:Server'],
  dnsNames: ['my-server.local'],
  ipAddresses: ['192.168.0.10'],
  selfSigned: true
};

function x509Identity(details: Partial<X509ServerIdentityDetails> = {}, fingerprint = 'AB:CD:EF:01'): ServerIdentity {
  return { type: 'x509', fingerprint, details: { ...x509Details, ...details } };
}

const sshIdentity: ServerIdentity = {
  type: 'ssh-host-key',
  fingerprint: 'SHA256:uNiVztksCsDhcc0u9e8BujQXVUpKZIDTMczCvj3tD2s',
  details: { keyType: 'ssh-ed25519' }
};

class ServerIdentityComponentTester {
  readonly fixture = TestBed.createComponent(ServerIdentityComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly rows = this.root.getByRole('row');
  readonly type = this.root.getByCss('#server-identity-type');
  readonly fingerprint = this.root.getByCss('#server-identity-fingerprint');
  readonly previousFingerprint = this.root.getByCss('#server-identity-previous-fingerprint');
  readonly subject = this.root.getByCss('#server-identity-subject');
  readonly issuer = this.root.getByCss('#server-identity-issuer');
  readonly issuerName = this.root.getByCss('#server-identity-issuer .multiline');
  readonly issuerBadge = this.root.getByCss('#server-identity-issuer .badge');
  readonly validity = this.root.getByCss('#server-identity-validity');
  readonly outOfValidityBadge = this.root.getByCss('#server-identity-validity .badge');
  readonly uris = this.root.getByCss('#server-identity-uris');
  readonly uriList = this.root.getByCss('#server-identity-uris div');
  readonly names = this.root.getByCss('#server-identity-names');
  readonly nameList = this.root.getByCss('#server-identity-names div');
  readonly serialNumber = this.root.getByCss('#server-identity-serial-number');
  readonly keyType = this.root.getByCss('#server-identity-key-type');

  constructor(identity: ServerIdentity, previous?: ServerIdentity | null) {
    this.fixture.componentRef.setInput('identity', identity);
    if (previous !== undefined) {
      this.fixture.componentRef.setInput('previous', previous);
    }
  }
}

describe('ServerIdentityComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), provideCurrentUser()]
    });
  });

  test('should display the details of a self-signed certificate', async () => {
    const tester = new ServerIdentityComponentTester(x509Identity());

    await expect.element(tester.type).toHaveTextContent('Certificate');
    await expect.element(tester.fingerprint).toHaveTextContent('AB:CD:EF:01');
    await expect.element(tester.previousFingerprint).not.toBeInTheDocument();
    await expect.element(tester.subject).toHaveTextContent('CN=My OPC UA Server O=Optimistik');
    await expect.element(tester.issuerName).toHaveTextContent('CN=My OPC UA Server O=Optimistik');
    await expect.element(tester.issuerBadge).toHaveTextContent('Self-signed');
    await expect.element(tester.issuerBadge).toHaveClass('text-bg-warning');
    await expect.element(tester.validity).toHaveTextContent('From 1 Jan 2020, 01:00 to 1 Jan 2099, 01:00');
    await expect.element(tester.outOfValidityBadge).not.toBeInTheDocument();
    await expect.element(tester.rows.filter({ hasText: 'Validity' })).not.toHaveClass('table-danger');
    await expect.element(tester.uriList).toHaveLength(1);
    await expect.element(tester.uriList.nth(0)).toHaveTextContent('urn:my-server:UA:Server');
    await expect.element(tester.nameList).toHaveLength(2);
    await expect.element(tester.nameList.nth(0)).toHaveTextContent('my-server.local');
    await expect.element(tester.nameList.nth(1)).toHaveTextContent('192.168.0.10');
    await expect.element(tester.serialNumber).toHaveTextContent('5E2A0C');
    await expect.element(tester.keyType).not.toBeInTheDocument();
    await expect.element(tester.rows).toHaveLength(8);
  });

  test('should display a certificate issued by a certificate authority', async () => {
    const tester = new ServerIdentityComponentTester(x509Identity({ issuer: 'CN=My CA', selfSigned: false }));

    await expect.element(tester.issuerName).toHaveTextContent('CN=My CA');
    await expect.element(tester.issuerBadge).toHaveTextContent('Issued by a certificate authority');
    await expect.element(tester.issuerBadge).toHaveClass('text-bg-info');
    await expect.element(tester.issuerBadge).not.toHaveClass('text-bg-warning');
  });

  test.each([
    { name: 'expired', validFrom: '2020-01-01T00:00:00.000Z', validTo: '2021-01-01T00:00:00.000Z' },
    { name: 'not valid yet', validFrom: '2098-01-01T00:00:00.000Z', validTo: '2099-01-01T00:00:00.000Z' }
  ])('should warn about a certificate $name', async ({ validFrom, validTo }) => {
    const tester = new ServerIdentityComponentTester(x509Identity({ validFrom, validTo }));

    await expect.element(tester.outOfValidityBadge).toHaveTextContent('Not valid now');
    await expect.element(tester.rows.filter({ hasText: 'Validity' })).toHaveClass('table-danger');
  });

  test('should display the names of a certificate without URI, and its IP addresses only', async () => {
    const tester = new ServerIdentityComponentTester(x509Identity({ uris: [], dnsNames: [], ipAddresses: ['10.0.0.1', '10.0.0.2'] }));

    await expect.element(tester.nameList).toHaveLength(2);
    await expect.element(tester.nameList.nth(0)).toHaveTextContent('10.0.0.1');
    await expect.element(tester.nameList.nth(1)).toHaveTextContent('10.0.0.2');
    await expect.element(tester.uris).not.toBeInTheDocument();
  });

  test('should not display the names of a certificate without any', async () => {
    const tester = new ServerIdentityComponentTester(x509Identity({ uris: [], dnsNames: [], ipAddresses: [] }));

    await expect.element(tester.serialNumber).toBeInTheDocument();
    await expect.element(tester.uris).not.toBeInTheDocument();
    await expect.element(tester.names).not.toBeInTheDocument();
    await expect.element(tester.rows).toHaveLength(6);
  });

  test('should display an SSH host key', async () => {
    const tester = new ServerIdentityComponentTester(sshIdentity);

    await expect.element(tester.type).toHaveTextContent('SSH host key');
    await expect.element(tester.fingerprint).toHaveTextContent(sshIdentity.fingerprint);
    await expect.element(tester.keyType).toHaveTextContent('ssh-ed25519');
    await expect.element(tester.subject).not.toBeInTheDocument();
    await expect.element(tester.issuer).not.toBeInTheDocument();
    await expect.element(tester.validity).not.toBeInTheDocument();
    await expect.element(tester.serialNumber).not.toBeInTheDocument();
    await expect.element(tester.rows).toHaveLength(3);
  });

  test('should display the fingerprint trusted before when it changed', async () => {
    const tester = new ServerIdentityComponentTester(x509Identity(), x509Identity({}, '01:23:45:67'));

    await expect.element(tester.previousFingerprint).toHaveTextContent('01:23:45:67');
    await expect.element(tester.rows.filter({ hasText: 'Fingerprint trusted until now' })).toHaveClass('table-warning');
  });

  test.each([
    { name: 'the same identity', previous: x509Identity() },
    { name: 'no identity', previous: null }
  ])('should not display the fingerprint trusted before when it is $name', async ({ previous }) => {
    const tester = new ServerIdentityComponentTester(x509Identity(), previous);

    await expect.element(tester.fingerprint).toBeInTheDocument();
    await expect.element(tester.previousFingerprint).not.toBeInTheDocument();
  });
});
