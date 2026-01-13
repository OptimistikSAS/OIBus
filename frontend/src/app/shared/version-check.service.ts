import { Injectable, inject } from '@angular/core';
import { interval, Subject, Subscription, switchMap, filter, catchError, EMPTY } from 'rxjs';
import { EngineService } from '../services/engine.service';

/**
 * Service that monitors the OIBus version and detects when it changes.
 * This is useful for detecting remote updates and notifying the user.
 */
@Injectable({
  providedIn: 'root'
})
export class VersionCheckService {
  private engineService = inject(EngineService);
  private initialVersion: string | null = null;
  private monitoringSubscription: Subscription | null = null;
  private versionChangeSubject = new Subject<{ oldVersion: string; newVersion: string }>();

  /**
   * Observable that emits when a version change is detected
   */
  readonly versionChange$ = this.versionChangeSubject.asObservable();

  /**
   * Start monitoring for version changes.
   * Polls the backend every 10 seconds to check for version updates.
   */
  startMonitoring(): void {
    if (this.monitoringSubscription) {
      return; // Already monitoring
    }

    // Get initial version first
    this.engineService.getInfo().subscribe(info => {
      this.initialVersion = info.version;
    });

    // Poll every 10 seconds
    this.monitoringSubscription = interval(10000)
      .pipe(
        switchMap(() =>
          this.engineService.getInfo().pipe(
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
