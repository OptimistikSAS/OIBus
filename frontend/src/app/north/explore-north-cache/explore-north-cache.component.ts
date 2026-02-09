import { Component, inject, OnInit } from '@angular/core';
import { NorthConnectorService } from '../../services/north-connector.service';
import { NorthConnectorDTO } from '../../../../../backend/shared/model/north-connector.model';
import { of, switchMap, tap } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { TranslateDirective, TranslateService } from '@ngx-translate/core';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { DatetimepickerComponent } from '../../shared/datetimepicker/datetimepicker.component';
import { FormControlValidationDirective } from '../../shared/form/form-control-validation.directive';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ValErrorDelayDirective } from '../../shared/form/val-error-delay.directive';
import { ValidationErrorsComponent } from 'ngx-valdemort';
import { NotificationService } from '../../shared/notification.service';
import { CacheContentUpdateCommand, CacheSearchResult, DataFolderType } from '../../../../../backend/shared/model/engine.model';
import { ObservableState, SaveButtonComponent } from '../../shared/save-button/save-button.component';
import { DateTime } from 'luxon';
import { Instant } from '../../../../../backend/shared/model/types';
import { ascendingDates } from '../../shared/form/validators';
import { ModalService } from '../../shared/modal.service';
import { FileContentModalComponent } from '../../shared/cache-explore/cache-content/file-content-modal/file-content-modal.component';
import { CacheExploreComponent } from '../../shared/cache-explore/cache-explore.component';

@Component({
  selector: 'oib-explore-north-cache',
  templateUrl: './explore-north-cache.component.html',
  styleUrl: './explore-north-cache.component.scss',
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
export class ExploreNorthCacheComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private northConnectorService = inject(NorthConnectorService);
  private notificationService = inject(NotificationService);
  private translateService = inject(TranslateService);
  private modalService = inject(ModalService);

  northConnector: NorthConnectorDTO | null = null;
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
