import { inject, Service } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateChildFn, CanActivateFn, Router, RouterStateSnapshot } from '@angular/router';

import { map, of, take } from 'rxjs';

import { CurrentUserService } from '../shared/current-user.service';
import { WindowService } from '../shared/window.service';

/** The query parameter of the login page telling the user their password has just been changed */
export const PASSWORD_CHANGED_PARAM = 'password-changed';

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
 * guard sends them to the password change page instead. When the current user can't be fetched with the token, whether
 * they must is unknown: the guard sends them to the login page.
 * The guard is currently only a CanActivateChild guard, but could also implement CanActivate using the same strategy if
 * needed.
 */
export const authenticationGuard: CanActivateChildFn = (_childRoute: ActivatedRouteSnapshot, routerState: RouterStateSnapshot) => {
  const windowService = inject(WindowService);
  const router = inject(Router);
  const requestedUrlService = inject(RequestedUrlService);
  const currentUserService = inject(CurrentUserService);

  const toLogin = () => {
    requestedUrlService.setRequestedUrl(routerState.url);
    return router.createUrlTree(['/login'], { queryParams: { auto: true } });
  };
  if (!windowService.getStorageItem('oibus-token')) {
    return of(toLogin());
  }
  return currentUserService.get().pipe(
    take(1),
    map(user => {
      if (!user) {
        return toLogin();
      }
      return user.mustChangePassword ? router.createUrlTree(['/change-password']) : true;
    })
  );
};

/**
 * The guard of the password change page: only a logged-in user who must change their password can open it, the others are
 * sent to the login page (also when the current user can't be fetched) or the home page.
 */
export const passwordChangeGuard: CanActivateFn = () => {
  const windowService = inject(WindowService);
  const router = inject(Router);
  const currentUserService = inject(CurrentUserService);

  const loginUrl = router.createUrlTree(['/login'], { queryParams: { auto: true } });
  if (!windowService.getStorageItem('oibus-token')) {
    return of(loginUrl);
  }
  return currentUserService.get().pipe(
    take(1),
    map(user => {
      if (!user) {
        return loginUrl;
      }
      return user.mustChangePassword ? true : router.createUrlTree(['/']);
    })
  );
};
