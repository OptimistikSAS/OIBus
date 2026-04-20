import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { authenticationInterceptor } from './authentication.interceptor';
import { WindowService } from '../shared/window.service';
import { createMock, MockObject } from '../../test/vitest-create-mock';

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

  test('should send the request as is if no token', () => {
    httpClient.get('/api/foo').subscribe();
    const testRequest = http.expectOne('/api/foo');
    expect(testRequest.request.headers.get('Authorization')).toBeFalsy();
  });

  test('should send the token if present', () => {
    windowService.getStorageItem.mockReturnValue('fake.token');
    httpClient.get('/api/foo').subscribe();
    const testRequest = http.expectOne('/api/foo');
    expect(testRequest.request.headers.get('Authorization')).toBe('Bearer fake.token');
  });
});
