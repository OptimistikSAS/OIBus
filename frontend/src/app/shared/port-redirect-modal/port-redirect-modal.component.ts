import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { NgbActiveModal, NgbProgressbarModule } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';
import { interval } from 'rxjs';

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

  initialize(newPort: number) {
    this.newPort.set(newPort);
  }

  redirect(): void {
    this.countdown.unsubscribe();
    const currentUrl = new URL(window.location.href);
    const newUrl = `${currentUrl.protocol}//${currentUrl.hostname}:${this.newPort()}${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
    this.windowService.redirectTo(newUrl);
  }
}
