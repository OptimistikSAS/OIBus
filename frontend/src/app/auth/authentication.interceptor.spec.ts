import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { createMock, MockObject } from '../../test/vitest-create-mock';
import { WindowService } from '../shared/window.service';
import { authenticationInterceptor } from './authentication.interceptor';

describe('authenticationInterceptor', () => {
  let http: HttpTestingController;
  let httpClient: HttpClient;
  let windowService: MockObject<WindowService>;

  beforeEach(() => {
    windowService = createMock(WindowService);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authenticationInterceptor])),
        provideHttpClientTesting(),
        { provide: WindowService, useValue: windowService }
      ]
    });

    http = TestBed.inject(HttpTestingController);
    httpClient = TestBed.inject(HttpClient);
  });

  afterEach(() => http.verify());

  test('should send the request as is if no token', async () => {
    windowService.getStorageItem.mockReturnValue(null);
    const result = firstValueFrom(httpClient.get('/api/foo'));

    const testRequest = http.expectOne('/api/foo');
    expect(testRequest.request.headers.has('Authorization')).toBe(false);
    testRequest.flush({ foo: 'bar' });

    await expect(result).resolves.toEqual({ foo: 'bar' });
  });

  test('should send the token if present', async () => {
    windowService.getStorageItem.mockReturnValue('fake.token');
    const result = firstValueFrom(httpClient.get('/api/foo'));

    const testRequest = http.expectOne('/api/foo');
    expect(windowService.getStorageItem).toHaveBeenCalledWith('oibus-token');
    expect(testRequest.request.headers.get('Authorization')).toBe('Bearer fake.token');
    testRequest.flush({ foo: 'bar' });

    await expect(result).resolves.toEqual({ foo: 'bar' });
  });
});
