import { catchError, distinctUntilChanged, EMPTY, exhaustMap, fromEvent, map, Observable, startWith, switchMap, timer } from 'rxjs';

/** How often the metrics displayed in the UI are refreshed */
export const METRICS_REFRESH_INTERVAL_MS = 5_000;

/**
 * Call `request` right away, then every `period` ms, and emit each response.
 * Polling is suspended while the browser tab is hidden and resumes with an immediate refresh when it is
 * visible again, so a forgotten or sleeping tab costs nothing to OIBus. Requests never overlap, and a
 * failed request is skipped: the next tick tries again.
 */
export function pollMetrics<T>(request: () => Observable<T>, period = METRICS_REFRESH_INTERVAL_MS): Observable<T> {
  return fromEvent(document, 'visibilitychange').pipe(
    startWith(null),
    map(() => document.visibilityState !== 'hidden'),
    distinctUntilChanged(),
    switchMap(visible => (visible ? timer(0, period) : EMPTY)),
    exhaustMap(() => request().pipe(catchError(() => EMPTY)))
  );
}
