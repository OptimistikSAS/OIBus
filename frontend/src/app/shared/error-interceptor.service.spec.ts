import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpContext, HttpStatusCode, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { errorInterceptor, ignoreErrorIfStatusIs, SHOULD_IGNORE_ERROR_PREDICATE } from './error-interceptor.service';
import { NotificationService } from './notification.service';
import { WindowService } from './window.service';
import { CurrentUserService } from './current-user.service';
import { createMock } from 'ngx-speculoos';

describe('ErrorInterceptorService', () => {
  let http: HttpTestingController;
  let httpClient: HttpClient;
  const noop = () => {};
  let notificationService: jasmine.SpyObj<NotificationService>;
  let windowService: jasmine.SpyObj<WindowService>;
  let currentUserService: jasmine.SpyObj<CurrentUserService>;

  beforeEach(() => {
    notificationService = createMock(NotificationService);
    windowService = createMock(WindowService);
    currentUserService = createMock(CurrentUserService);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        {
          provide: NotificationService,
          useValue: notificationService
        },
        {
          provide: WindowService,
          useValue: windowService
        },
        {
          provide: CurrentUserService,
          useValue: currentUserService
        }
      ]
    });

    http = TestBed.inject(HttpTestingController);
    httpClient = TestBed.inject(HttpClient);
  });

  it('should emit error when error is not an HTTP response', () => {
    httpClient.get('/test').subscribe({ error: noop });
    http.expectOne('/test').error(new ProgressEvent('error'));

    expect(notificationService.error).toHaveBeenCalledWith('0 - Http failure response for /test: 0');
  });

  it('should redirect to login after logging out when 401 error', () => {
    httpClient.get('/test').subscribe({ error: noop });
    http.expectOne('/test').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(windowService.redirectTo).toHaveBeenCalledWith('/login?error=401');
  });

  it('should emit a custom message with a 403 error', () => {
    httpClient.get('/test').subscribe({ error: noop });
    http.expectOne('/test').flush(null, { status: 403, statusText: 'Forbidden' });

    expect(notificationService.error).toHaveBeenCalledWith('common.forbidden', { url: '/test' });
  });

  it('should emit a custom message with a 404 error', () => {
    httpClient.get('/test').subscribe({ error: noop });
    http.expectOne('/test').flush(null, { status: 404, statusText: 'Not Found' });

    expect(notificationService.error).toHaveBeenCalledWith('common.not-found', { url: '/test' });
  });

  it('should emit error message when error is an HTTP response', () => {
    httpClient.get('/test').subscribe({ error: noop });
    http.expectOne('/test').flush(null, { status: 500, statusText: 'Server Error' });

    expect(notificationService.errorMessage).toHaveBeenCalledWith('500 - Http failure response for /test: 500 Server Error');
  });

  it('should emit error message when error is an HTTP response with an exception message in the body', () => {
    httpClient.get('/test').subscribe({ error: noop });
    http.expectOne('/test').flush({ message: 'olala' }, { status: 500, statusText: 'Server Error' });

    expect(notificationService.errorMessage).toHaveBeenCalledWith('500 - Http failure response for /test: 500 Server Error - olala');
  });

  it('should emit i18ned error key when error is an HTTP response with an functional error in the body', () => {
    httpClient.get('/test').subscribe({ error: noop });
    http.expectOne('/test').flush({ functionalError: { code: 'DUPLICATE_UNIT_LABEL' } }, { status: 400, statusText: 'Bad request' });

    expect(notificationService.error).toHaveBeenCalledWith('enums.functional-error.DUPLICATE_UNIT_LABEL');
  });

  it('should ignore an error if a predicate is passed to the SHOULD_IGNORE_ERROR_PREDICATE context', () => {
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

  it('should ignore an error if ignoreErrorIfStatusIs is used as a context', () => {
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
});
