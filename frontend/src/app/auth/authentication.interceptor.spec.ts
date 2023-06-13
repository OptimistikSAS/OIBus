import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { authenticationInterceptor } from './authentication.interceptor';
import { TestBed } from '@angular/core/testing';
import { WindowService } from '../shared/window.service';
import { createMock } from 'ngx-speculoos';

describe('authenticationInterceptor', () => {
  let http: HttpTestingController;
  let httpClient: HttpClient;

  let windowService: jasmine.SpyObj<WindowService>;

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
