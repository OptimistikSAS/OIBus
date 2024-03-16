import { inject } from '@angular/core';
import { tap } from 'rxjs';
import { HttpContext, HttpContextToken, HttpErrorResponse, HttpInterceptorFn, HttpStatusCode } from '@angular/common/http';
import { NotificationService } from './notification.service';
import { WindowService } from './window.service';
import { CurrentUserService } from './current-user.service';

/**
 * Allows to define a predicate to indicate if the error should be ignored by the interceptor.
 * By default, all errors are handled by the interceptor.
 * You can add a context to a specific request to indicate that the interceptor should ignore the error,
 * by defining a predicate that returns true:
 * ```
 * const context = new HttpContext().set(SHOULD_IGNORE_ERROR_PREDICATE, error => error.status === HttpStatusCode.NotFound);
 * return this.http.get('/api/users', { context });
 * ```
 */
export const SHOULD_IGNORE_ERROR_PREDICATE = new HttpContextToken<(error: HttpErrorResponse) => boolean>(() => () => false);

/**
 * Shorthand function to define a SHOULD_IGNORE_ERROR_PREDICATE context that ignore one or several HTTP errors
 * ```
 * const context = ignoreErrorIfStatusIs(HttpStatusCode.NotFound, HttpStatusCode.Forbidden);
 * return this.http.get('/api/users', { context });
 * ```
 */
export function ignoreErrorIfStatusIs(...statusCodes: Array<HttpStatusCode>) {
  return new HttpContext().set(SHOULD_IGNORE_ERROR_PREDICATE, error => statusCodes.includes(error.status));
}

function getMessage(errorResponse: HttpErrorResponse): string {
  let message = `${errorResponse.status} - ${errorResponse.message}`;
  if (errorResponse.error && errorResponse.error.message) {
    message += ' - ' + errorResponse.error.message;
  }
  return message.trim();
}

/**
 * An HTTP interceptor that detects error responses and emits them,
 * so that the NotificationComponent can display a message to signal the error.
 */
export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  const notificationService = inject(NotificationService);
  const windowService = inject(WindowService);
  const currentUserService = inject(CurrentUserService);

  return next(request).pipe(
    tap({
      error: errorResponse => {
        // if there is a context specifically asking to ignore the error, we don't handle it
        const shouldIgnoreErrorPredicate = request.context.get(SHOULD_IGNORE_ERROR_PREDICATE);
        if (!shouldIgnoreErrorPredicate(errorResponse)) {
          if (errorResponse.error instanceof ProgressEvent) {
            // A client-side or network error occurred.
            notificationService.error(getMessage(errorResponse));
          } else {
            // The backend returned an unsuccessful response code.
            if (errorResponse.status === HttpStatusCode.Unauthorized) {
              // we do not navigate with the router here but instead reload the app because the favorites and shared
              // entities (and possibly other stuff) are in memory, and need to disappear
              // so the easiest and safest way to do that is to reload the app
              // we also want to delete the token, because otherwise, the redirect loop will be infinite
              currentUserService.logout();
              windowService.redirectTo('/login?error=401');
            } else if (errorResponse.status === HttpStatusCode.Forbidden) {
              notificationService.error('common.forbidden', { url: errorResponse.url });
            } else if (errorResponse.status === HttpStatusCode.NotFound) {
              notificationService.error('common.not-found', { url: errorResponse.url });
            } else if (errorResponse.error && errorResponse.error.functionalError) {
              notificationService.error(`enums.functional-error.${errorResponse.error.functionalError.code}`);
            } else {
              notificationService.errorMessage(getMessage(errorResponse));
            }
          }
        }
      }
    })
  );
};
