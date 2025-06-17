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
import { ExploreNorthCacheComponent } from './north/explore-cache/explore-north-cache.component';
import { EditUserSettingsComponent } from './user-settings/edit-user-settings/edit-user-settings.component';
import { OiaModuleComponent } from './engine/oia-module/oia-module.component';
import { ExploreHistoryCacheComponent } from './history-query/explore-cache/explore-history-cache.component';
import { UnsavedChangesGuard } from './shared/unsaved-changes.guard';

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
        path: 'engine/oianalytics',
        component: OiaModuleComponent
      },
      {
        path: 'engine/edit',
        component: EditEngineComponent,
        canDeactivate: [UnsavedChangesGuard]
      },
      {
        path: 'north',
        component: NorthListComponent
      },
      {
        path: 'north/create',
        component: EditNorthComponent,
        canDeactivate: [UnsavedChangesGuard]
      },
      {
        path: 'north/:northId/edit',
        component: EditNorthComponent,
        canDeactivate: [UnsavedChangesGuard]
      },
      {
        path: 'north/:northId/cache',
        component: ExploreNorthCacheComponent
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
        component: EditSouthComponent,
        canDeactivate: [UnsavedChangesGuard]
      },
      {
        path: 'south/:southId/edit',
        component: EditSouthComponent,
        canDeactivate: [UnsavedChangesGuard]
      },
      {
        path: 'south/:southId',
        component: SouthDetailComponent
      },
      {
        path: 'engine/edit',
        component: EditEngineComponent,
        canDeactivate: [UnsavedChangesGuard]
      },
      {
        path: 'history-queries',
        component: HistoryQueryListComponent
      },
      {
        path: 'history-queries/create',
        component: EditHistoryQueryComponent,
        canDeactivate: [UnsavedChangesGuard]
      },
      {
        path: 'history-queries/:historyQueryId/edit',
        component: EditHistoryQueryComponent,
        canDeactivate: [UnsavedChangesGuard]
      },
      {
        path: 'history-queries/:historyQueryId/cache',
        component: ExploreHistoryCacheComponent
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
        component: EditUserSettingsComponent,
        canDeactivate: [UnsavedChangesGuard]
      }
    ]
  }
];
