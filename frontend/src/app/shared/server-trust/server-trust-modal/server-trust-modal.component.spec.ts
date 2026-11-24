import { TestBed } from '@angular/core/testing';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { firstValueFrom, NEVER, Observable, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { ServerTrustDTO } from '@oibus/shared/api/server-identity.model';
import { PresentedServerIdentity, ServerIdentity } from '@oibus/shared/domain/server-identity.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { provideCurrentUser } from '../../current-user-testing';
import { MockModalService, provideModalTesting } from '../../mock-modal.service.testing';
import { ModalService } from '../../modal.service';
import {
  askServerTrust,
  reviewServerIdentity,
  SERVER_IDENTITY_RETRIEVAL_TIMEOUT_MS,
  ServerTrustDecision,
  ServerTrustModalComponent,
  ServerTrustModalMode} from './server-trust-modal.component';

const identity: ServerIdentity = {
  type: 'ssh-host-key',
  fingerprint: 'SHA256:uNiVztksCsDhcc0u9e8BujQXVUpKZIDTMczCvj3tD2s',
  details: { keyType: 'ssh-ed25519' }
};
const previousIdentity: ServerIdentity = {
  type: 'ssh-host-key',
  fingerprint: 'SHA256:previousFingerprint',
  details: { keyType: 'ssh-ed25519' }
};
const unknown: PresentedServerIdentity = { identity, status: 'unknown' };
const changed: PresentedServerIdentity = { identity, status: 'changed' };
const noTrust: ServerTrustDTO = { identity: null, trustOnFirstUse: false };

class ServerTrustModalComponentTester {
  readonly fixture = TestBed.createComponent(ServerTrustModalComponent);
  readonly component = this.fixture.componentInstance;
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly title = this.root.getByRole('heading', { level: 4 });
  readonly status = this.root.getByCss('#server-trust-status');
  readonly compare = this.root.getByText(/^Compare the fingerprint below/);
  readonly fingerprint = this.root.getByCss('#server-identity-fingerprint');
  readonly previousFingerprint = this.root.getByCss('#server-identity-previous-fingerprint');
  readonly hint = this.root.getByCss('.modal-body p.text-body-secondary');
  readonly trustButton = this.root.getByCss('#trust-button');
  readonly skipButton = this.root.getByCss('#skip-button');
  readonly cancelButton = this.root.getByRole('button', { name: 'Cancel' });
}

describe('ServerTrustModalComponent', () => {
  let tester: ServerTrustModalComponentTester;
  let fakeActiveModal: MockObject<NgbActiveModal>;

  beforeEach(() => {
    fakeActiveModal = createMock(NgbActiveModal);

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), provideCurrentUser(), { provide: NgbActiveModal, useValue: fakeActiveModal }]
    });

    tester = new ServerTrustModalComponentTester();
  });

  test('should ask to review an unknown identity', async () => {
    tester.component.prepare('review', unknown, null);

    await expect.element(tester.title).toHaveTextContent('Identity of the server');
    await expect.element(tester.status).toMatchTextContent(/^The connector does not trust any identity for this server yet/);
    await expect.element(tester.status).toHaveClass('alert-warning');
    await expect.element(tester.compare).toBeInTheDocument();
    await expect.element(tester.fingerprint).toHaveTextContent(identity.fingerprint);
    await expect.element(tester.previousFingerprint).not.toBeInTheDocument();
    await expect.element(tester.trustButton).toHaveTextContent('Trust this identity');
    await expect.element(tester.skipButton).not.toBeInTheDocument();
    await expect.element(tester.hint).not.toBeInTheDocument();
  });

  test('should show the identity trusted before a changed one', async () => {
    tester.component.prepare('review', changed, previousIdentity);

    await expect.element(tester.status).toMatchTextContent(/^The server presents another identity than the one trusted/);
    await expect.element(tester.status).toHaveClass('alert-danger');
    await expect.element(tester.fingerprint).toHaveTextContent(identity.fingerprint);
    await expect.element(tester.previousFingerprint).toHaveTextContent(previousIdentity.fingerprint);
  });

  test.each<{ mode: ServerTrustModalMode; trust: string; skip: string; hint: string }>([
    {
      mode: 'save',
      trust: 'Trust and save',
      skip: 'Save without trusting',
      hint: 'The connector can be saved without trusting this identity: it then waits until its server is trusted.'
    },
    {
      mode: 'start',
      trust: 'Trust and start',
      skip: 'Start without trusting',
      hint: 'The connector can be started without trusting this identity: it then waits until its server is trusted.'
    }
  ])('should let go on without trusting the identity when it is asked to $mode', async ({ mode, trust, skip, hint }) => {
    tester.component.prepare(mode, unknown, null);

    await expect.element(tester.trustButton).toHaveTextContent(trust);
    await expect.element(tester.skipButton).toHaveTextContent(skip);
    await expect.element(tester.hint).toHaveTextContent(hint);
  });

  test('should close with the decision to trust', async () => {
    tester.component.prepare('save', unknown, null);

    await tester.trustButton.click();

    expect(fakeActiveModal.close).toHaveBeenCalledWith('trust');
  });

  test('should close with the decision to go on without trusting', async () => {
    tester.component.prepare('start', unknown, null);

    await tester.skipButton.click();

    expect(fakeActiveModal.close).toHaveBeenCalledWith('skip');
  });

  test('should be dismissed when cancelled', async () => {
    tester.component.prepare('review', unknown, null);

    await tester.cancelButton.click();

    expect(fakeActiveModal.dismiss).toHaveBeenCalled();
    expect(fakeActiveModal.close).not.toHaveBeenCalled();
  });
});

