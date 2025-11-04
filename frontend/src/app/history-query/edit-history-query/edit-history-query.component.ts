import { Component, inject, OnInit } from '@angular/core';
import { TranslateDirective } from '@ngx-translate/core';
import { ObservableState, SaveButtonComponent } from '../../shared/save-button/save-button.component';
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { NotificationService } from '../../shared/notification.service';
import { ActivatedRoute, Router } from '@angular/router';
import { combineLatest, Observable, of, switchMap, tap } from 'rxjs';
import { ScanModeDTO } from '../../../../../backend/shared/model/scan-mode.model';
import { ScanModeService } from '../../services/scan-mode.service';
import {
  NorthConnectorCommandDTO,
  NorthConnectorDTO,
  NorthConnectorManifest,
  OIBusNorthType
} from '../../../../../backend/shared/model/north-connector.model';
import { NorthConnectorService } from '../../services/north-connector.service';
import {
  HistoryQueryCommandDTO,
  HistoryQueryDTO,
  HistoryQueryItemCommandDTO,
  HistoryQueryLightDTO
} from '../../../../../backend/shared/model/history-query.model';
import {
  OIBusSouthType,
  SouthConnectorCommandDTO,
  SouthConnectorDTO,
  SouthConnectorManifest
} from '../../../../../backend/shared/model/south-connector.model';
import { SouthConnectorService } from '../../services/south-connector.service';
import { HistoryQueryService } from '../../services/history-query.service';
import { BackNavigationDirective } from '../../shared/back-navigation.directives';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { HistoryQueryItemsComponent } from '../history-query-items/history-query-items.component';
import { DateTime } from 'luxon';
import { ModalService } from '../../shared/modal.service';
import { TestConnectionResultModalComponent } from '../../shared/test-connection-result-modal/test-connection-result-modal.component';
import { OibHelpComponent } from '../../shared/oib-help/oib-help.component';
import { ResetCacheHistoryQueryModalComponent } from '../reset-cache-history-query-modal/reset-cache-history-query-modal.component';
import { OIBusNorthTypeEnumPipe } from '../../shared/oibus-north-type-enum.pipe';
import { OIBusSouthTypeEnumPipe } from '../../shared/oibus-south-type-enum.pipe';
import { TransformerDTO, TransformerDTOWithOptions } from '../../../../../backend/shared/model/transformer.model';
import { TransformerService } from '../../services/transformer.service';
import { CertificateService } from '../../services/certificate.service';
import { CertificateDTO } from '../../../../../backend/shared/model/certificate.model';
import { addAttributeToForm, addEnablingConditions } from '../../shared/form/dynamic-form.builder';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../shared/form/form-validation-directives';
import { OIBusScanModeFormControlComponent } from '../../shared/form/oibus-scan-mode-form-control/oibus-scan-mode-form-control.component';
import { OIBusScanModeAttribute } from '../../../../../backend/shared/model/form.model';
import { OIBusObjectFormControlComponent } from '../../shared/form/oibus-object-form-control/oibus-object-form-control.component';
import { CanComponentDeactivate } from '../../shared/unsaved-changes.guard';
import { UnsavedChangesConfirmationService } from '../../shared/unsaved-changes-confirmation.service';
import { DateRange, DateRangeSelectorComponent } from '../../shared/date-range-selector/date-range-selector.component';
import { HistoryQueryTransformersComponent } from '../history-query-transformers/history-query-transformers.component';
import { AbstractControl, ValidationErrors } from '@angular/forms';

