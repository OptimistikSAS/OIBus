import { Component, inject, OnInit } from '@angular/core';
import { TranslateDirective, TranslateService } from '@ngx-translate/core';
import { of, switchMap, tap } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { HistoryQueryService } from '../../services/history-query.service';
import { HistoryQueryDTO } from '../../../../../backend/shared/model/history-query.model';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { DatetimepickerComponent } from '../../shared/datetimepicker/datetimepicker.component';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../shared/form/form-validation-directives';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DateTime } from 'luxon';
import { Instant } from '../../../../../backend/shared/model/types';
import { ascendingDates } from '../../shared/form/validators';
import { ObservableState, SaveButtonComponent } from '../../shared/save-button/save-button.component';
import { CacheContentUpdateCommand, CacheSearchResult, DataFolderType } from '../../../../../backend/shared/model/engine.model';
import { NotificationService } from '../../shared/notification.service';
import { FileContentModalComponent } from '../../shared/cache-explore/cache-content/file-content-modal/file-content-modal.component';
import { ModalService } from '../../shared/modal.service';
import { CacheExploreComponent } from '../../shared/cache-explore/cache-explore.component';

@Component({
  selector: 'oib-explore-history-cache',
  templateUrl: './explore-history-cache.component.html',
  styleUrl: './explore-history-cache.component.scss',
  imports: [
    TranslateDirective,
    ReactiveFormsModule,
    NgbTooltip,
    DatetimepickerComponent,
    OI_FORM_VALIDATION_DIRECTIVES,
    SaveButtonComponent,
    CacheExploreComponent
  ]
})
export class ExploreHistoryCacheComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private historyQueryService = inject(HistoryQueryService);
  private notificationService = inject(NotificationService);
  private translateService = inject(TranslateService);
  private modalService = inject(ModalService);

  historyQuery: HistoryQueryDTO | null = null;
  cacheContent: CacheSearchResult | null = null;
  state = new ObservableState();

  form = inject(NonNullableFormBuilder).group(
    {
      start: [DateTime.now().minus({ hour: 1 }).set({ second: 0, millisecond: 0 }).toUTC().toISO() as Instant, Validators.required],
      end: [DateTime.now().set({ second: 0, millisecond: 0 }).toUTC().toISO() as Instant, Validators.required],
      nameContains: [''],
      maxNumberOfFilesReturned: [1000 as number, [Validators.required, Validators.min(0)]]
    },
    {
      validators: [ascendingDates]
    }
  );

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

  submit() {
    if (!this.form.valid) {
      return;
    }

    this.historyQueryService
      .searchCacheContent(this.historyQuery!.id, {
        start: this.form.value.start,
        end: this.form.value.end,
        nameContains: this.form.value.nameContains,
        maxNumberOfFilesReturned: this.form.value.maxNumberOfFilesReturned!
      })
      .pipe(this.state.pendingUntilFinalization())
      .subscribe(result => (this.cacheContent = result));
  }

  getFullTitle(): string {
    return this.translateService.instant('explore-cache.title', { name: this.historyQuery!.name });
  }

  viewCacheContent(viewCommand: {
    type: 'north' | 'history';
    id: string;
    fileToRetrieve: {
      folder: DataFolderType;
      filename: string;
    };
  }) {
    this.historyQueryService
      .getCacheFileContent(this.historyQuery!.id, viewCommand.fileToRetrieve.folder, viewCommand.fileToRetrieve.filename)
      .pipe(this.state.pendingUntilFinalization())
      .subscribe(result => {
        const modalRef = this.modalService.open(FileContentModalComponent, { size: 'xl', backdrop: 'static' });
        const component: FileContentModalComponent = modalRef.componentInstance;
        component.prepare(viewCommand.fileToRetrieve.filename, result);
      });
  }

  updateCacheContent(update: { type: 'north' | 'history'; id: string; updateCommand: CacheContentUpdateCommand }) {
    this.historyQueryService
      .updateCacheContent(this.historyQuery!.id, update.updateCommand)
      .pipe(
        this.state.pendingUntilFinalization(),
        tap(() => this.notificationService.success('explore-cache.cache-updated'))
      )
      .subscribe(() => {
        // Reload cache content
        this.submit();
      });
  }
}
