import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateChild, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { WindowService } from '../shared/window.service';

/**
 * An authentication guard that checks if the ID token is present, except when authentication is disabled, which only happens
 * during E2E tests. This is the only way we managed to run E2E tests.
 * The guard is currently only a CanActivateChild guard, but could also implement CanActivate using the same strategy if
 * needed.
 */
@Injectable({
  providedIn: 'root'
})
export class AuthenticationGuard implements CanActivateChild {
  private requestedUrl: string | null = null;

  constructor(private router: Router, private windowService: WindowService) {}

  canActivateChild(childRoute: ActivatedRouteSnapshot, routerState: RouterStateSnapshot): Observable<boolean | UrlTree> {
    return this.canNavigate(routerState.url);
  }

  getRequestedUrl(): string {
    return this.requestedUrl ?? '/';
  }

  private canNavigate(requestedUrl: string): Observable<boolean | UrlTree> {
    const allowed = this.isTokenPresent();
    if (!allowed) {
      this.requestedUrl = requestedUrl;
    }
    return of(allowed || this.router.createUrlTree(['/login'], { queryParams: { auto: true } }));
  }

  private isTokenPresent(): boolean {
    const token = this.windowService.getStorageItem('oibus-token');
    return !!token;
  }
}