@Component({
  selector: 'oib-edit-history-query',
  imports: [
    TranslateDirective,
    SaveButtonComponent,
    DateRangeSelectorComponent,
    BackNavigationDirective,
    BoxComponent,
    BoxTitleDirective,
    HistoryQueryItemsComponent,
    OibHelpComponent,
    OIBusNorthTypeEnumPipe,
    OIBusSouthTypeEnumPipe,
    ReactiveFormsModule,
    OI_FORM_VALIDATION_DIRECTIVES,
    OIBusScanModeFormControlComponent,
    OIBusObjectFormControlComponent,
    HistoryQueryTransformersComponent
  ],
  templateUrl: './edit-history-query.component.html',
  styleUrl: './edit-history-query.component.scss'
})
export class EditHistoryQueryComponent implements OnInit, CanComponentDeactivate {
  private historyQueryService = inject(HistoryQueryService);
  private northConnectorService = inject(NorthConnectorService);
  private southConnectorService = inject(SouthConnectorService);
  private fb = inject(NonNullableFormBuilder);
  private notificationService = inject(NotificationService);
  private scanModeService = inject(ScanModeService);
  private transformerService = inject(TransformerService);
  private certificateService = inject(CertificateService);
  private modalService = inject(ModalService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private unsavedChangesConfirmation = inject(UnsavedChangesConfirmationService);

  mode: 'create' | 'edit' = 'create';
  historyId!: string;
  historyQuery: HistoryQueryDTO | null = null;
  state = new ObservableState();
  scanModes: Array<ScanModeDTO> = [];
  transformers: Array<TransformerDTO> = [];
  certificates: Array<CertificateDTO> = [];
  northManifest: NorthConnectorManifest | null = null;
  southManifest: SouthConnectorManifest | null = null;
  southType = '';
  fromSouthId = '';
  northType = '';
  fromNorthId = '';
  duplicateId = '';
  saveItemChangesDirectly!: boolean;
  existingHistoryQueries: Array<HistoryQueryLightDTO> = [];

  form: FormGroup<{
    name: FormControl<string>;
    description: FormControl<string>;
    dateRange: FormControl<DateRange>;
    caching: FormGroup<{
      trigger: FormGroup<{
        scanMode: FormControl<ScanModeDTO | null>;
        numberOfElements: FormControl<number>;
        numberOfFiles: FormControl<number>;
      }>;
      throttling: FormGroup<{
        runMinDelay: FormControl<number>;
        maxSize: FormControl<number>;
        maxNumberOfElements: FormControl<number>;
      }>;
      error: FormGroup<{
        retryInterval: FormControl<number>;
        retryCount: FormControl<number>;
        retentionDuration: FormControl<number>;
      }>;
      archive: FormGroup<{
        enabled: FormControl<boolean>;
        retentionDuration: FormControl<number>;
      }>;
    }>;
    northSettings: FormGroup;
    southSettings: FormGroup;
  }> | null = null;

  inMemoryTransformersWithOptions: Array<TransformerDTOWithOptions> = [];
  inMemoryItems: Array<HistoryQueryItemCommandDTO> = [];
  scanModeAttribute: OIBusScanModeAttribute = {
    type: 'scan-mode',
    key: 'scanMode',
    translationKey: 'north.caching.trigger.schedule',
    acceptableType: 'POLL',
    validators: [{ type: 'REQUIRED', arguments: [] }],
    displayProperties: {
      row: 0,
      columns: 4,
      displayInViewMode: true
    }
  };

  ngOnInit() {
    combineLatest([
      this.scanModeService.list(),
      this.certificateService.list(),
      this.transformerService.list(),
      this.historyQueryService.list(),
      this.route.paramMap,
      this.route.queryParamMap
    ])
      .pipe(
        switchMap(([scanModes, certificates, transformers, historyQueries, params, queryParams]) => {
          this.scanModes = scanModes.filter(scanMode => scanMode.id !== 'subscription');
          this.certificates = certificates;
          this.transformers = transformers;
          this.existingHistoryQueries = historyQueries;

          const paramHistoryQueryId = params.get('historyQueryId');
          const paramDuplicateHistoryQueryId = queryParams.get('duplicate');
          const southId = queryParams.get('southId');
          const northId = queryParams.get('northId') || '';

          let historyQueryObs: Observable<null | HistoryQueryDTO> = of(null);
          let northObs: Observable<null | NorthConnectorDTO> = of(null);
          let southObs: Observable<null | SouthConnectorDTO> = of(null);

          // if there is a History ID, we are editing a History Query
          if (paramHistoryQueryId) {
            this.mode = 'edit';
            this.historyId = paramHistoryQueryId;
            historyQueryObs = this.historyQueryService.findById(paramHistoryQueryId);
          } else {
            this.mode = 'create';
            this.historyId = 'create';
            if (paramDuplicateHistoryQueryId) {
              this.duplicateId = paramDuplicateHistoryQueryId;
              historyQueryObs = this.historyQueryService.findById(paramDuplicateHistoryQueryId);
            } else {
              if (southId) {
                southObs = this.southConnectorService.findById(southId);
              } else {
                this.southType = queryParams.get('southType') || '';
              }
              if (northId) {
                northObs = this.northConnectorService.findById(northId);
              } else {
                this.northType = queryParams.get('northType') || '';
              }
            }
          }
          return combineLatest([historyQueryObs, northObs, southObs]);
        }),
        switchMap(([historyQuery, northConnector, southConnector]) => {
          this.historyQuery = historyQuery;

          // creating/duplicating a history query
          if (historyQuery) {
            this.southType = historyQuery.southType;
            this.northType = historyQuery.northType;

            // When changes are not saved directly, items come from memory
            if (!this.saveItemChangesDirectly) {
              this.inMemoryItems = historyQuery.items.map(item => ({
                ...item,
                // In edit mode, keep existing ids; in duplicate/create, ids are reset upstream
                id: this.mode === 'edit' ? item.id : null
              }));
            }
          }
          // creating new from an existing south and north connector
          else {
            if (southConnector) {
              this.southType = southConnector.type;
              this.fromSouthId = southConnector.id;
            }
            if (northConnector) {
              this.northType = northConnector.type;
              this.fromNorthId = northConnector.id;
            }
          }
          return combineLatest([
            this.northConnectorService.getNorthManifest(this.northType),
            this.southConnectorService.getSouthManifest(this.southType),
            of(southConnector),
            of(northConnector)
          ]);
        })
      )
      .subscribe(([northManifest, southManifest, southConnector, northConnector]) => {
        if (!northManifest || !southManifest) {
          return;
        }
        this.northManifest = northManifest;
        this.southManifest = southManifest;
        this.buildForm(northConnector, southConnector);
      });
  }

  private checkUniqueness(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = (control.value ?? '').toString().trim().toLowerCase();
      if (!value) {
        return null;
      }

      const isDuplicate = this.existingHistoryQueries.some(historyQuery => {
        if (this.historyQuery && historyQuery.id === this.historyQuery.id) {
          return false;
        }
        return historyQuery.name.trim().toLowerCase() === value;
      });

      return isDuplicate ? { mustBeUnique: true } : null;
    };
  }

