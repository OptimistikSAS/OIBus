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
import { NorthDisplayComponent } from './north/north-display/north-display.component';
import { EditNorthComponent } from './north/edit-north/edit-north.component';
import { EditHistoryQueryComponent } from './history-query/edit-history-query/edit-history-query.component';
import { HistoryQueryListComponent } from './history-query/history-query-list.component';
import { HistoryQueryDisplayComponent } from './history-query/history-query-display/history-query-display.component';
import { LoginComponent } from './auth/login/login.component';
import { AuthenticationGuard } from './auth/authentication.guard';

export const ROUTES: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: '',
    canActivateChild: [AuthenticationGuard],
    children: [
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
        path: 'north/create',
        component: EditNorthComponent
      },
      {
        path: 'north/:northId/edit',
        component: EditNorthComponent
      },
      {
        path: 'north/:northId',
        component: NorthDisplayComponent
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
        path: 'engine/edit',
        component: EditEngineComponent
      },
      {
        path: 'history-queries',
        component: HistoryQueryListComponent
      },
      {
        path: 'history-queries/create',
        component: EditHistoryQueryComponent
      },
      {
        path: 'history-queries/:historyQueryId/edit',
        component: EditHistoryQueryComponent
      },
      {
        path: 'history-queries/:historyQueryId',
        component: HistoryQueryDisplayComponent
      },
      {
        path: 'logs',
        component: LogsComponent
      },
      {
        path: 'about',
        component: AboutComponent
      }
    ]
  }
];
