import { inject, Service } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateChildFn, Router, RouterStateSnapshot } from '@angular/router';

import { map, of, take } from 'rxjs';

import { CurrentUserService } from '../shared/current-user.service';
import { ModalService } from '../shared/modal.service';
import { WindowService } from '../shared/window.service';
import { ChangePasswordModalComponent } from '../user-settings/change-password-modal/change-password-modal.component';

@Service()
export class RequestedUrlService {
  private requestedUrl: string | null = null;

  getRequestedUrl(): string {
    return this.requestedUrl ?? '/';
  }

  setRequestedUrl(url: string): void {
    this.requestedUrl = url;
  }
}

/**
 * An authentication guard that checks if the ID token is present, except when authentication is disabled, which only happens
 * during E2E tests. This is the only way we managed to run E2E tests.
 * A user who must change their password (the default account still having the default password) can do nothing else: the
 * guard opens the password change instead of the page, and logs them out once changed, to log in with the new password.
 * The guard is currently only a CanActivateChild guard, but could also implement CanActivate using the same strategy if
 * needed.
 */
export const authenticationGuard: CanActivateChildFn = (_childRoute: ActivatedRouteSnapshot, routerState: RouterStateSnapshot) => {
  const windowService = inject(WindowService);
  const router = inject(Router);
  const requestedUrlService = inject(RequestedUrlService);

  const currentUserService = inject(CurrentUserService);
  const modalService = inject(ModalService);

  if (!windowService.getStorageItem('oibus-token')) {
    requestedUrlService.setRequestedUrl(routerState.url);
    return of(router.createUrlTree(['/login'], { queryParams: { auto: true } }));
  }
  return currentUserService.get().pipe(
    take(1),
    map(user => {
      if (!user?.mustChangePassword) {
        return true;
      }
      const modal = modalService.open(ChangePasswordModalComponent, { backdrop: 'static', keyboard: false });
      modal.componentInstance.forceChange();
      modal.result.subscribe(() => currentUserService.logout());
      return false;
    })
  );
};
