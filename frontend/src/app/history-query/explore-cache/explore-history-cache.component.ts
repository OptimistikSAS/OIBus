import { Component, inject, OnInit, viewChild } from '@angular/core';
import { TranslateDirective, TranslateService } from '@ngx-translate/core';
import { of, switchMap } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { HistoryCacheContentComponent } from './cache-content/history-cache-content.component';
import { HistoryQueryService } from '../../services/history-query.service';
import { HistoryQueryDTO } from '../../../../../backend/shared/model/history-query.model';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'oib-explore-history-cache',
  templateUrl: './explore-history-cache.component.html',
  styleUrl: './explore-history-cache.component.scss',
  imports: [TranslateDirective, HistoryCacheContentComponent, NgbTooltip]
})
export class ExploreHistoryCacheComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private historyQueryService = inject(HistoryQueryService);
  private translateService = inject(TranslateService);

  historyQuery: HistoryQueryDTO | null = null;
  readonly cacheFilesComponent = viewChild.required<HistoryCacheContentComponent>('cache');
  readonly errorFilesComponent = viewChild.required<HistoryCacheContentComponent>('error');
  readonly archiveFilesComponent = viewChild.required<HistoryCacheContentComponent>('archive');

  ngOnInit() {
    this.route.paramMap
      .pipe(
        switchMap(params => {
          const paramHistoryQueryId = params.get('historyQueryId');
          if (paramHistoryQueryId) {
            return this.historyQueryService.findById(paramHistoryQueryId);
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

  getFullTitle(): string {
    if (!this.historyQuery) {
      return '';
    }
    return this.translateService.instant('north.cache.title', { name: this.historyQuery.name });
  }
}
