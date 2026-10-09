import { HttpErrorResponse, HttpStatusCode, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import testData from '../../test/test-data';
import { createMock, MockObject } from '../../test/vitest-create-mock';
import { CurrentUserService } from './current-user.service';
import { SHOULD_IGNORE_ERROR_PREDICATE } from './error-interceptor.service';
import { WindowService } from './window.service';

describe('CurrentUserService', () => {
  let http: HttpTestingController;
  let windowService: MockObject<WindowService>;
  const user = testData.users.list[0];

  beforeEach(() => {
    windowService = createMock(WindowService);
    windowService.timezoneToUse.mockReturnValue('Asia/Tokyo');
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: WindowService, useValue: windowService }]
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  test('should use the timezone of the window service', () => {
    const service = TestBed.inject(CurrentUserService);

    expect(service.getTimezone()).toBe('Asia/Tokyo');
  });

  test('should emit null without request when there is no stored token', async () => {
    windowService.getStorageItem.mockReturnValue(null);
    const service = TestBed.inject(CurrentUserService);

    await expect(firstValueFrom(service.get())).resolves.toBeNull();
    expect(windowService.getStorageItem).toHaveBeenCalledWith('oibus-token');
  });

  test('should fetch the current user once when there is a stored token', async () => {
    windowService.getStorageItem.mockReturnValue('token');
    const service = TestBed.inject(CurrentUserService);

    const first = firstValueFrom(service.get());
    http.expectOne({ method: 'GET', url: '/api/users/current-user' }).flush(user);
    await expect(first).resolves.toEqual(user);

    // the user is cached
    await expect(firstValueFrom(service.get())).resolves.toEqual(user);
  });

  test('should log out when fetching the current user is forbidden', async () => {
    windowService.getStorageItem.mockReturnValue('token');
    const service = TestBed.inject(CurrentUserService);

    const result = firstValueFrom(service.get());
    http.expectOne('/api/users/current-user').flush(null, { status: 403, statusText: 'Forbidden' });

    await expect(result).resolves.toBeNull();
    expect(windowService.removeStorageItem).toHaveBeenCalledWith('oibus-token');
    expect(windowService.redirectTo).toHaveBeenCalledWith('/login');
  });

  test('should not log out on other errors', async () => {
    windowService.getStorageItem.mockReturnValue('token');
    const service = TestBed.inject(CurrentUserService);

    const result = firstValueFrom(service.get());
    http.expectOne('/api/users/current-user').flush(null, { status: 500, statusText: 'Server Error' });

    await expect(result).resolves.toBeNull();
    expect(windowService.removeStorageItem).not.toHaveBeenCalled();
  });

  test('should log out', () => {
    const service = TestBed.inject(CurrentUserService);

    service.logout();

    expect(windowService.removeStorageItem).toHaveBeenCalledWith('oibus-token');
    expect(windowService.redirectTo).toHaveBeenCalledWith('/login');
  });

  test('should log in with password, store the token and fetch the current user again', async () => {
    windowService.getStorageItem.mockReturnValue(null);
    const service = TestBed.inject(CurrentUserService);
    await expect(firstValueFrom(service.get())).resolves.toBeNull();

    const result = firstValueFrom(service.loginWithPassword('admin', 'pass'));
    const authentication = http.expectOne({ method: 'POST', url: '/api/users/authentication' });
    expect(authentication.request.headers.get('authorization')).toBe(`Basic ${window.btoa('admin:pass')}`);
    expect(authentication.request.body).toBeNull();
    // the interceptor must let the login page handle bad credentials
    const ignoreError = authentication.request.context.get(SHOULD_IGNORE_ERROR_PREDICATE);
    expect(ignoreError(createErrorWithStatus(HttpStatusCode.Forbidden))).toBe(true);
    expect(ignoreError(createErrorWithStatus(HttpStatusCode.Unauthorized))).toBe(true);
    expect(ignoreError(createErrorWithStatus(HttpStatusCode.InternalServerError))).toBe(false);
    authentication.flush({ access_token: 'new-token' });

    expect(windowService.setStorageItem).toHaveBeenCalledWith('oibus-token', 'new-token');
    http.expectOne({ method: 'GET', url: '/api/users/current-user' }).flush(user);
    await expect(result).resolves.toEqual(user);
  });
});

function createErrorWithStatus(status: HttpStatusCode) {
  return new HttpErrorResponse({ status });
}
