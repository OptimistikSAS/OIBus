import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { NgbActiveModal, NgbProgressbarModule } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';
import { interval } from 'rxjs';

import { WebServerProtocol } from '@oibus/shared/domain/engine.model';

import { WindowService } from '../window.service';

const REDIRECT_DELAY_SECONDS = 30;

@Component({
  selector: 'oib-port-redirect-modal',
  imports: [TranslateDirective, NgbProgressbarModule],
  templateUrl: './port-redirect-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './port-redirect-modal.component.scss'
})
export class PortRedirectModalComponent {
  readonly activeModal = inject(NgbActiveModal);
  private readonly windowService = inject(WindowService);

  readonly newPort = signal(0);
  readonly newProtocol = signal<WebServerProtocol>('http');
  /** The current page, reached with the new port and protocol of the web server */
  readonly newUrl = computed(() => {
    const currentUrl = new URL(window.location.href);
    return `${this.newProtocol()}://${currentUrl.hostname}:${this.newPort()}${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
  });
  readonly secondsRemaining = signal(REDIRECT_DELAY_SECONDS);
  readonly progress = signal(1); // Progress bar goes from 1 (full) to 0 (empty)

  private readonly startTime = Date.now();
  private readonly countdown = interval(1000)
    .pipe(takeUntilDestroyed())
    .subscribe(() => {
      const elapsedMs = Date.now() - this.startTime;
      const remaining = Math.max(0, REDIRECT_DELAY_SECONDS - elapsedMs / 1000);

      this.secondsRemaining.set(Math.ceil(remaining));
      this.progress.set(remaining / REDIRECT_DELAY_SECONDS);

      if (remaining <= 0) {
        this.redirect();
      }
    });

  initialize(newPort: number, newProtocol: WebServerProtocol) {
    this.newPort.set(newPort);
    this.newProtocol.set(newProtocol);
  }

  redirect(): void {
    this.countdown.unsubscribe();
    this.windowService.redirectTo(this.newUrl());
  }
}
