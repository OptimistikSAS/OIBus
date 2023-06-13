import { inject } from '@angular/core';
import { HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { WindowService } from '../shared/window.service';

/**
 * The authentication interceptor uses the token stored locally
 */
export const authenticationInterceptor: HttpInterceptorFn = (request: HttpRequest<any>, next: HttpHandlerFn) => {
  const windowService = inject(WindowService);
  const token = windowService.getStorageItem('oibus-token');
  return next(token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request);
};
