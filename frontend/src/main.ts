import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';

import { AppComponent } from './app/app.component';
import { ROUTES } from './app/app.routes';
import { authenticationInterceptor } from './app/auth/authentication.interceptor';
import { provideDatepicker } from './app/shared/datepicker.providers';
import { errorInterceptor } from './app/shared/error-interceptor.service';
import { provideI18n } from './i18n/i18n';

bootstrapApplication(AppComponent, {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(ROUTES),
    provideI18n(),
    provideDatepicker(),
    provideHttpClient(withInterceptors([authenticationInterceptor, errorInterceptor]))
  ]
}).catch(err => console.error(err));
