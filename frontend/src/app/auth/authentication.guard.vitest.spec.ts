import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, CanActivateChildFn, provideRouter, RouterStateSnapshot, UrlTree } from '@angular/router';
import { firstValueFrom, Observable } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';

import { authenticationGuard, RequestedUrlService } from './authentication.guard';
import { WindowService } from '../shared/window.service';
import { createMock, MockObject } from '../../test/vitest-create-mock';

describe('authenticationGuard', () => {
  let guard: CanActivateChildFn;
  let windowService: MockObject<WindowService>;

  beforeEach(() => {
    windowService = createMock(WindowService);

    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: WindowService, useValue: windowService }]
    });
    guard = (...guardParameters) => TestBed.runInInjectionContext(() => authenticationGuard(...guardParameters));
  });

  test('should redirect and store requested url if no token present in canActivateChild', async () => {
    const route = {} as ActivatedRouteSnapshot;
    const state = { url: '/dashboards/42' } as RouterStateSnapshot;
    const result = await firstValueFrom(guard(route, state) as Observable<boolean | UrlTree>);

    expect(`${result}`).toBe('/login?auto=true');
    expect(TestBed.inject(RequestedUrlService).getRequestedUrl()).toBe('/dashboards/42');
  });

  test('should emit true if token present in canActivateChild', async () => {
    windowService.getStorageItem.mockReturnValue('fake.token');

    const route = {} as ActivatedRouteSnapshot;
    const state = { url: '/dashboards/42' } as RouterStateSnapshot;
    const result = await firstValueFrom(guard(route, state) as Observable<boolean | UrlTree>);

    expect(result).toBe(true);
    expect(TestBed.inject(RequestedUrlService).getRequestedUrl()).toBe('/');
  });
});
