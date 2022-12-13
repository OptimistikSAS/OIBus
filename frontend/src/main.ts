import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app/app.component';
import { ROUTES } from './app/app.routes';
import { provideI18n } from './i18n/i18n';

bootstrapApplication(AppComponent, {
  providers: [provideRouter(ROUTES), provideI18n()]
})
  /* eslint-disable-next-line no-console */
  .catch(err => console.error(err));
