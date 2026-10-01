import { catchError, distinctUntilChanged, EMPTY, exhaustMap, fromEvent, map, Observable, startWith, switchMap, timer } from 'rxjs';

/** How often the metrics displayed in the UI are refreshed */
export const METRICS_REFRESH_INTERVAL_MS = 5_000;

/**
 * Like rxjs `timer(initialDelay, period)`, but only while the page is visible: it stops ticking when the browser
 * tab is hidden (another tab selected, window minimized, screen locked...) and starts over, first tick after
 * `initialDelay`, when the page is visible again. Every background poll of the OIBus API should be driven by it,
 * so that a forgotten or sleeping tab costs nothing to OIBus.
 */
export function visibleTimer(period: number, initialDelay = 0): Observable<void> {
  return fromEvent(document, 'visibilitychange').pipe(
    startWith(null),
    map(() => document.visibilityState !== 'hidden'),
    distinctUntilChanged(),
    switchMap(visible => (visible ? timer(initialDelay, period).pipe(map(() => undefined)) : EMPTY))
  );
}

/**
 * Call `request` right away, then every `period` ms while the page is visible (see {@link visibleTimer}), and emit
 * each response. Requests never overlap, and a failed request is skipped: the next tick tries again.
 */
export function pollMetrics<T>(request: () => Observable<T>, period = METRICS_REFRESH_INTERVAL_MS): Observable<T> {
  return visibleTimer(period).pipe(exhaustMap(() => request().pipe(catchError(() => EMPTY))));
}
