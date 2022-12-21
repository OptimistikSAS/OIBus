import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app/app.component';
import { ROUTES } from './app/app.routes';
import { provideI18n } from './i18n/i18n';
import { importProvidersFrom } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';

bootstrapApplication(AppComponent, {
  providers: [provideRouter(ROUTES), provideI18n(), importProvidersFrom(HttpClientModule)]
})
  /* eslint-disable-next-line no-console */
  .catch(err => console.error(err));