  buildForm(northConnector: NorthConnectorDTO | null, southConnector: SouthConnectorDTO | null) {
    this.form = this.fb.group({
      name: this.fb.control('', {
        validators: [Validators.required, this.checkUniqueness()]
      }),
      description: '',
      dateRange: [
        {
          startTime: DateTime.now().minus({ days: 1 }).toUTC().toISO()!,
          endTime: DateTime.now().toUTC().toISO()!
        } as DateRange,
        Validators.required
      ],
      caching: this.fb.group({
        trigger: this.fb.group({
          scanMode: this.fb.control<ScanModeDTO | null>(null, Validators.required),
          numberOfElements: [1_000, Validators.required],
          numberOfFiles: [1, Validators.required]
        }),
        throttling: this.fb.group({
          runMinDelay: [200, Validators.required],
          maxSize: [0, Validators.required],
          maxNumberOfElements: [10_000, Validators.required]
        }),
        error: this.fb.group({
          retryInterval: [5_000, Validators.required],
          retryCount: [3, Validators.required],
          retentionDuration: [0, Validators.required]
        }),
        archive: this.fb.group({
          enabled: [false, Validators.required],
          retentionDuration: [72, Validators.required]
        })
      }),
      northSettings: this.fb.group({}),
      southSettings: this.fb.group({})
    });
    for (const attribute of this.northManifest!.settings.attributes) {
      addAttributeToForm(this.fb, this.form.controls.northSettings, attribute);
    }
    addEnablingConditions(this.form.controls.northSettings, this.northManifest!.settings.enablingConditions);

    for (const attribute of this.southManifest!.settings.attributes) {
      addAttributeToForm(this.fb, this.form.controls.southSettings, attribute);
    }
    addEnablingConditions(this.form.controls.southSettings, this.southManifest!.settings.enablingConditions);

    // if we have a history query, we initialize the values
    if (this.historyQuery) {
      const dateRange: DateRange = {
        startTime: this.historyQuery.startTime,
        endTime: this.historyQuery.endTime
      };
      // used to have the same ref
      this.historyQuery.caching.trigger.scanMode = this.scanModes.find(
        element => element.id === this.historyQuery!.caching.trigger.scanMode.id
      )!;
      this.inMemoryTransformersWithOptions = [...this.historyQuery.northTransformers];
      this.form.patchValue({
        ...this.historyQuery,
        dateRange
      });
    } else {
      if (southConnector) {
        this.form.controls.southSettings.patchValue(southConnector.settings);
        this.inMemoryItems = southConnector.items.map(item => ({
          ...item,
          id: null, // we need to remove the existing ids
          scanModeId: undefined // remove scanModeId retrieved from south connector
        }));
      }
      if (northConnector) {
        northConnector.caching.trigger.scanMode = this.scanModes.find(
          element => element.id === northConnector.caching.trigger.scanMode.id
        )!;
        this.form.controls.northSettings.patchValue(northConnector.settings);
        this.form.controls.caching.patchValue(northConnector.caching);
        this.inMemoryTransformersWithOptions = [...northConnector.transformers];
      }
      // we should provoke all value changes to make sure fields are properly hidden and disabled
      this.form.setValue(this.form.getRawValue());
    }

    this.form.controls.name.updateValueAndValidity({ onlySelf: true, emitEvent: false });
  }

