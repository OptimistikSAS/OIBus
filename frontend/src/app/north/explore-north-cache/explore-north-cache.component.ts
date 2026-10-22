import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

import { TranslateDirective } from '@ngx-translate/core';
import { DateTime } from 'luxon';
import { of, switchMap, tap } from 'rxjs';

import { Instant } from '@oibus/shared/common/types';
import { CacheContentUpdateCommand, CacheSearchResult, DataFolderType } from '@oibus/shared/domain/engine.model';

import { NorthConnectorService } from '../../services/north-connector.service';
import { FileContentModalComponent } from '../../shared/cache-explore/cache-content/file-content-modal/file-content-modal.component';
import { CacheExploreComponent } from '../../shared/cache-explore/cache-explore.component';
import { DatetimepickerComponent } from '../../shared/datetimepicker/datetimepicker.component';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../shared/form/form-validation-directives';
import { ascendingDates } from '../../shared/form/validators';
import { ModalService } from '../../shared/modal.service';
import { NotificationService } from '../../shared/notification.service';
import { OIBusNorthTypeEnumPipe } from '../../shared/oibus-north-type-enum.pipe';
import { ObservableState, SaveButtonComponent } from '../../shared/save-button/save-button.component';

@Component({
  selector: 'oib-explore-north-cache',
  templateUrl: './explore-north-cache.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslateDirective,
    ReactiveFormsModule,
    DatetimepickerComponent,
    OI_FORM_VALIDATION_DIRECTIVES,
    SaveButtonComponent,
    CacheExploreComponent,
    OIBusNorthTypeEnumPipe
  ]
})
export class ExploreNorthCacheComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly northConnectorService = inject(NorthConnectorService);
  private readonly notificationService = inject(NotificationService);
  private readonly modalService = inject(ModalService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly northConnector = toSignal(
    this.route.paramMap.pipe(
      switchMap(params => {
        const paramNorthId = params.get('northId');
        if (paramNorthId) {
          return this.northConnectorService.findById(paramNorthId);
        }
        return of(null);
      })
    ),
    { initialValue: null }
  );
  readonly cacheContent = signal<CacheSearchResult | null>(null);
  readonly state = new ObservableState();

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

    this.northConnectorService
      .searchCacheContent(this.northConnector()!.id, {
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
    this.northConnectorService
      .getCacheFileContent(this.northConnector()!.id, viewCommand.fileToRetrieve.folder, viewCommand.fileToRetrieve.filename)
      .pipe(this.state.pendingUntilFinalization())
      .subscribe(result => {
        const modalRef = this.modalService.open(FileContentModalComponent, { size: 'xl', backdrop: 'static' });
        const component: FileContentModalComponent = modalRef.componentInstance;
        component.prepare(viewCommand.fileToRetrieve.filename, result);
      });
  }

  updateCacheContent(update: { type: 'north' | 'history'; id: string; updateCommand: CacheContentUpdateCommand }) {
    this.northConnectorService
      .updateCacheContent(this.northConnector()!.id, update.updateCommand)
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
