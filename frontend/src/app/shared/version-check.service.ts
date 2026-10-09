import { inject, Service } from '@angular/core';

import { catchError, EMPTY, filter, Subject, Subscription, switchMap } from 'rxjs';

import { EngineService } from '../services/engine.service';
import { visibleTimer } from './polling';

/**
 * Service that monitors the OIBus version and detects when it changes.
 * This is useful for detecting remote updates and notifying the user.
 */
@Service()
export class VersionCheckService {
  private readonly engineService = inject(EngineService);
  private initialVersion: string | null = null;
  private monitoringSubscription: Subscription | null = null;
  private readonly versionChangeSubject = new Subject<{ oldVersion: string; newVersion: string }>();

  /**
   * Observable that emits when a version change is detected
   */
  readonly versionChange$ = this.versionChangeSubject.asObservable();

  /**
   * Start monitoring for version changes.
   * Polls the backend every 10 seconds to check for version updates, while the page is visible only.
   */
  startMonitoring(): void {
    if (this.monitoringSubscription) {
      return; // Already monitoring
    }

    // Get initial version first
    this.engineService.getInfo().subscribe(info => {
      this.initialVersion = info.version;
    });

    // Poll every 10 seconds, first check after 10 seconds too (the initial version has just been fetched)
    this.monitoringSubscription = visibleTimer(10000, 10000)
      .pipe(
        switchMap(() =>
          this.engineService.fetchInfo().pipe(
            catchError(() => {
              // Return EMPTY so the stream stays alive but emits nothing for this tick
              return EMPTY;
            })
          )
        ),
        filter(info => this.initialVersion !== null && info.version !== this.initialVersion)
      )
      .subscribe(info => {
        if (this.initialVersion) {
          this.versionChangeSubject.next({
            oldVersion: this.initialVersion,
            newVersion: info.version
          });
          // Stop monitoring after detecting a change
          this.stopMonitoring();
        }
      });
  }

  /**
   * Stop monitoring for version changes
   */
  stopMonitoring(): void {
    if (this.monitoringSubscription) {
      this.monitoringSubscription.unsubscribe();
      this.monitoringSubscription = null;
    }
  }

  /**
   * Reset the service state (useful for testing)
   */
  reset(): void {
    this.stopMonitoring();
    this.initialVersion = null;
  }
}