  canDeactivate(): Observable<boolean> | boolean {
    if (this.form?.dirty) {
      return this.unsavedChangesConfirmation.confirmUnsavedChanges();
    }
    return true;
  }

  save() {
    if (!this.form?.valid) {
      return;
    }

    const formValue = this.form!.value;
    const dateRange = formValue.dateRange!;
    const command: HistoryQueryCommandDTO = {
      name: formValue.name!,
      description: formValue.description!,
      startTime: dateRange.startTime,
      endTime: dateRange.endTime,
      northType: this.northType as OIBusNorthType,
      southType: this.southType as OIBusSouthType,
      southSettings: formValue.southSettings,
      northSettings: formValue.northSettings,
      caching: {
        trigger: {
          scanModeId: formValue.caching!.trigger!.scanMode!.id!,
          scanModeName: null,
          numberOfElements: formValue.caching!.trigger!.numberOfElements!,
          numberOfFiles: formValue.caching!.trigger!.numberOfFiles!
        },
        throttling: {
          runMinDelay: formValue.caching!.throttling!.runMinDelay!,
          maxSize: formValue.caching!.throttling!.maxSize!,
          maxNumberOfElements: formValue.caching!.throttling!.maxNumberOfElements!
        },
        error: {
          retryInterval: formValue.caching!.error!.retryInterval!,
          retryCount: formValue.caching!.error!.retryCount!,
          retentionDuration: formValue.caching!.error!.retentionDuration!
        },
        archive: {
          enabled: formValue.caching!.archive!.enabled!,
          retentionDuration: formValue.caching!.archive!.retentionDuration!
        }
      },
      items:
        this.saveItemChangesDirectly && this.historyQuery
          ? this.historyQuery.items.map(item => ({
              id: item.id,
              name: item.name,
              enabled: item.enabled,
              settings: item.settings
            }))
          : this.inMemoryItems,
      northTransformers: this.inMemoryTransformersWithOptions.map(element => ({
        transformerId: element.transformer.id,
        options: element.options,
        inputType: element.inputType
      }))
    };

    if (this.mode === 'edit') {
      const modalRef = this.modalService.open(ResetCacheHistoryQueryModalComponent);
      modalRef.result.subscribe(resetCache => {
        this.createOrUpdateHistoryQuery(command, resetCache);
      });
    } else {
      this.createOrUpdateHistoryQuery(command, false);
    }
  }

