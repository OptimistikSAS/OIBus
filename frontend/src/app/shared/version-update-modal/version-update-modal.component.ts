import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { NgbActiveModal, NgbProgressbarModule } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';
import { interval } from 'rxjs';

import { WindowService } from '../window.service';

const COUNTDOWN_SECONDS = 60;
const UPDATE_INTERVAL_MS = 100; // Update every 100ms for smooth progress bar

@Component({
  selector: 'oib-version-update-modal',
  imports: [NgbProgressbarModule, TranslateDirective],
  templateUrl: './version-update-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './version-update-modal.component.scss'
})
export class VersionUpdateModalComponent {
  readonly activeModal = inject(NgbActiveModal);
  private readonly windowService = inject(WindowService);

  readonly remainingSeconds = signal(COUNTDOWN_SECONDS);
  readonly progress = signal(1); // Progress from 1 (full) to 0 (empty)
  readonly oldVersion = signal('');
  readonly newVersion = signal('');

  private readonly startTime = Date.now();
  private readonly countdown = interval(UPDATE_INTERVAL_MS)
    .pipe(takeUntilDestroyed())
    .subscribe(() => {
      const elapsedMs = Date.now() - this.startTime;
      const remaining = Math.max(0, COUNTDOWN_SECONDS - elapsedMs / 1000);

      this.remainingSeconds.set(Math.ceil(remaining));
      this.progress.set(remaining / COUNTDOWN_SECONDS);

      if (remaining <= 0) {
        this.reload();
      }
    });

  initialize(oldVersion: string, newVersion: string) {
    this.oldVersion.set(oldVersion);
    this.newVersion.set(newVersion);
  }

  reload(): void {
    this.countdown.unsubscribe();
    this.activeModal.close();
    this.windowService.reload();
  }
}
