import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { LogsComponent } from './logs/logs.component';
import { AboutComponent } from './about/about.component';
import { EditEngineComponent } from './engine/edit-engine/edit-engine.component';
import { SouthListComponent } from './south/south-list.component';
import { NorthListComponent } from './north/north-list.component';
import { EngineComponent } from './engine/engine.component';
import { SouthDisplayComponent } from './south/south-display/south-display.component';
import { EditSouthComponent } from './south/edit-south/edit-south.component';

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
    path: 'engine/edit',
    component: EditEngineComponent
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
    path: 'south/create',
    component: EditSouthComponent
  },
  {
    path: 'south/:southId/edit',
    component: EditSouthComponent
  },
  {
    path: 'south/:southId',
    component: SouthDisplayComponent
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
