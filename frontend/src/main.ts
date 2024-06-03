import { provideZoneChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app/app.component';
import { ROUTES } from './app/app.routes';
import { provideI18n } from './i18n/i18n';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authenticationInterceptor } from './app/auth/authentication.interceptor';
import { provideDatepicker } from './app/shared/datepicker.providers';
import { errorInterceptor } from './app/shared/error-interceptor.service';

bootstrapApplication(AppComponent, {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(ROUTES),
    provideI18n(),
    provideDatepicker(),
    provideHttpClient(withInterceptors([authenticationInterceptor, errorInterceptor]))
  ]
})
  /* eslint-disable-next-line no-console */
  .catch(err => console.error(err));
