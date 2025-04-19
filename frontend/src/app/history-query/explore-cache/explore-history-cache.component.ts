import { Component, inject, OnInit, viewChild } from '@angular/core';
import { TranslateDirective } from '@ngx-translate/core';
import { of, switchMap } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { BackNavigationDirective } from '../../shared/back-navigation.directives';
import { HistoryCacheContentComponent } from './cache-content/history-cache-content.component';
import { NorthSettings } from '../../../../../backend/shared/model/north-settings.model';
import { HistoryQueryService } from '../../services/history-query.service';
import { HistoryQueryDTO } from '../../../../../backend/shared/model/history-query.model';
import { SouthItemSettings, SouthSettings } from '../../../../../backend/shared/model/south-settings.model';

@Component({
  selector: 'oib-explore-history-cache',
  templateUrl: './explore-history-cache.component.html',
  styleUrl: './explore-history-cache.component.scss',
  imports: [TranslateDirective, BackNavigationDirective, HistoryCacheContentComponent]
})
export class ExploreHistoryCacheComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private historyQueryService = inject(HistoryQueryService);

  historyQuery: HistoryQueryDTO<SouthSettings, NorthSettings, SouthItemSettings> | null = null;
  readonly cacheFilesComponent = viewChild.required<HistoryCacheContentComponent>('cache');
  readonly errorFilesComponent = viewChild.required<HistoryCacheContentComponent>('error');
  readonly archiveFilesComponent = viewChild.required<HistoryCacheContentComponent>('archive');

  ngOnInit() {
    this.route.paramMap
      .pipe(
        switchMap(params => {
          const paramHistoryQueryId = params.get('historyQueryId');
          if (paramHistoryQueryId) {
            return this.historyQueryService.get(paramHistoryQueryId);
          }
          return of(null);
        })
      )
      .subscribe(historyQuery => {
        this.historyQuery = historyQuery;
      });
  }

  refreshCache() {
    this.cacheFilesComponent().refreshCacheFiles();
    this.errorFilesComponent().refreshCacheFiles();
    this.archiveFilesComponent().refreshCacheFiles();
  }
}
