import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslateService } from '@ngx-translate/core';
import { DateTime } from 'luxon';
import { of, switchMap, tap } from 'rxjs';

import { Instant } from '@oibus/shared/common/types';
import { CacheContentUpdateCommand, CacheSearchResult, DataFolderType } from '@oibus/shared/domain/engine.model';

import { HistoryQueryService } from '../../services/history-query.service';
import { FileContentModalComponent } from '../../shared/cache-explore/cache-content/file-content-modal/file-content-modal.component';
import { CacheExploreComponent } from '../../shared/cache-explore/cache-explore.component';
import { DatetimepickerComponent } from '../../shared/datetimepicker/datetimepicker.component';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../shared/form/form-validation-directives';
import { ascendingDates } from '../../shared/form/validators';
import { ModalService } from '../../shared/modal.service';
import { NotificationService } from '../../shared/notification.service';
import { ObservableState, SaveButtonComponent } from '../../shared/save-button/save-button.component';

@Component({
  selector: 'oib-explore-history-cache',
  templateUrl: './explore-history-cache.component.html',
  styleUrl: './explore-history-cache.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
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
export class ExploreHistoryCacheComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly historyQueryService = inject(HistoryQueryService);
  private readonly notificationService = inject(NotificationService);
  private readonly translateService = inject(TranslateService);
  private readonly modalService = inject(ModalService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly historyQuery = toSignal(
    this.route.paramMap.pipe(
      switchMap(params => {
        const paramHistoryQueryId = params.get('historyQueryId');
        if (paramHistoryQueryId) {
          return this.historyQueryService.findById(paramHistoryQueryId);
        }
        return of(null);
      })
    ),
    { initialValue: null }
  );
  readonly cacheContent = signal<CacheSearchResult | null>(null);
  readonly state = new ObservableState();
  readonly fullTitle = computed(() => this.translateService.instant('explore-cache.title', { name: this.historyQuery()?.name }));

  readonly form = this.fb.group(
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

  submit() {
    if (!this.form.valid) {
      return;
    }

    this.historyQueryService
      .searchCacheContent(this.historyQuery()!.id, {
        start: this.form.value.start,
        end: this.form.value.end,
        nameContains: this.form.value.nameContains,
        maxNumberOfFilesReturned: this.form.value.maxNumberOfFilesReturned!
      })
      .pipe(this.state.pendingUntilFinalization())
      .subscribe(result => this.cacheContent.set(result));
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
      .getCacheFileContent(this.historyQuery()!.id, viewCommand.fileToRetrieve.folder, viewCommand.fileToRetrieve.filename)
      .pipe(this.state.pendingUntilFinalization())
      .subscribe(result => {
        const modalRef = this.modalService.open(FileContentModalComponent, { size: 'xl', backdrop: 'static' });
        const component: FileContentModalComponent = modalRef.componentInstance;
        component.prepare(viewCommand.fileToRetrieve.filename, result);
      });
  }

  updateCacheContent(update: { type: 'north' | 'history'; id: string; updateCommand: CacheContentUpdateCommand }) {
    this.historyQueryService
      .updateCacheContent(this.historyQuery()!.id, update.updateCommand)
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
