import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslateService } from '@ngx-translate/core';
import { DateTime } from 'luxon';
import { ValidationErrorsComponent } from 'ngx-valdemort';
import { of, switchMap, tap } from 'rxjs';

import { NorthConnectorDTO } from '@oibus/shared/api/north-connector.model';
import { Instant } from '@oibus/shared/common/types';
import { CacheContentUpdateCommand, CacheSearchResult, DataFolderType } from '@oibus/shared/domain/engine.model';

import { NorthConnectorService } from '../../services/north-connector.service';
import { FileContentModalComponent } from '../../shared/cache-explore/cache-content/file-content-modal/file-content-modal.component';
import { CacheExploreComponent } from '../../shared/cache-explore/cache-explore.component';
import { DatetimepickerComponent } from '../../shared/datetimepicker/datetimepicker.component';
import { FormControlValidationDirective } from '../../shared/form/form-control-validation.directive';
import { ValErrorDelayDirective } from '../../shared/form/val-error-delay.directive';
import { ascendingDates } from '../../shared/form/validators';
import { ModalService } from '../../shared/modal.service';
import { NotificationService } from '../../shared/notification.service';
import { ObservableState, SaveButtonComponent } from '../../shared/save-button/save-button.component';

@Component({
  selector: 'oib-explore-north-cache',
  templateUrl: './explore-north-cache.component.html',
  styleUrl: './explore-north-cache.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    TranslateDirective,
    NgbTooltip,
    CacheExploreComponent,
    DatetimepickerComponent,
    FormControlValidationDirective,
    FormsModule,
    ReactiveFormsModule,
    ValErrorDelayDirective,
    ValidationErrorsComponent,
    SaveButtonComponent
  ]
})
export class ExploreNorthCacheComponent {
  private route = inject(ActivatedRoute);
  private northConnectorService = inject(NorthConnectorService);
  private notificationService = inject(NotificationService);
  private translateService = inject(TranslateService);
  private modalService = inject(ModalService);

  northConnector: NorthConnectorDTO | null = null;
  cacheContent: CacheSearchResult | null = null;
  state = new ObservableState();

  constructor() {
    this.route.paramMap
      .pipe(
        switchMap(params => {
          const paramNorthId = params.get('northId');
          if (paramNorthId) {
            return this.northConnectorService.findById(paramNorthId);
          }
          return of(null);
        })
      )
      .subscribe(northConnector => {
        this.northConnector = northConnector;
      });
  }

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

  submit() {
    if (!this.form.valid) {
      return;
    }

    this.northConnectorService
      .searchCacheContent(this.northConnector!.id, {
        start: this.form.value.start,
        end: this.form.value.end,
        nameContains: this.form.value.nameContains,
        maxNumberOfFilesReturned: this.form.value.maxNumberOfFilesReturned!
      })
      .pipe(this.state.pendingUntilFinalization())
      .subscribe(result => (this.cacheContent = result));
  }

  getFullTitle(): string {
    return this.translateService.instant('explore-cache.title', { name: this.northConnector!.name });
  }

  viewCacheContent(viewCommand: {
    type: 'north' | 'history';
    id: string;
    fileToRetrieve: {
      folder: DataFolderType;
      filename: string;
    };
  }) {
    this.northConnectorService
      .getCacheFileContent(this.northConnector!.id, viewCommand.fileToRetrieve.folder, viewCommand.fileToRetrieve.filename)
      .pipe(this.state.pendingUntilFinalization())
      .subscribe(result => {
        const modalRef = this.modalService.open(FileContentModalComponent, { size: 'xl', backdrop: 'static' });
        const component: FileContentModalComponent = modalRef.componentInstance;
        component.prepare(viewCommand.fileToRetrieve.filename, result);
      });
  }

  updateCacheContent(update: { type: 'north' | 'history'; id: string; updateCommand: CacheContentUpdateCommand }) {
    this.northConnectorService
      .updateCacheContent(this.northConnector!.id, update.updateCommand)
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
