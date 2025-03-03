import { Component, OnInit, inject, viewChild } from '@angular/core';
import { TranslateDirective } from '@ngx-translate/core';
import { formDirectives } from '../../shared/form-directives';
import { NorthConnectorService } from '../../services/north-connector.service';
import { NorthConnectorDTO } from '../../../../../backend/shared/model/north-connector.model';
import { of, switchMap } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { BackNavigationDirective } from '../../shared/back-navigation.directives';
import { CacheContentComponent } from './cache-content/cache-content.component';
import { NorthSettings } from '../../../../../backend/shared/model/north-settings.model';

@Component({
  selector: 'oib-explore-cache',
  templateUrl: './explore-cache.component.html',
  styleUrl: './explore-cache.component.scss',
  imports: [...formDirectives, TranslateDirective, BackNavigationDirective, CacheContentComponent]
})
export class ExploreCacheComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private northConnectorService = inject(NorthConnectorService);

  northConnector: NorthConnectorDTO<NorthSettings> | null = null;
  readonly cacheFilesComponent = viewChild.required<CacheContentComponent>('cache');
  readonly errorFilesComponent = viewChild.required<CacheContentComponent>('error');
  readonly archiveFilesComponent = viewChild.required<CacheContentComponent>('archive');

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
    this.cacheFilesComponent().refreshCacheFiles();
    this.errorFilesComponent().refreshCacheFiles();
    this.archiveFilesComponent().refreshCacheFiles();
  }
}
