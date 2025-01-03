import { Component, OnInit, inject, viewChild } from '@angular/core';
import { TranslateDirective } from '@ngx-translate/core';
import { formDirectives } from '../../shared/form-directives';
import { NorthConnectorService } from '../../services/north-connector.service';
import { NorthConnectorDTO } from '../../../../../backend/shared/model/north-connector.model';
import { of, switchMap } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { BackNavigationDirective } from '../../shared/back-navigation.directives';
import { ErrorFilesComponent } from './error-files/error-files.component';
import { ArchiveFilesComponent } from './archive-files/archive-files.component';
import { CacheFilesComponent } from './cache-files/cache-files.component';
import { CacheValuesComponent } from './cache-values/cache-values.component';
import { ErrorValuesComponent } from './error-values/error-values.component';
import { NorthSettings } from '../../../../../backend/shared/model/north-settings.model';

@Component({
  selector: 'oib-explore-cache',
  templateUrl: './explore-cache.component.html',
  styleUrl: './explore-cache.component.scss',
  imports: [
    ...formDirectives,
    TranslateDirective,
    BackNavigationDirective,
    ErrorFilesComponent,
    ArchiveFilesComponent,
    CacheFilesComponent,
    CacheValuesComponent,
    ErrorValuesComponent
  ]
})
export class ExploreCacheComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private northConnectorService = inject(NorthConnectorService);

  northConnector: NorthConnectorDTO<NorthSettings> | null = null;
  readonly archiveFilesComponent = viewChild.required(ArchiveFilesComponent);
  readonly errorFilesComponent = viewChild.required(ErrorFilesComponent);
  readonly cacheFilesComponent = viewChild.required(CacheFilesComponent);
  readonly cacheValuesComponent = viewChild.required(CacheValuesComponent);
  readonly errorValuesComponent = viewChild.required(ErrorValuesComponent);

  ngOnInit() {
    this.route.paramMap
      .pipe(
        switchMap(params => {
          const paramNorthId = params.get('northId');
          if (paramNorthId) {
            return this.northConnectorService.get(paramNorthId);
          }
          return of(null);
        })
      )
      .subscribe(northConnector => {
        this.northConnector = northConnector;
      });
  }

  refreshCache() {
    this.errorFilesComponent().refreshErrorFiles();
    this.archiveFilesComponent().refreshArchiveFiles();
    this.cacheFilesComponent().refreshCacheFiles();
    this.cacheValuesComponent().refreshCacheValues();
    this.errorValuesComponent().refreshErrorValues();
  }
}
