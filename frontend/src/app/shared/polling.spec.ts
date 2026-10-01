import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { Observable, of, Subject, Subscription, throwError } from 'rxjs';
import { METRICS_REFRESH_INTERVAL_MS, pollMetrics, visibleTimer } from './polling';

describe('polling', () => {
  let visibilityState: DocumentVisibilityState;
  let subscription: Subscription;

  const setVisibility = (state: DocumentVisibilityState) => {
    visibilityState = state;
    document.dispatchEvent(new Event('visibilitychange'));
  };

  beforeEach(() => {
    vi.useFakeTimers();
    visibilityState = 'visible';
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibilityState);
  });

  afterEach(() => {
    subscription?.unsubscribe();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test('should request right away, then at each interval', () => {
    const request = vi.fn(() => of('metrics'));
    const results: Array<string> = [];
    subscription = pollMetrics(request).subscribe(value => results.push(value));

    vi.advanceTimersByTime(0);
    expect(request).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(METRICS_REFRESH_INTERVAL_MS);
    expect(request).toHaveBeenCalledTimes(2);
    expect(results).toEqual(['metrics', 'metrics']);
  });

  test('should stop polling while the page is hidden and refresh as soon as it is visible again', () => {
    const request = vi.fn(() => of('metrics'));
    subscription = pollMetrics(request).subscribe();
    vi.advanceTimersByTime(0);
    expect(request).toHaveBeenCalledTimes(1);

    setVisibility('hidden');
    vi.advanceTimersByTime(METRICS_REFRESH_INTERVAL_MS * 5);
    expect(request).toHaveBeenCalledTimes(1);

    setVisibility('visible');
    vi.advanceTimersByTime(0);
    expect(request).toHaveBeenCalledTimes(2);
  });

  test('should keep polling after a failed request', () => {
    const request = vi.fn((): Observable<string> => throwError(() => new Error('down')));
    const error = vi.fn();
    subscription = pollMetrics(request).subscribe({ error });

    vi.advanceTimersByTime(METRICS_REFRESH_INTERVAL_MS);
    expect(request).toHaveBeenCalledTimes(2);
    expect(error).not.toHaveBeenCalled();
  });

  test('should not start a request while the previous one is still pending', () => {
    const pending = new Subject<string>();
    const request = vi.fn(() => pending);
    subscription = pollMetrics(request).subscribe();

    vi.advanceTimersByTime(METRICS_REFRESH_INTERVAL_MS * 3);
    expect(request).toHaveBeenCalledTimes(1);
  });

  test('should stop polling once unsubscribed', () => {
    const request = vi.fn(() => of('metrics'));
    const polling = pollMetrics(request).subscribe();
    vi.advanceTimersByTime(0);
    polling.unsubscribe();

    vi.advanceTimersByTime(METRICS_REFRESH_INTERVAL_MS * 3);
    expect(request).toHaveBeenCalledTimes(1);
  });

  test('visibleTimer should wait for the initial delay at start and each time the page becomes visible again', () => {
    const tick = vi.fn();
    subscription = visibleTimer(10_000, 3_000).subscribe(tick);

    vi.advanceTimersByTime(2_999);
    expect(tick).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(tick).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(10_000);
    expect(tick).toHaveBeenCalledTimes(2);

    setVisibility('hidden');
    vi.advanceTimersByTime(60_000);
    expect(tick).toHaveBeenCalledTimes(2);

    setVisibility('visible');
    vi.advanceTimersByTime(3_000);
    expect(tick).toHaveBeenCalledTimes(3);
  });

  test('visibleTimer should not tick when the page is hidden from the start', () => {
    visibilityState = 'hidden';
    const tick = vi.fn();
    subscription = visibleTimer(10_000).subscribe(tick);

    vi.advanceTimersByTime(60_000);
    expect(tick).not.toHaveBeenCalled();
  });
});
