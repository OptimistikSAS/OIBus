import { Component, inject, OnDestroy, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { NgbActiveModal, NgbProgressbarModule } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';
import { WindowService } from '../window.service';

const REDIRECT_DELAY_SECONDS = 30;

@Component({
  selector: 'oib-port-redirect-modal',
  imports: [TranslateDirective, NgbProgressbarModule],
  templateUrl: './port-redirect-modal.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './port-redirect-modal.component.scss'
})
export class PortRedirectModalComponent implements OnInit, OnDestroy {
  readonly activeModal = inject(NgbActiveModal);
  private windowService = inject(WindowService);

  readonly newPort = signal(0);
  readonly secondsRemaining = signal(REDIRECT_DELAY_SECONDS);
  readonly progress = signal(1); // Progress bar goes from 1 (full) to 0 (empty)

  private countdownInterval: ReturnType<typeof setInterval> | null = null;
  private startTime = 0;

  initialize(newPort: number) {
    this.newPort.set(newPort);
  }

  ngOnInit(): void {
    this.startTime = Date.now();
    this.startCountdown();
  }

  ngOnDestroy(): void {
    this.stopCountdown();
  }

  private startCountdown(): void {
    this.countdownInterval = setInterval(() => {
      const elapsedMs = Date.now() - this.startTime;
      const remaining = Math.max(0, REDIRECT_DELAY_SECONDS - elapsedMs / 1000);

      this.secondsRemaining.set(Math.ceil(remaining));
      this.progress.set(remaining / REDIRECT_DELAY_SECONDS);

      if (remaining <= 0) {
        this.redirect();
      }
    }, 1000);
  }

  private stopCountdown(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  redirect(): void {
    this.stopCountdown();
    const currentUrl = new URL(window.location.href);
    const newUrl = `${currentUrl.protocol}//${currentUrl.hostname}:${this.newPort()}${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
    this.windowService.redirectTo(newUrl);
  }
}
