import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { NgbActiveModal, NgbProgressbarModule } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslateModule } from '@ngx-translate/core';
import { WindowService } from '../window.service';

const COUNTDOWN_SECONDS = 60;
const UPDATE_INTERVAL_MS = 100; // Update every 100ms for smooth progress bar

@Component({
  selector: 'oib-version-update-modal',
  imports: [NgbProgressbarModule, TranslateDirective, TranslateModule],
  templateUrl: './version-update-modal.component.html',
  styleUrl: './version-update-modal.component.scss'
})
export class VersionUpdateModalComponent implements OnInit, OnDestroy {
  readonly activeModal = inject(NgbActiveModal);
  private windowService = inject(WindowService);

  readonly remainingSeconds = signal(COUNTDOWN_SECONDS);
  readonly progress = signal(1); // Progress from 1 (full) to 0 (empty)
  oldVersion = '';
  newVersion = '';

  private intervalId: number | null = null;
  private startTime = 0;

  ngOnInit(): void {
    this.startTime = Date.now();
    this.startCountdown();
  }

  ngOnDestroy(): void {
    this.clearInterval();
  }

  private startCountdown(): void {
    this.intervalId = window.setInterval(() => {
      const elapsedMs = Date.now() - this.startTime;
      const elapsedSeconds = elapsedMs / 1000;
      const remaining = Math.max(0, COUNTDOWN_SECONDS - elapsedSeconds);

      this.remainingSeconds.set(Math.ceil(remaining));
      this.progress.set(remaining / COUNTDOWN_SECONDS);

      if (remaining <= 0) {
        this.reload();
      }
    }, UPDATE_INTERVAL_MS);
  }

  private clearInterval(): void {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  reload(): void {
    this.clearInterval();
    this.activeModal.close();
    this.windowService.reload();
  }
}
