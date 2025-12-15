import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import { TranslateDirective } from '@ngx-translate/core';
import { filter, map, switchMap, catchError, of } from 'rxjs';
import { NorthConnectorService } from '../../services/north-connector.service';
import { SouthConnectorService } from '../../services/south-connector.service';
import { HistoryQueryService } from '../../services/history-query.service';

interface BreadcrumbItem {
  label: string;
  route: string | null;
  translateKey?: boolean;
}

@Component({
  selector: 'oib-breadcrumb',
  imports: [RouterLink, TranslateDirective],
  templateUrl: './breadcrumb.component.html',
  styleUrl: './breadcrumb.component.scss'
})
export class BreadcrumbComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private northConnectorService = inject(NorthConnectorService);
  private southConnectorService = inject(SouthConnectorService);
  private historyQueryService = inject(HistoryQueryService);

  breadcrumbs: Array<BreadcrumbItem> = [];

  ngOnInit() {
    // Update breadcrumbs on navigation
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        map(() => this.getActivatedRoute()),
        switchMap(route => route.params),
        switchMap(params => {
          return this.buildBreadcrumbs(this.router.url, params);
        })
      )
      .subscribe(breadcrumbs => {
        this.breadcrumbs = breadcrumbs;
      });

    // Initial breadcrumb load
    this.getActivatedRoute()
      .params.pipe(
        switchMap(params => {
          return this.buildBreadcrumbs(this.router.url, params);
        })
      )
      .subscribe(breadcrumbs => {
        this.breadcrumbs = breadcrumbs;
      });
  }

  private getActivatedRoute(): ActivatedRoute {
    let route = this.route;
    while (route.firstChild) {
      route = route.firstChild;
    }
    return route;
  }

  private buildBreadcrumbs(url: string, params: any) {
    const breadcrumbs: Array<BreadcrumbItem> = [];

    // Don't show breadcrumbs on home page
    if (url === '/' || url === '') {
      return of([]);
    }

    // Handle north routes
    if (url.startsWith('/north')) {
      breadcrumbs.push({
        label: 'nav.north-list',
        route: '/north',
        translateKey: true
      });

      if (url.includes('/create')) {
        breadcrumbs.push({
          label: 'common.create',
          route: null,
          translateKey: true
        });
        return of(breadcrumbs);
      }

      if (params['northId']) {
        return this.northConnectorService.findById(params['northId']).pipe(
          switchMap(northConnector => {
            if (northConnector) {
              return this.northConnectorService.getNorthManifest(northConnector.type).pipe(
                map(manifest => {
                  const typeLabel = manifest?.id || northConnector.type;
                  const result: Array<BreadcrumbItem> = [
                    ...breadcrumbs,
                    {
                      label: `${northConnector.name} (${typeLabel})`,
                      route: `/north/${params['northId']}`
                    }
                  ];

                  if (url.includes('/cache')) {
                    result.push({
                      label: 'common.cache',
                      route: null,
                      translateKey: true
                    });
                  } else if (url.includes('/edit')) {
                    result.push({
                      label: 'common.edit',
                      route: null,
                      translateKey: true
                    });
                  }

                  return result;
                })
              );
            }
            return of(breadcrumbs);
          }),
          catchError(() => {
            // If we can't load the connector, just show the ID
            return of([
              ...breadcrumbs,
              {
                label: params['northId'],
                route: `/north/${params['northId']}`
              }
            ]);
          })
        );
      }
    }
    // Handle south routes
    else if (url.startsWith('/south')) {
      breadcrumbs.push({
        label: 'nav.south-list',
        route: '/south',
        translateKey: true
      });

      if (url.includes('/create')) {
        breadcrumbs.push({
          label: 'common.create',
          route: null,
          translateKey: true
        });
        return of(breadcrumbs);
      }

      if (params['southId']) {
        return this.southConnectorService.findById(params['southId']).pipe(
          map(southConnector => {
            if (southConnector) {
              const result: Array<BreadcrumbItem> = [
                ...breadcrumbs,
                {
                  label: `${southConnector.name} (${southConnector.type})`,
                  route: `/south/${params['southId']}`
                }
              ];

              if (url.includes('/edit')) {
                result.push({
                  label: 'common.edit',
                  route: null,
                  translateKey: true
                });
              }

              return result;
            }
            return breadcrumbs;
          }),
          catchError(() => {
            // If we can't load the connector, just show the ID
            return of([
              ...breadcrumbs,
              {
                label: params['southId'],
                route: `/south/${params['southId']}`
              }
            ]);
          })
        );
      }
    }
    // Handle history query routes
    else if (url.startsWith('/history-queries')) {
      breadcrumbs.push({
        label: 'nav.history-queries',
        route: '/history-queries',
        translateKey: true
      });

      if (url.includes('/create')) {
        breadcrumbs.push({
          label: 'common.create',
          route: null,
          translateKey: true
        });
        return of(breadcrumbs);
      }

      if (params['historyQueryId']) {
        return this.historyQueryService.findById(params['historyQueryId']).pipe(
          map(historyQuery => {
            if (historyQuery) {
              const result: Array<BreadcrumbItem> = [
                ...breadcrumbs,
                {
                  label: historyQuery.name,
                  route: `/history-queries/${params['historyQueryId']}`
                }
              ];

              if (url.includes('/cache')) {
                result.push({
                  label: 'common.cache',
                  route: null,
                  translateKey: true
                });
              } else if (url.includes('/edit')) {
                result.push({
                  label: 'common.edit',
                  route: null,
                  translateKey: true
                });
              }

              return result;
            }
            return breadcrumbs;
          }),
          catchError(() => {
            // If we can't load the history query, just show the ID
            return of([
              ...breadcrumbs,
              {
                label: params['historyQueryId'],
                route: `/history-queries/${params['historyQueryId']}`
              }
            ]);
          })
        );
      }
    }
    // Handle engine routes
    else if (url.startsWith('/engine')) {
      breadcrumbs.push({
        label: 'nav.engine',
        route: '/engine',
        translateKey: true
      });

      if (url.includes('/edit')) {
        breadcrumbs.push({
          label: 'engine.edit-title',
          route: null,
          translateKey: true
        });
      } else if (url.includes('/oianalytics')) {
        breadcrumbs.push({
          label: 'oia-module.title',
          route: null,
          translateKey: true
        });
      }
    }
    // Handle logs route
    else if (url.startsWith('/logs')) {
      breadcrumbs.push({
        label: 'nav.logs',
        route: '/logs',
        translateKey: true
      });
    }
    // Handle about route
    else if (url.startsWith('/about')) {
      breadcrumbs.push({
        label: 'nav.about',
        route: '/about',
        translateKey: true
      });
    }
    // Handle user settings route
    else if (url.startsWith('/user-settings')) {
      breadcrumbs.push({
        label: 'nav.account.settings',
        route: '/user-settings',
        translateKey: true
      });
    }

    return of(breadcrumbs);
  }
}
