import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app/app.component';
import { ROUTES } from './app/app.routes';

bootstrapApplication(AppComponent, { providers: [provideRouter(ROUTES)] })
  /* eslint-disable-next-line no-console */
  .catch(err => console.error(err));
