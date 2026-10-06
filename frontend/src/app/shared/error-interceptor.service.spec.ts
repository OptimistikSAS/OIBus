import { HttpClient, HttpContext, HttpStatusCode, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { createMock, MockObject } from '../../test/vitest-create-mock';
import { CurrentUserService } from './current-user.service';
import {
  errorInterceptor,
  ignoreErrorIfStatusIs,
  ignoreErrorUnlessStatusIs,
  SHOULD_IGNORE_ERROR_PREDICATE
} from './error-interceptor.service';
import { NotificationService } from './notification.service';
import { WindowService } from './window.service';

describe('ErrorInterceptorService', () => {
  let http: HttpTestingController;
  let httpClient: HttpClient;
  const noop = () => {};
  let notificationService: MockObject<NotificationService>;
  let windowService: MockObject<WindowService>;
  let currentUserService: MockObject<CurrentUserService>;

  beforeEach(() => {
    notificationService = createMock(NotificationService);
    windowService = createMock(WindowService);
    currentUserService = createMock(CurrentUserService);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: NotificationService, useValue: notificationService },
        { provide: WindowService, useValue: windowService },
        { provide: CurrentUserService, useValue: currentUserService }
      ]
    });
    http = TestBed.inject(HttpTestingController);
    httpClient = TestBed.inject(HttpClient);
  });

  afterEach(() => http.verify());

  test('should emit error when error is not an HTTP response', () => {
    httpClient.get('/test').subscribe({ error: noop });
    http.expectOne('/test').error(new ProgressEvent('error'));
    expect(notificationService.error).toHaveBeenCalledWith('0 - Http failure response for /test: 0');
  });

  test('should redirect to login after logging out when 401 error', () => {
    httpClient.get('/test').subscribe({ error: noop });
    http.expectOne('/test').flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(windowService.redirectTo).toHaveBeenCalledWith('/login?error=401');
  });

  test('should emit a custom message with a 403 error', () => {
    httpClient.get('/test').subscribe({ error: noop });
    http.expectOne('/test').flush(null, { status: 403, statusText: 'Forbidden' });
    expect(notificationService.error).toHaveBeenCalledWith('common.forbidden', { url: '/test' });
  });

  test('should emit a custom message with a 404 error', () => {
    httpClient.get('/test').subscribe({ error: noop });
    http.expectOne('/test').flush(null, { status: 404, statusText: 'Not Found' });
    expect(notificationService.error).toHaveBeenCalledWith('common.not-found', { url: '/test' });
  });

  test('should emit error message when error is an HTTP response', () => {
    httpClient.get('/test').subscribe({ error: noop });
    http.expectOne('/test').flush(null, { status: 500, statusText: 'Server Error' });
    expect(notificationService.errorMessage).toHaveBeenCalledWith('500 - Http failure response for /test: 500 Server Error');
  });

  test('should emit error message when error is an HTTP response with an exception message in the body', () => {
    httpClient.get('/test').subscribe({ error: noop });
    http.expectOne('/test').flush({ message: 'olala' }, { status: 500, statusText: 'Server Error' });
    expect(notificationService.errorMessage).toHaveBeenCalledWith('500 - Http failure response for /test: 500 Server Error - olala');
  });

  test('should emit i18ned error key when error is an HTTP response with a functional error in the body', () => {
    httpClient.get('/test').subscribe({ error: noop });
    http.expectOne('/test').flush({ functionalError: { code: 'DUPLICATE_UNIT_LABEL' } }, { status: 400, statusText: 'Bad request' });
    expect(notificationService.error).toHaveBeenCalledWith('enums.functional-error.DUPLICATE_UNIT_LABEL');
  });

  test('should ignore an error if a predicate is passed to the SHOULD_IGNORE_ERROR_PREDICATE context', () => {
    const context = new HttpContext().set(
      SHOULD_IGNORE_ERROR_PREDICATE,
      error => error.status === HttpStatusCode.NotFound || error.status === HttpStatusCode.Forbidden
    );
    httpClient.get('/test', { context }).subscribe({ error: noop });
    http.expectOne('/test').flush({ message: 'olala' }, { status: 404, statusText: 'Not Found' });
    expect(notificationService.errorMessage).not.toHaveBeenCalled();

    httpClient.get('/test', { context }).subscribe({ error: noop });
    http.expectOne('/test').flush({ message: 'olala' }, { status: 403, statusText: 'Forbidden' });
    expect(notificationService.errorMessage).not.toHaveBeenCalled();

    httpClient.get('/test', { context }).subscribe({ error: noop });
    http.expectOne('/test').flush({ message: 'olala' }, { status: 500, statusText: 'Server Error' });
    expect(notificationService.errorMessage).toHaveBeenCalled();
  });

  test('should ignore an error if ignoreErrorIfStatusIs is used as a context', () => {
    const context = ignoreErrorIfStatusIs(HttpStatusCode.NotFound, HttpStatusCode.Forbidden);
    httpClient.get('/test', { context }).subscribe({ error: noop });
    http.expectOne('/test').flush({ message: 'olala' }, { status: 404, statusText: 'Not Found' });
    expect(notificationService.errorMessage).not.toHaveBeenCalled();

    httpClient.get('/test', { context }).subscribe({ error: noop });
    http.expectOne('/test').flush({ message: 'olala' }, { status: 403, statusText: 'Forbidden' });
    expect(notificationService.errorMessage).not.toHaveBeenCalled();

    httpClient.get('/test', { context }).subscribe({ error: noop });
    http.expectOne('/test').flush({ message: 'olala' }, { status: 500, statusText: 'Server Error' });
    expect(notificationService.errorMessage).toHaveBeenCalled();
  });

  test('should ignore every error except the listed ones if ignoreErrorUnlessStatusIs is used as a context', () => {
    const context = ignoreErrorUnlessStatusIs(HttpStatusCode.Unauthorized);
    httpClient.get('/test', { context }).subscribe({ error: noop });
    http.expectOne('/test').error(new ProgressEvent('error'));
    httpClient.get('/test', { context }).subscribe({ error: noop });
    http.expectOne('/test').flush({ message: 'olala' }, { status: 404, statusText: 'Not Found' });
    httpClient.get('/test', { context }).subscribe({ error: noop });
    http.expectOne('/test').flush({ message: 'olala' }, { status: 500, statusText: 'Server Error' });
    expect(notificationService.error).not.toHaveBeenCalled();
    expect(notificationService.errorMessage).not.toHaveBeenCalled();

    httpClient.get('/test', { context }).subscribe({ error: noop });
    http.expectOne('/test').flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(currentUserService.logout).toHaveBeenCalled();
    expect(windowService.redirectTo).toHaveBeenCalledWith('/login?error=401');
  });
});