describe('askServerTrust and reviewServerIdentity', () => {
  let modalService: MockModalService<ServerTrustModalComponent>;
  let modalComponent: MockObject<ServerTrustModalComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideModalTesting()] });
    modalService = TestBed.inject(MockModalService);
    modalComponent = createMock(ServerTrustModalComponent);
  });

  function openedModal() {
    return vi.spyOn(modalService, 'open');
  }

  describe('askServerTrust', () => {
    test.each<ServerTrustDecision>(['trust', 'skip'])('should open the modal and emit the decision %s', async decision => {
      modalService.mockClosedModal(modalComponent, decision);
      const open = openedModal();

      const result = await firstValueFrom(askServerTrust(TestBed.inject(ModalService), 'save', changed, previousIdentity));

      expect(result).toBe(decision);
      expect(open).toHaveBeenCalledWith(ServerTrustModalComponent, { size: 'lg' });
      expect(modalComponent.prepare).toHaveBeenCalledWith('save', changed, previousIdentity);
    });

    test('should emit nothing when cancelled', async () => {
      modalService.mockDismissedModal(modalComponent);

      const result = await firstValueFrom(askServerTrust(TestBed.inject(ModalService), 'review', unknown, null), {
        defaultValue: 'nothing'
      });

      expect(result).toBe('nothing');
    });
  });

  describe('reviewServerIdentity', () => {
    function review(presented$: Observable<PresentedServerIdentity | null>, serverTrust: ServerTrustDTO | null = noTrust) {
      return firstValueFrom(reviewServerIdentity(TestBed.inject(ModalService), 'save', presented$, serverTrust, previousIdentity), {
        defaultValue: 'nothing'
      });
    }

    test.each<{ name: string; presented: PresentedServerIdentity | null; serverTrust: ServerTrustDTO | null }>([
      { name: 'the connector does not check the identity of its server', presented: null, serverTrust: noTrust },
      { name: 'the identity is trusted', presented: { identity, status: 'trusted' }, serverTrust: noTrust },
      {
        name: 'the identity is trusted at the first connection',
        presented: unknown,
        serverTrust: { identity: null, trustOnFirstUse: true }
      }
    ])('should emit null without asking when $name', async ({ presented, serverTrust }) => {
      const open = openedModal();

      await expect(review(of(presented), serverTrust)).resolves.toBeNull();

      expect(open).not.toHaveBeenCalled();
    });

    test('should emit null without asking when the server does not answer in time', async () => {
      vi.useFakeTimers();
      try {
        const open = openedModal();
        const result = review(NEVER);

        await vi.advanceTimersByTimeAsync(SERVER_IDENTITY_RETRIEVAL_TIMEOUT_MS);

        await expect(result).resolves.toBeNull();
        expect(open).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    test('should emit null without asking when the server cannot be reached', async () => {
      const open = openedModal();

      await expect(review(throwError(() => new Error('unreachable')))).resolves.toBeNull();

      expect(open).not.toHaveBeenCalled();
    });

    test.each([
      { presented: unknown, serverTrust: noTrust },
      { presented: changed, serverTrust: noTrust },
      { presented: unknown, serverTrust: null }
    ])('should ask to trust the $presented.status identity and emit it when trusted', async ({ presented, serverTrust }) => {
      modalService.mockClosedModal(modalComponent, 'trust');
      const open = openedModal();

      await expect(review(of(presented), serverTrust)).resolves.toEqual(identity);

      expect(open).toHaveBeenCalledWith(ServerTrustModalComponent, { size: 'lg' });
      expect(modalComponent.prepare).toHaveBeenCalledWith('save', presented, previousIdentity);
    });

    test('should emit null when the user goes on without trusting the identity', async () => {
      modalService.mockClosedModal(modalComponent, 'skip');

      await expect(review(of(changed))).resolves.toBeNull();
    });

    test('should emit nothing when the user cancels', async () => {
      modalService.mockDismissedModal(modalComponent);

      await expect(review(of(changed))).resolves.toBe('nothing');
    });

    test('should emit nothing when the modal is dismissed with an error', async () => {
      modalService.mockDismissedWithErrorModal(modalComponent);

      await expect(review(of(unknown))).resolves.toBe('nothing');
    });
  });
});
