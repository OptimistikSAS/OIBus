import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { beforeEach, describe, expect, test } from 'vitest';

import { EmptyRouteComponent } from '../../test/empty-route.component';
import { createMock, MockObject } from '../../test/vitest-create-mock';
import { WindowService } from '../shared/window.service';
import { authenticationGuard, RequestedUrlService } from './authentication.guard';

describe('authenticationGuard', () => {
  let windowService: MockObject<WindowService>;
  let router: Router;

  beforeEach(() => {
    windowService = createMock(WindowService);

    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'login', component: EmptyRouteComponent },
          {
            path: '',
            canActivateChild: [authenticationGuard],
            children: [{ path: 'dashboards/:id', component: EmptyRouteComponent }]
          }
        ]),
        { provide: WindowService, useValue: windowService }
      ]
    });
    router = TestBed.inject(Router);
  });

  test('should redirect to the login page and store the requested url if no token is present', async () => {
    windowService.getStorageItem.mockReturnValue(null);

    await router.navigateByUrl('/dashboards/42');

    expect(windowService.getStorageItem).toHaveBeenCalledWith('oibus-token');
    expect(router.url).toBe('/login?auto=true');
    expect(TestBed.inject(RequestedUrlService).getRequestedUrl()).toBe('/dashboards/42');
  });

  test('should allow the navigation if a token is present', async () => {
    windowService.getStorageItem.mockReturnValue('fake.token');

    await router.navigateByUrl('/dashboards/42');

    expect(router.url).toBe('/dashboards/42');
    expect(TestBed.inject(RequestedUrlService).getRequestedUrl()).toBe('/');
  });
});
