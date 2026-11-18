import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { of } from 'rxjs';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { UserDTO } from '@oibus/shared/api/user.model';

import { EmptyRouteComponent } from '../../test/empty-route.component';
import testData from '../../test/test-data';
import { createMock, MockObject } from '../../test/vitest-create-mock';
import { CurrentUserService } from '../shared/current-user.service';
import { MockModalService, provideModalTesting } from '../shared/mock-modal.service.testing';
import { WindowService } from '../shared/window.service';
import { ChangePasswordModalComponent } from '../user-settings/change-password-modal/change-password-modal.component';
import { authenticationGuard, RequestedUrlService } from './authentication.guard';

describe('authenticationGuard', () => {
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
          {
            path: '',
            canActivateChild: [authenticationGuard],
            children: [{ path: 'dashboards/:id', component: EmptyRouteComponent }]
          }
        ]),
        { provide: WindowService, useValue: windowService },
        { provide: CurrentUserService, useValue: currentUserService },
        provideModalTesting()
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

  test('should open the password change instead of the page when the user must change their password', async () => {
    windowService.getStorageItem.mockReturnValue('fake.token');
    currentUserService.get.mockReturnValue(of({ ...user, mustChangePassword: true }));
    const modalService: MockModalService<ChangePasswordModalComponent> = TestBed.inject(MockModalService);
    const modalComponent = createMock(ChangePasswordModalComponent);
    modalService.mockClosedModal(modalComponent);
    const open = vi.spyOn(modalService, 'open');

    await router.navigateByUrl('/dashboards/42');

    expect(router.url).toBe('/');
    expect(open).toHaveBeenCalledWith(ChangePasswordModalComponent, { backdrop: 'static', keyboard: false });
    expect(modalComponent.forceChange).toHaveBeenCalled();
    // logged out once the password changed, to log in with the new one
    expect(currentUserService.logout).toHaveBeenCalled();
  });
});
