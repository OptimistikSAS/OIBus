import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { LogsComponent } from './logs/logs.component';
import { AboutComponent } from './about/about.component';

export const ROUTES: Routes = [
  {
    path: '',
    component: HomeComponent
  },
  {
    path: 'logs',
    component: LogsComponent
  },
  {
    path: 'about',
    component: AboutComponent
  }
];
