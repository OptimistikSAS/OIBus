import { Injectable } from '@angular/core';
import { catchError, Observable, of, shareReplay, switchMap } from 'rxjs';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Timezone } from '../../../../shared/model/types';
import { User } from '../../../../shared/model/user.model';
import { WindowService } from './window.service';

interface Token {
  access_token: string;
}

@Injectable({
  providedIn: 'root'
})
export class CurrentUserService {
  private currentUser$: Observable<User | null>;

  /**
   * The current user timezone. The timezone is handled like the user language: it's read from local storage, or defaulted to
   * Europe/Paris if not present in local storage. And at load time, in the app component, if the actual current user timezone
   * is different from the used one, the actual current user timezone is stored in local storage and the app is reloaded.
   */
  private timezone: Timezone;

  constructor(private http: HttpClient, private windowService: WindowService) {
    const storedToken = windowService.getStorageItem('oibus-token');
    this.currentUser$ = of(storedToken !== null).pipe(
      switchMap(authenticated => (authenticated ? this.retrieveConnection() : of(null))),
      shareReplay(1)
    );
    this.timezone = windowService.timezoneToUse();
  }

  /**
   * Gets a flux emitting the current user or null as soon as it's known, and then re-emits every time it changes.
   */
  get(): Observable<User | null> {
    return this.currentUser$;
  }

  retrieveConnection(): Observable<User | null> {
    return this.http.get<User>('/api/users/current-user').pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 403) {
          // Triggered when password is reset or token expired
          this.logout();
        }
        return of(null);
      })
    );
  }

  logout(): void {
    this.windowService.removeStorageItem('oibus-token');
    // we do not navigate with the router here but instead reload the app to empty some cache data
    // so the easiest and safest way to do that is to reload the app
    this.windowService.redirectTo('/login');
  }

  loginWithPassword(login: string, password: string): Observable<User | null> {
    const test = window.btoa(`${login}:${password}`);
    const headers = { authorization: `Basic ${test}` };
    return this.http.post<Token>('/api/users/authentication', null, { headers }).pipe(
      switchMap(token => {
        this.windowService.setStorageItem('oibus-token', token.access_token);
        this.currentUser$ = this.retrieveConnection();
        return this.get();
      })
    );
  }

  /**
   * Returns the current user timezone, or the default one found in local storage if no current user yet.
   */
  getTimezone() {
    return this.timezone;
  }
}
