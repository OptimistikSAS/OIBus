import { inject, Service } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateChildFn, CanActivateFn, Router, RouterStateSnapshot } from '@angular/router';

import { map, of, take } from 'rxjs';

import { CurrentUserService } from '../shared/current-user.service';
import { WindowService } from '../shared/window.service';

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
 * guard sends them to the password change page instead.
 * The guard is currently only a CanActivateChild guard, but could also implement CanActivate using the same strategy if
 * needed.
 */
export const authenticationGuard: CanActivateChildFn = (_childRoute: ActivatedRouteSnapshot, routerState: RouterStateSnapshot) => {
  const windowService = inject(WindowService);
  const router = inject(Router);
  const requestedUrlService = inject(RequestedUrlService);
  const currentUserService = inject(CurrentUserService);

  if (!windowService.getStorageItem('oibus-token')) {
    requestedUrlService.setRequestedUrl(routerState.url);
    return of(router.createUrlTree(['/login'], { queryParams: { auto: true } }));
  }
  return currentUserService.get().pipe(
    take(1),
    map(user => (user?.mustChangePassword ? router.createUrlTree(['/change-password']) : true))
  );
};

/**
 * The guard of the password change page: only a logged-in user who must change their password can open it, the others are
 * sent to the login page or the home page.
 */
export const passwordChangeGuard: CanActivateFn = () => {
  const windowService = inject(WindowService);
  const router = inject(Router);
  const currentUserService = inject(CurrentUserService);

  if (!windowService.getStorageItem('oibus-token')) {
    return of(router.createUrlTree(['/login'], { queryParams: { auto: true } }));
  }
  return currentUserService.get().pipe(
    take(1),
    map(user => (user?.mustChangePassword ? true : router.createUrlTree(['/'])))
  );
};
