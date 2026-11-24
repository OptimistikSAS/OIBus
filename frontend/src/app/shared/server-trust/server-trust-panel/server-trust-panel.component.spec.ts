import { TestBed } from '@angular/core/testing';

import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { ServerTrustStateDTO, TrustedServerIdentityDTO } from '@oibus/shared/api/server-identity.model';
import { PresentedServerIdentity, ServerIdentity } from '@oibus/shared/domain/server-identity.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { provideCurrentUser } from '../../current-user-testing';
import { ServerTrustPanelComponent } from './server-trust-panel.component';

const identity: ServerIdentity = {
  type: 'ssh-host-key',
  fingerprint: 'SHA256:uNiVztksCsDhcc0u9e8BujQXVUpKZIDTMczCvj3tD2s',
  details: { keyType: 'ssh-ed25519' }
};
const trustedIdentity: TrustedServerIdentityDTO = {
  type: 'ssh-host-key',
  fingerprint: 'SHA256:trustedFingerprint',
  details: { keyType: 'ssh-rsa' },
  trustedBy: { id: 'admin', friendlyName: 'Admin' },
  trustedAt: '2026-01-01T00:00:00.000Z'
};

class ServerTrustPanelComponentTester {
  readonly fixture = TestBed.createComponent(ServerTrustPanelComponent);
  readonly component = this.fixture.componentInstance;
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly title = this.root.getByRole('heading', { level: 5 });
  readonly notTrusted = this.root.getByCss('#server-not-trusted');
  readonly notTrustedMessage = this.root.getByCss('#server-not-trusted span');
  readonly reviewButton = this.root.getByRole('button', { name: 'Review and trust' });
  readonly trustedBy = this.root.getByCss('#server-trusted-by');
  readonly fingerprint = this.root.getByCss('#server-identity-fingerprint');
  readonly noIdentity = this.root.getByCss('#no-server-identity');

  constructor(serverTrust: ServerTrustStateDTO, titleKey?: string) {
    this.fixture.componentRef.setInput('serverTrust', serverTrust);
    if (titleKey) {
      this.fixture.componentRef.setInput('titleKey', titleKey);
    }
  }
}

describe('ServerTrustPanelComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), provideCurrentUser()]
    });
  });

  test('should display the identity trusted', async () => {
    const tester = new ServerTrustPanelComponentTester({ identity: trustedIdentity, trustOnFirstUse: false, pending: null });

    await expect.element(tester.title).toHaveTextContent('Identity of the server');
    await expect.element(tester.trustedBy).toHaveTextContent('Trusted by Admin on 1 Jan 2026, 01:00');
    await expect.element(tester.fingerprint).toHaveTextContent(trustedIdentity.fingerprint);
    await expect.element(tester.notTrusted).not.toBeInTheDocument();
    await expect.element(tester.noIdentity).not.toBeInTheDocument();
  });

  test.each([
    {
      trustOnFirstUse: false,
      text: 'No identity trusted yet: test the connection to review the identity of the server and trust it.'
    },
    {
      trustOnFirstUse: true,
      text: 'No identity trusted yet: the connector trusts the identity its server presents at its first connection.'
    }
  ])('should tell that no identity is trusted (trustOnFirstUse: $trustOnFirstUse)', async ({ trustOnFirstUse, text }) => {
    const tester = new ServerTrustPanelComponentTester({ identity: null, trustOnFirstUse, pending: null });

    await expect.element(tester.noIdentity).toHaveTextContent(text);
    await expect.element(tester.trustedBy).not.toBeInTheDocument();
    await expect.element(tester.fingerprint).not.toBeInTheDocument();
    await expect.element(tester.notTrusted).not.toBeInTheDocument();
  });

  test('should display the unknown identity refused, to review', async () => {
    const pending: PresentedServerIdentity = { identity, status: 'unknown' };
    const tester = new ServerTrustPanelComponentTester({ identity: null, trustOnFirstUse: false, pending });
    const reviewed: Array<PresentedServerIdentity> = [];
    tester.component.review.subscribe(presented => reviewed.push(presented));

    await expect
      .element(tester.notTrustedMessage)
      .toHaveTextContent('The connector refused to connect: its server presents an identity which is not trusted.');
    await expect.element(tester.notTrusted).toHaveClass('alert-danger');
    await expect.element(tester.noIdentity).not.toBeInTheDocument();

    await tester.reviewButton.click();

    expect(reviewed).toEqual([pending]);
  });

  test('should display the changed identity refused, with the identity trusted', async () => {
    const pending: PresentedServerIdentity = { identity, status: 'changed' };
    const tester = new ServerTrustPanelComponentTester({ identity: trustedIdentity, trustOnFirstUse: false, pending });
    const reviewed: Array<PresentedServerIdentity> = [];
    tester.component.review.subscribe(presented => reviewed.push(presented));

    await expect
      .element(tester.notTrustedMessage)
      .toHaveTextContent('The connector refused to connect: its server presents another identity than the one trusted.');
    await expect.element(tester.trustedBy).toBeInTheDocument();
    await expect.element(tester.fingerprint).toHaveTextContent(trustedIdentity.fingerprint);

    await tester.reviewButton.click();

    expect(reviewed).toEqual([pending]);
  });

  test('should display a custom title', async () => {
    const tester = new ServerTrustPanelComponentTester(
      { identity: null, trustOnFirstUse: false, pending: null },
      'server-trust.panel.north-title'
    );

    await expect.element(tester.title).toHaveTextContent('Identity of the North server');
  });
});
