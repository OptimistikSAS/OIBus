import { inject, Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateChildFn, Router, RouterStateSnapshot } from '@angular/router';
import { of } from 'rxjs';
import { WindowService } from '../shared/window.service';

@Injectable({
  providedIn: 'root'
})
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
 * The guard is currently only a CanActivateChild guard, but could also implement CanActivate using the same strategy if
 * needed.
 */
export const authenticationGuard: CanActivateChildFn = (childRoute: ActivatedRouteSnapshot, routerState: RouterStateSnapshot) => {
  const windowService = inject(WindowService);
  const router = inject(Router);
  const requestedUrlService = inject(RequestedUrlService);

  const allowed = !!windowService.getStorageItem('oibus-token');

  if (!allowed) {
    requestedUrlService.setRequestedUrl(routerState.url);
  }
  return of(allowed || router.createUrlTree(['/login'], { queryParams: { auto: true } }));
};
