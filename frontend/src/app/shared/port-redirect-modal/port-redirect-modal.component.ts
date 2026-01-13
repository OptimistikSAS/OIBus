import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { NgbActiveModal, NgbProgressbarModule } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslateService } from '@ngx-translate/core';
import { WindowService } from '../window.service';

const REDIRECT_DELAY_SECONDS = 30;

@Component({
  selector: 'oib-port-redirect-modal',
  imports: [TranslateDirective, NgbProgressbarModule],
  templateUrl: './port-redirect-modal.component.html',
  styleUrl: './port-redirect-modal.component.scss'
})
export class PortRedirectModalComponent implements OnInit, OnDestroy {
  readonly activeModal = inject(NgbActiveModal);
  private windowService = inject(WindowService);
  private translateService = inject(TranslateService);

  readonly newPort = signal(0);
  readonly secondsRemaining = signal(REDIRECT_DELAY_SECONDS);
  readonly progress = signal(1); // Progress bar goes from 1 (full) to 0 (empty)

  private countdownInterval: ReturnType<typeof setInterval> | null = null;

  initialize(newPort: number) {
    this.newPort.set(newPort);
  }

  ngOnInit(): void {
    this.startCountdown();
  }

  ngOnDestroy(): void {
    this.stopCountdown();
  }

  private startCountdown(): void {
    this.countdownInterval = setInterval(() => {
      const remaining = this.secondsRemaining() - 1;
      this.secondsRemaining.set(remaining);
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

  get message(): string {
    return this.translateService.instant('engine.port-changed.message', {
      port: this.newPort(),
      seconds: this.secondsRemaining()
    });
  }
}
