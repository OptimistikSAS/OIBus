import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';
import { catchError, EMPTY, map, Observable, of, switchMap } from 'rxjs';

import { ServerTrustDTO } from '@oibus/shared/api/server-identity.model';
import { PresentedServerIdentity, ServerIdentity } from '@oibus/shared/domain/server-identity.model';

import { ModalService } from '../../modal.service';
import { ServerIdentityComponent } from '../server-identity/server-identity.component';
import { mustReviewServerIdentity } from '../server-trust';

/**
 * What the user is doing when asked to trust the identity of a server: reviewing it, or saving or starting a connector,
 * which can also go on without trusting it (the connector then waits until its server is trusted).
 */
export type ServerTrustModalMode = 'review' | 'save' | 'start';

/** Trust the identity, or go on without trusting it (saving or starting) */
export type ServerTrustDecision = 'trust' | 'skip';

/**
 * Asks the user to trust the identity a server presents, after comparing it with the server. Closed with the decision,
 * dismissed when cancelled.
 */
@Component({
  selector: 'oib-server-trust-modal',
  templateUrl: './server-trust-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateDirective, ServerIdentityComponent]
})
export class ServerTrustModalComponent {
  private readonly modal = inject(NgbActiveModal);

  readonly mode = signal<ServerTrustModalMode>('review');
  readonly presented = signal<PresentedServerIdentity | null>(null);
  readonly trusted = signal<ServerIdentity | null>(null);

  prepare(mode: ServerTrustModalMode, presented: PresentedServerIdentity, trusted: ServerIdentity | null) {
    this.mode.set(mode);
    this.presented.set(presented);
    this.trusted.set(trusted);
  }

  decide(decision: ServerTrustDecision) {
    this.modal.close(decision);
  }

  cancel() {
    this.modal.dismiss();
  }
}

/** Asks the user to trust the identity a server presents: emits the decision, or nothing when cancelled */
export function askServerTrust(
  modalService: ModalService,
  mode: ServerTrustModalMode,
  presented: PresentedServerIdentity,
  trusted: ServerIdentity | null
): Observable<ServerTrustDecision> {
  const modalRef = modalService.open(ServerTrustModalComponent, { size: 'lg' });
  const component: ServerTrustModalComponent = modalRef.componentInstance;
  component.prepare(mode, presented, trusted);
  return modalRef.result;
}

/**
 * Before saving or starting a connector: asks the user to trust the identity its server presents when it must be reviewed
 * (see `mustReviewServerIdentity`). Emits the identity to trust, or null to go on without trusting any (nothing to review,
 * the server cannot be reached, or the user goes on without trusting it); emits nothing when the user cancels.
 */
export function reviewServerIdentity(
  modalService: ModalService,
  mode: Exclude<ServerTrustModalMode, 'review'>,
  presented$: Observable<PresentedServerIdentity | null>,
  serverTrust: ServerTrustDTO | null,
  trusted: ServerIdentity | null
): Observable<ServerIdentity | null> {
  return presented$.pipe(
    // a server which cannot be reached does not prevent saving or starting the connector
    catchError(() => of(null)),
    switchMap(presented => {
      if (!presented || !mustReviewServerIdentity(presented, serverTrust)) {
        return of(null);
      }
      return askServerTrust(modalService, mode, presented, trusted).pipe(
        map(decision => (decision === 'trust' ? presented.identity : null)),
        catchError(() => EMPTY)
      );
    })
  );
}
