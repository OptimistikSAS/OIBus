import { Component, inject, OnInit, viewChild } from '@angular/core';
import { NorthConnectorService } from '../../services/north-connector.service';
import { NorthConnectorDTO } from '../../../../../backend/shared/model/north-connector.model';
import { of, switchMap } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { NorthSettings } from '../../../../../backend/shared/model/north-settings.model';
import { TranslateDirective } from '@ngx-translate/core';
import { NorthCacheContentComponent } from './north-cache-content/north-cache-content.component';

@Component({
  selector: 'oib-explore-north-cache',
  templateUrl: './explore-north-cache.component.html',
  styleUrl: './explore-north-cache.component.scss',
  imports: [TranslateDirective, NorthCacheContentComponent]
})
export class ExploreNorthCacheComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private northConnectorService = inject(NorthConnectorService);

  northConnector: NorthConnectorDTO<NorthSettings> | null = null;
  readonly cacheFilesComponent = viewChild.required<NorthCacheContentComponent>('cache');
  readonly errorFilesComponent = viewChild.required<NorthCacheContentComponent>('error');
  readonly archiveFilesComponent = viewChild.required<NorthCacheContentComponent>('archive');

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
