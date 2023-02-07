import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { HTTP_INTERCEPTORS, HttpClient } from '@angular/common/http';
import { AuthenticationInterceptor } from './authentication.interceptor';
import { TestBed } from '@angular/core/testing';
import { WindowService } from '../shared/window.service';
import { createMock } from 'ngx-speculoos';

describe('AuthenticationInterceptor', () => {
  let http: HttpTestingController;
  let httpClient: HttpClient;

  let windowService: jasmine.SpyObj<WindowService>;

  beforeEach(() => {
    windowService = createMock(WindowService);

    TestBed.configureTestingModule({
      providers: [
        { provide: HTTP_INTERCEPTORS, useClass: AuthenticationInterceptor, multi: true },
        { provide: WindowService, useValue: windowService }
      ],
      imports: [HttpClientTestingModule]
    });

    http = TestBed.inject(HttpTestingController);
    httpClient = TestBed.inject(HttpClient);
  });

  it('should send the request as is if no token', () => {
    httpClient.get('/api/foo').subscribe();
    const testRequest = http.expectOne('/api/foo');
    expect(testRequest.request.headers.get('Authorization')).toBeFalsy();
  });

  it('should send the token if present', () => {
    windowService.getStorageItem.and.returnValue('fake.token');
    httpClient.get('/api/foo').subscribe();
    const testRequest = http.expectOne('/api/foo');
    expect(testRequest.request.headers.get('Authorization')).toBe('Bearer fake.token');
  });
});
