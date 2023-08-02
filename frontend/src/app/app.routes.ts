import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { LogsComponent } from './logs/logs.component';
import { AboutComponent } from './about/about.component';
import { EditEngineComponent } from './engine/edit-engine/edit-engine.component';
import { SouthListComponent } from './south/south-list.component';
import { NorthListComponent } from './north/north-list.component';
import { EngineDetailComponent } from './engine/engine-detail.component';
import { SouthDetailComponent } from './south/south-detail/south-detail.component';
import { EditSouthComponent } from './south/edit-south/edit-south.component';
import { NorthDetailComponent } from './north/north-detail/north-detail.component';
import { EditNorthComponent } from './north/edit-north/edit-north.component';
import { EditHistoryQueryComponent } from './history-query/edit-history-query/edit-history-query.component';
import { HistoryQueryListComponent } from './history-query/history-query-list.component';
import { HistoryQueryDetailComponent } from './history-query/history-query-detail/history-query-detail.component';
import { LoginComponent } from './auth/login/login.component';
import { authenticationGuard } from './auth/authentication.guard';
import { ExploreCacheComponent } from './north/explore-cache/explore-cache.component';
import { EditUserSettingsComponent } from './user-settings/edit-user-settings/edit-user-settings.component';

export const ROUTES: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: '',
    canActivateChild: [authenticationGuard],
    children: [
      {
        path: '',
        component: HomeComponent
      },
      {
        path: 'engine',
        component: EngineDetailComponent
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
        path: 'north/:northId/cache',
        component: ExploreCacheComponent
      },
      {
        path: 'north/:northId',
        component: NorthDetailComponent
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
        component: SouthDetailComponent
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
        component: HistoryQueryDetailComponent
      },
      {
        path: 'logs',
        component: LogsComponent
      },
      {
        path: 'about',
        component: AboutComponent
      },
      {
        path: 'user-settings',
        component: EditUserSettingsComponent
      }
    ]
  }
];
