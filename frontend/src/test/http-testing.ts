import { HttpTestingController, RequestMatch } from '@angular/common/http/testing';

import { firstValueFrom, Observable } from 'rxjs';
import { expect } from 'vitest';

/**
 * Subscribes to an HTTP call made by a service, checks the request and flushes the given response.
 * Returns what the observable emitted (or `undefined` for calls that complete without emitting).
 *
 * ```
 * const result = await expectHttp(http, service.update('id1', command), { method: 'PUT', url: '/api/ip-filters/id1' }, { body: command });
 * ```
 */
export function expectHttp<T>(
  http: HttpTestingController,
  call: Observable<T>,
  match: RequestMatch,
  options: { body?: unknown; params?: Record<string, string | Array<string>>; response?: unknown } = {}
): Promise<T | undefined> {
  const result = firstValueFrom(call, { defaultValue: undefined });
  const request = http.expectOne(match);
  if ('body' in options) {
    expect(request.request.body).toEqual(options.body);
  }
  for (const [key, value] of Object.entries(options.params ?? {})) {
    expect(Array.isArray(value) ? request.request.params.getAll(key) : request.request.params.get(key)).toEqual(value);
  }
  request.flush(options.response ?? null);
  return result;
}
