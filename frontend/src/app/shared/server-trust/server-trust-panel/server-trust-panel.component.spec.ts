import { TestBed } from '@angular/core/testing';

import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { ServerTrustStateDTO } from '@oibus/shared/api/server-identity.model';
import { PresentedServerIdentity } from '@oibus/shared/domain/server-identity.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import testData from '../../../../test/test-data';
import { provideCurrentUser } from '../../current-user-testing';
import { ServerTrustPanelComponent } from './server-trust-panel.component';

const { trustedIdentities, presented, states } = testData.serverTrust;

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

  test('should display the messages of another client than a connector', async () => {
    const tester = new ServerTrustPanelComponentTester(states.unknownRefused, 'oia-module.registration.server-trust.title');
    tester.fixture.componentRef.setInput('refusedKey', 'oia-module.registration.server-trust.refused');

    await expect.element(tester.title).toHaveTextContent('Identity of OIAnalytics');
    await expect
      .element(tester.notTrustedMessage)
      .toHaveTextContent(
        'OIBus refused to connect to OIAnalytics: its certificate does not validate, and no certificate is trusted for it.'
      );
  });

  test('should display the identity trusted', async () => {
    const tester = new ServerTrustPanelComponentTester(states.trusted);

    await expect.element(tester.title).toHaveTextContent('Identity of the server');
    await expect.element(tester.trustedBy).toHaveTextContent('Trusted by Admin on 1 Jan 2026, 01:00');
    await expect.element(tester.fingerprint).toHaveTextContent(trustedIdentities.sshHostKey.fingerprint);
    await expect.element(tester.notTrusted).not.toBeInTheDocument();
    await expect.element(tester.noIdentity).not.toBeInTheDocument();
  });

  test.each([
    { serverTrust: states.none, text: null },
    {
      serverTrust: states.trustOnFirstUse,
      text: 'No identity trusted yet: the connector trusts the identity its server presents at its first connection.'
    }
  ])('should tell that no identity is trusted yet (trustOnFirstUse: $serverTrust.trustOnFirstUse)', async ({ serverTrust, text }) => {
    const tester = new ServerTrustPanelComponentTester(serverTrust);

    if (text) {
      await expect.element(tester.noIdentity).toHaveTextContent(text);
    } else {
      // the page shows no panel then (see toDisplayedServerTrust)
      await expect.element(tester.noIdentity).not.toBeInTheDocument();
    }
    await expect.element(tester.trustedBy).not.toBeInTheDocument();
    await expect.element(tester.fingerprint).not.toBeInTheDocument();
    await expect.element(tester.notTrusted).not.toBeInTheDocument();
  });

  test('should display the unknown identity refused, to review', async () => {
    const tester = new ServerTrustPanelComponentTester(states.unknownRefused);
    const reviewed: Array<PresentedServerIdentity> = [];
    tester.component.review.subscribe(presented => reviewed.push(presented));

    await expect
      .element(tester.notTrustedMessage)
      .toHaveTextContent('The connector refused to connect: its server presents an identity which is not trusted.');
    await expect.element(tester.notTrusted).toHaveClass('alert-danger');
    await expect.element(tester.noIdentity).not.toBeInTheDocument();

    await tester.reviewButton.click();

    expect(reviewed).toEqual([presented.unknown]);
  });

  test('should display the changed identity refused, with the identity trusted', async () => {
    const tester = new ServerTrustPanelComponentTester(states.changedRefused);
    const reviewed: Array<PresentedServerIdentity> = [];
    tester.component.review.subscribe(presented => reviewed.push(presented));

    await expect
      .element(tester.notTrustedMessage)
      .toHaveTextContent('The connector refused to connect: its server presents another identity than the one trusted.');
    await expect.element(tester.trustedBy).toBeInTheDocument();
    await expect.element(tester.fingerprint).toHaveTextContent(trustedIdentities.otherSshHostKey.fingerprint);

    await tester.reviewButton.click();

    expect(reviewed).toEqual([presented.changed]);
  });

  test('should display a custom title', async () => {
    const tester = new ServerTrustPanelComponentTester(states.none, 'server-trust.panel.north-title');

    await expect.element(tester.title).toHaveTextContent('Identity of the North server');
  });
});
