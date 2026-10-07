import { Routes } from '@angular/router';

import { authenticationGuard } from './auth/authentication.guard';
import { UnsavedChangesGuard } from './shared/unsaved-changes.guard';

export const ROUTES: Routes = [
  { path: 'login', loadComponent: () => import('./auth/login/login.component').then(m => m.LoginComponent) },
  {
    path: '',
    canActivateChild: [authenticationGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./home/home.component').then(m => m.HomeComponent)
      },
      {
        path: 'engine',
        loadComponent: () => import('./engine/engine-detail.component').then(m => m.EngineDetailComponent)
      },
      {
        path: 'engine/oianalytics',
        loadComponent: () => import('./engine/oia-registration/oia-registration.component').then(m => m.OIARegistrationComponent)
      },
      {
        path: 'north',
        loadComponent: () => import('./north/north-list.component').then(m => m.NorthListComponent)
      },
      {
        path: 'north/create',
        loadComponent: () => import('./north/edit-north/edit-north.component').then(m => m.EditNorthComponent),
        canDeactivate: [UnsavedChangesGuard]
      },
      {
        path: 'north/:northId/edit',
        loadComponent: () => import('./north/edit-north/edit-north.component').then(m => m.EditNorthComponent),
        canDeactivate: [UnsavedChangesGuard]
      },
      {
        path: 'north/:northId/cache',
        loadComponent: () => import('./north/explore-north-cache/explore-north-cache.component').then(m => m.ExploreNorthCacheComponent)
      },
      {
        path: 'north/:northId',
        loadComponent: () => import('./north/north-detail/north-detail.component').then(m => m.NorthDetailComponent)
      },
      {
        path: 'south',
        loadComponent: () => import('./south/south-list.component').then(m => m.SouthListComponent)
      },
      {
        path: 'south/create',
        loadComponent: () => import('./south/edit-south/edit-south.component').then(m => m.EditSouthComponent),
        canDeactivate: [UnsavedChangesGuard]
      },
      {
        path: 'south/:southId/edit',
        loadComponent: () => import('./south/edit-south/edit-south.component').then(m => m.EditSouthComponent),
        canDeactivate: [UnsavedChangesGuard]
      },
      {
        path: 'south/:southId/workflows/:workflowId/history',
        loadComponent: () =>
          import('./south/south-workflows/workflow-run-history/workflow-run-history.component').then(m => m.WorkflowRunHistoryComponent)
      },
      {
        path: 'south/:southId',
        loadComponent: () => import('./south/south-detail/south-detail.component').then(m => m.SouthDetailComponent)
      },
      {
        path: 'history-queries',
        loadComponent: () => import('./history-query/history-query-list.component').then(m => m.HistoryQueryListComponent)
      },
      {
        path: 'history-queries/create',
        loadComponent: () =>
          import('./history-query/edit-history-query/edit-history-query.component').then(m => m.EditHistoryQueryComponent),
        canDeactivate: [UnsavedChangesGuard]
      },
      {
        path: 'history-queries/:historyQueryId/edit',
        loadComponent: () =>
          import('./history-query/edit-history-query/edit-history-query.component').then(m => m.EditHistoryQueryComponent),
        canDeactivate: [UnsavedChangesGuard]
      },
      {
        path: 'history-queries/:historyQueryId/cache',
        loadComponent: () =>
          import('./history-query/explore-history-cache/explore-history-cache.component').then(m => m.ExploreHistoryCacheComponent)
      },
      {
        path: 'history-queries/:historyQueryId',
        loadComponent: () =>
          import('./history-query/history-query-detail/history-query-detail.component').then(m => m.HistoryQueryDetailComponent)
      },
      {
        path: 'logs',
        loadComponent: () => import('./logs/logs.component').then(m => m.LogsComponent)
      },
      {
        path: 'audit',
        loadComponent: () => import('./audit/audit-list.component').then(m => m.AuditListComponent)
      },
      {
        path: 'about',
        loadComponent: () => import('./about/about.component').then(m => m.AboutComponent)
      },
      {
        path: 'user-settings',
        loadComponent: () =>
          import('./user-settings/edit-user-settings/edit-user-settings.component').then(m => m.EditUserSettingsComponent),
        canDeactivate: [UnsavedChangesGuard]
      }
    ]
  }
];
