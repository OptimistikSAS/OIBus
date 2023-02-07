import { Injectable } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';
import { WindowService } from '../shared/window.service';

/**
 * The authentication interceptor uses the token stored locally
 */
@Injectable()
export class AuthenticationInterceptor implements HttpInterceptor {
  constructor(private windowService: WindowService) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const token = this.windowService.getStorageItem('oibus-token');
    return next.handle(this.cloneRequest(request, token));
  }

  private cloneRequest(request: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
    return token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request;
  }
}