  createOrUpdateHistoryQuery(command: HistoryQueryCommandDTO, resetCache: boolean): void {
    let createOrUpdate: Observable<HistoryQueryDTO>;
    // if we are editing
    if (this.mode === 'edit') {
      createOrUpdate = this.historyQueryService.update(this.historyQuery!.id, command, resetCache).pipe(
        tap(() => {
          this.notificationService.success('history-query.updated', {
            name: command.name
          });
          this.form?.markAsPristine();
        }),
        switchMap(() => this.historyQueryService.findById(this.historyQuery!.id))
      );
    } else {
      createOrUpdate = this.historyQueryService.create(command, this.fromSouthId, this.fromNorthId, this.duplicateId).pipe(
        tap(() => {
          this.notificationService.success('history-query.created', {
            name: command.name
          });
          this.form?.markAsPristine();
        })
      );
    }
    createOrUpdate.pipe(this.state.pendingUntilFinalization()).subscribe(historyQuery => {
      this.router.navigate(['/history-queries', historyQuery.id]);
    });
  }

  updateInMemoryTransformers(transformersWithOptions: Array<TransformerDTOWithOptions> | null) {
    if (transformersWithOptions) {
      this.inMemoryTransformersWithOptions = transformersWithOptions;
    } else {
      // When child signals backend update, refresh current connector view and in-memory cache
      this.historyQueryService.findById(this.historyQuery!.id).subscribe(historyQuery => {
        this.historyQuery = JSON.parse(JSON.stringify(historyQuery));
        this.inMemoryTransformersWithOptions = [...historyQuery.northTransformers];
      });
    }
  }

  updateInMemoryItems(items: Array<HistoryQueryItemCommandDTO> | null) {
    if (items) {
      this.inMemoryItems = items;
    } else {
      this.historyQueryService.findById(this.historyQuery!.id).subscribe(historyQuery => {
        this.historyQuery!.items = historyQuery.items;
        this.historyQuery = JSON.parse(JSON.stringify(this.historyQuery)); // Used to force a refresh in a history query item list
      });
    }
  }

  test(type: 'south' | 'north') {
    // Only validate the relevant settings group depending on type
    if (type === 'south') {
      this.form?.controls.southSettings.markAllAsTouched();
      if (!this.form?.controls.southSettings.valid) return;
    } else {
      this.form?.controls.northSettings.markAllAsTouched();
      if (!this.form?.controls.northSettings.valid) return;
    }

    const historyQueryId = this.historyQuery?.id ?? null;
    let command: SouthConnectorCommandDTO | NorthConnectorCommandDTO;
    let fromConnectorId;

    if (type === 'south') {
      command = this.southConnectorCommand;
      fromConnectorId = this.fromSouthId;
    } else {
      command = this.northConnectorCommand;
      fromConnectorId = this.fromNorthId;
    }

    const modalRef = this.modalService.open(TestConnectionResultModalComponent);
    const component: TestConnectionResultModalComponent = modalRef.componentInstance;
    component.runHistoryQueryTest(type, historyQueryId, command.settings, command.type, fromConnectorId ? fromConnectorId : null);
  }

  get southConnectorCommand() {
    const formValue = this.form!.value;
    return {
      type: this.southManifest!.id,
      settings: formValue.southSettings,
      items: this.inMemoryItems
    } as SouthConnectorCommandDTO;
  }

  get northConnectorCommand() {
    const formValue = this.form!.value;

    return {
      type: this.northManifest!.id,
      settings: formValue.northSettings,
      caching: formValue.caching
    } as NorthConnectorCommandDTO;
  }
}
