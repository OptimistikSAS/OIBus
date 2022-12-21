import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

/**
 * A notification, which can contain a plain message (typically for technical errors coming from the backend),
 * or an i18n key and, potentially, associated i18n arguments, which can be used to display an internationalized
 * message (typically for functional errors coming from the backend).
 */
export interface Notification {
  type: 'success' | 'error';
  message?: string;
  i18nKey?: string;
  i18nArgs?: { [key: string]: string };
}

/**
 * A service used to signal a notification, either a success or an error.
 * This service simply emits all the messages from an observable,
 * and the NotificationComponent observes them to display them when they're emitted.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private messages$ = new Subject<Notification>();

  get notificationChanges(): Observable<Notification> {
    return this.messages$.asObservable();
  }

  success(i18nKey: string, i18nArgs?: { [key: string]: string }) {
    this.messages$.next({ type: 'success', i18nKey, i18nArgs });
  }

  error(i18nKey: string, i18nArgs?: { [key: string]: string }) {
    this.messages$.next({ type: 'error', i18nKey, i18nArgs });
  }

  errorMessage(message: string) {
    this.messages$.next({ type: 'error', message });
  }
}
