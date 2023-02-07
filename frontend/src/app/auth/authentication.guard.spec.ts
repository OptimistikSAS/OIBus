import { TestBed } from '@angular/core/testing';

import { AuthenticationGuard } from './authentication.guard';
import { ActivatedRouteSnapshot, provideRouter, RouterStateSnapshot, UrlTree } from '@angular/router';
import { WindowService } from '../shared/window.service';
import { createMock } from 'ngx-speculoos';

describe('AuthenticationGuard', () => {
  let guard: AuthenticationGuard;
  let windowService: jasmine.SpyObj<WindowService>;

  beforeEach(() => {
    windowService = createMock(WindowService);

    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: WindowService, useValue: windowService }]
    });
    guard = TestBed.inject(AuthenticationGuard);
  });

  it('should redirect and store requested url if no token present in canActivateChild', () => {
    const route = {} as ActivatedRouteSnapshot;
    const state: RouterStateSnapshot = { url: '/dashboards/42' } as RouterStateSnapshot;
    let result: boolean | UrlTree = false;
    guard.canActivateChild(route, state).subscribe(b => (result = b));
    expect(`${result}`).toBe('/login?auto=true');
    expect(guard.getRequestedUrl()).toBe('/dashboards/42');
  });

  it('should emit true if token present in canActivateChild', () => {
    windowService.getStorageItem.and.returnValue('fake.token');

    const route = {} as ActivatedRouteSnapshot;
    const state: RouterStateSnapshot = { url: '/dashboards/42' } as RouterStateSnapshot;
    let result: boolean | UrlTree = false;
    guard.canActivateChild(route, state).subscribe(b => (result = b));
    expect(result).toBeTrue();
    expect(guard.getRequestedUrl()).toBe('/');
  });
});
