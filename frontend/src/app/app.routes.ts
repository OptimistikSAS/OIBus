import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { LogsComponent } from './logs/logs.component';
import { AboutComponent } from './about/about.component';
import { EngineComponent } from './engine/engine.component';
import { SouthListComponent } from './south-list/south-list.component';
import { NorthListComponent } from './north-list/north-list.component';

export const ROUTES: Routes = [
  {
    path: '',
    component: HomeComponent
  },
  {
    path: 'engine',
    component: EngineComponent
  },
  {
    path: 'north',
    component: NorthListComponent
  },
  {
    path: 'south',
    component: SouthListComponent
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
