import { TestBed } from '@angular/core/testing';

import { authenticationGuard, RequestedUrlService } from './authentication.guard';
import { Observable } from 'rxjs';
import { ActivatedRouteSnapshot, CanActivateChildFn, provideRouter, RouterStateSnapshot, UrlTree } from '@angular/router';
import { WindowService } from '../shared/window.service';
import { createMock } from 'ngx-speculoos';

describe('authenticationGuard', () => {
  let guard: CanActivateChildFn;
  let windowService: jasmine.SpyObj<WindowService>;

  beforeEach(() => {
    windowService = createMock(WindowService);

    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: WindowService, useValue: windowService }]
    });
    guard = (...guardParameters) => TestBed.runInInjectionContext(() => authenticationGuard(...guardParameters));
  });

  it('should redirect and store requested url if no token present in canActivateChild', () => {
    const route = {} as ActivatedRouteSnapshot;
    const state: RouterStateSnapshot = { url: '/dashboards/42' } as RouterStateSnapshot;
    let result: boolean | UrlTree | null = null;
    (guard(route, state) as Observable<boolean>).subscribe(b => (result = b));
    expect(`${result}`).toBe('/login?auto=true');
    const requestedUrl = TestBed.inject(RequestedUrlService).getRequestedUrl();
    expect(requestedUrl).toBe('/dashboards/42');
  });

  it('should emit true if token present in canActivateChild', () => {
    windowService.getStorageItem.and.returnValue('fake.token');

    const route = {} as ActivatedRouteSnapshot;
    const state: RouterStateSnapshot = { url: '/dashboards/42' } as RouterStateSnapshot;
    let result: boolean | UrlTree | null = null;
    (guard(route, state) as Observable<boolean>).subscribe(b => (result = b));
    expect(result).toBeTrue();
    const requestedUrl = TestBed.inject(RequestedUrlService).getRequestedUrl();
    expect(requestedUrl).toBe('/');
  });
});
