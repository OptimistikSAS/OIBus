import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { of } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';

import { UserDTO } from '@oibus/shared/api/user.model';

import { EmptyRouteComponent } from '../../test/empty-route.component';
import testData from '../../test/test-data';
import { createMock, MockObject } from '../../test/vitest-create-mock';
import { CurrentUserService } from '../shared/current-user.service';
import { WindowService } from '../shared/window.service';
import { authenticationGuard, passwordChangeGuard, RequestedUrlService } from './authentication.guard';

describe('authentication guards', () => {
  let windowService: MockObject<WindowService>;
  let currentUserService: MockObject<CurrentUserService>;
  let router: Router;
  const user: UserDTO = testData.users.list[0];

  beforeEach(() => {
    windowService = createMock(WindowService);
    currentUserService = createMock(CurrentUserService);
    currentUserService.get.mockReturnValue(of(user));

    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'login', component: EmptyRouteComponent },
          { path: 'change-password', canActivate: [passwordChangeGuard], component: EmptyRouteComponent },
          {
            path: '',
            canActivateChild: [authenticationGuard],
            children: [
              { path: '', component: EmptyRouteComponent },
              { path: 'dashboards/:id', component: EmptyRouteComponent }
            ]
          }
        ]),
        { provide: WindowService, useValue: windowService },
        { provide: CurrentUserService, useValue: currentUserService }
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

  test('should send a user who must change their password to the password change page', async () => {
    windowService.getStorageItem.mockReturnValue('fake.token');
    currentUserService.get.mockReturnValue(of({ ...user, mustChangePassword: true }));

    await router.navigateByUrl('/dashboards/42');

    expect(router.url).toBe('/change-password');
  });

  describe('password change page', () => {
    test('should be opened by a user who must change their password', async () => {
      windowService.getStorageItem.mockReturnValue('fake.token');
      currentUserService.get.mockReturnValue(of({ ...user, mustChangePassword: true }));

      await router.navigateByUrl('/change-password');

      expect(router.url).toBe('/change-password');
    });

    test('should send a user who has nothing to change to the home page', async () => {
      windowService.getStorageItem.mockReturnValue('fake.token');

      await router.navigateByUrl('/change-password');

      expect(router.url).toBe('/');
    });

    test('should send to the login page when no token is present', async () => {
      windowService.getStorageItem.mockReturnValue(null);

      await router.navigateByUrl('/change-password');

      expect(router.url).toBe('/login?auto=true');
    });
  });
});
