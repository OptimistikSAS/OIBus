import { Component, forwardRef, inject, OnInit } from '@angular/core';
import { TranslateDirective, TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ObservableState, SaveButtonComponent } from '../../shared/save-button/save-button.component';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { NotificationService } from '../../shared/notification.service';
import { ActivatedRoute, Router } from '@angular/router';
import { combineLatest, firstValueFrom, merge, Observable, of, switchMap, tap } from 'rxjs';
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
import { DateTime } from 'luxon';
import { ModalService } from '../../shared/modal.service';
import { TestConnectionResultModalComponent } from '../../shared/test-connection-result-modal/test-connection-result-modal.component';
import { OibHelpComponent } from '../../shared/oib-help/oib-help.component';
import { ResetCacheHistoryQueryModalComponent } from '../reset-cache-history-query-modal/reset-cache-history-query-modal.component';
import { OIBusNorthTypeEnumPipe } from '../../shared/oibus-north-type-enum.pipe';
import { OIBusSouthTypeEnumPipe } from '../../shared/oibus-south-type-enum.pipe';
import {
  HistoryTransformerDTOWithOptions,
  SourceOriginSouthDTO,
  TransformerDTO
} from '../../../../../backend/shared/model/transformer.model';
import { TransformerService } from '../../services/transformer.service';
import { CertificateService } from '../../services/certificate.service';
import { CertificateDTO } from '../../../../../backend/shared/model/certificate.model';
import { addAttributeToForm, addEnablingConditions } from '../../shared/form/dynamic-form.builder';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../shared/form/form-validation-directives';
import { OIBusScanModeFormControlComponent } from '../../shared/form/oibus-scan-mode-form-control/oibus-scan-mode-form-control.component';
import { OIBusObjectAttribute, OIBusScanModeAttribute } from '../../../../../backend/shared/model/form.model';
import { OIBusObjectFormControlComponent } from '../../shared/form/oibus-object-form-control/oibus-object-form-control.component';
import { CanComponentDeactivate } from '../../shared/unsaved-changes.guard';
import { UnsavedChangesConfirmationService } from '../../shared/unsaved-changes-confirmation.service';
import { DateRange, DateRangeSelectorComponent } from '../../shared/date-range-selector/date-range-selector.component';
import { HistoryQueryTransformersComponent } from '../history-query-transformers/history-query-transformers.component';
import { OIBUS_FORM_MODE } from '../../shared/form/oibus-form-mode.token';
import { NgbDropdown, NgbDropdownItem, NgbDropdownMenu, NgbDropdownToggle, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { createPageFromArray, Page } from '../../../../../backend/shared/model/types';
import { emptyPage } from '../../shared/test-utils';
import { ConfirmationService } from '../../shared/confirmation.service';
import { EditHistoryQueryItemModalComponent } from '../history-query-items/edit-history-query-item-modal/edit-history-query-item-modal.component';
import { ExportItemModalComponent } from '../../shared/export-item-modal/export-item-modal.component';
import { ImportItemModalComponent } from '../../shared/import-item-modal/import-item-modal.component';
import { ImportHistoryQueryItemsModalComponent } from '../history-query-items/import-history-query-items-modal/import-history-query-items-modal.component';

const PAGE_SIZE = 20;

const enum ColumnSortState {
  INDETERMINATE = 0,
  ASCENDING = 1,
  DESCENDING = 2
}

export interface TableData {
  name: string;
  enabled: boolean;
}

@Component({
  selector: 'oib-edit-history-query',
  imports: [
    TranslateDirective,
    SaveButtonComponent,
    DateRangeSelectorComponent,
    BackNavigationDirective,
    BoxComponent,
    BoxTitleDirective,
    OibHelpComponent,
    OIBusNorthTypeEnumPipe,
    OIBusSouthTypeEnumPipe,
    ReactiveFormsModule,
    OI_FORM_VALIDATION_DIRECTIVES,
    OIBusScanModeFormControlComponent,
    OIBusObjectFormControlComponent,
    HistoryQueryTransformersComponent,
    TranslatePipe,
    NgbTooltip,
    NgbDropdown,
    NgbDropdownMenu,
    NgbDropdownToggle,
    NgbDropdownItem,
    PaginationComponent
  ],
  templateUrl: './edit-history-query.component.html',
  styleUrl: './edit-history-query.component.scss',
  viewProviders: [
    {
      provide: OIBUS_FORM_MODE,
      useFactory: (component: EditHistoryQueryComponent) => () => component.mode,
      deps: [forwardRef(() => EditHistoryQueryComponent)]
    }
  ]
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
  private confirmationService = inject(ConfirmationService);
  private translateService = inject(TranslateService);

  mode: 'create' | 'edit' = 'create';
  historyId!: string;
  historyQuery: HistoryQueryDTO | null = null;
  state = new ObservableState();
  scanModes: Array<ScanModeDTO> = [];
  transformers: Array<TransformerDTO> = [];
  certificates: Array<CertificateDTO> = [];
  northManifest: NorthConnectorManifest | null = null;
  southManifest: SouthConnectorManifest | null = null;
  southType: OIBusSouthType | null = null;
  fromSouthId = '';
  northType: OIBusNorthType | null = null;
  fromNorthId = '';
  duplicateId = '';
  existingHistoryQueries: Array<HistoryQueryLightDTO> = [];

  form: FormGroup<{
    name: FormControl<string>;
    description: FormControl<string>;
    queryTimeRange: FormGroup<{
      dateRange: FormControl<DateRange>;
      maxReadInterval: FormControl<number>;
      readDelay: FormControl<number>;
    }>;
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

  inMemoryTransformersWithOptions: Array<HistoryTransformerDTOWithOptions> = [];
  inMemoryItems: Array<HistoryQueryItemCommandDTO> = [];

  // Item list management
  filteredItems: Array<HistoryQueryItemCommandDTO> = [];
  displayedItems: Page<HistoryQueryItemCommandDTO> = emptyPage();
  searchControl = inject(NonNullableFormBuilder).control(null as string | null);
  statusFilterControl = inject(NonNullableFormBuilder).control(null as string | null);

  selectedItems = new Map<string, HistoryQueryItemCommandDTO>();
  isAllSelected = false;
  isIndeterminate = false;

  columnSortStates: { [key in keyof TableData]: ColumnSortState } = {
    name: ColumnSortState.INDETERMINATE,
    enabled: ColumnSortState.INDETERMINATE
  };
  currentColumnSort: keyof TableData | null = 'name';
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
                this.southType = (queryParams.get('southType') as OIBusSouthType) || null;
              }
              if (northId) {
                northObs = this.northConnectorService.findById(northId);
              } else {
                this.northType = (queryParams.get('northType') as OIBusNorthType) || null;
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
            this.inMemoryItems = historyQuery.items;
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
            this.northConnectorService.getNorthManifest(this.northType!),
            this.southConnectorService.getSouthManifest(this.southType!),
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
        this.resetPage();
      });

    // Subscribe to filter control changes
    merge(this.searchControl.valueChanges, this.statusFilterControl.valueChanges).subscribe(() => {
      this.resetPage();
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
      queryTimeRange: this.fb.group({
        dateRange: [
          {
            startTime: DateTime.now().minus({ days: 1 }).toUTC().toISO()!,
            endTime: DateTime.now().toUTC().toISO()!
          } as DateRange,
          Validators.required
        ],
        maxReadInterval: [3600, Validators.required],
        readDelay: [200, Validators.required]
      }),
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
        startTime: this.historyQuery.queryTimeRange.startTime,
        endTime: this.historyQuery.queryTimeRange.endTime
      };
      // used to have the same ref
      this.historyQuery.caching.trigger.scanMode = this.scanModes.find(
        element => element.id === this.historyQuery!.caching.trigger.scanMode.id
      )!;
      this.inMemoryTransformersWithOptions = this.historyQuery.northTransformers.map(element => ({
        id: element.id,
        transformer: element.transformer,
        options: element.options,
        items: element.items
      }));
      this.form.patchValue({
        ...this.historyQuery,
        queryTimeRange: {
          dateRange,
          maxReadInterval: this.historyQuery.queryTimeRange.maxReadInterval,
          readDelay: this.historyQuery.queryTimeRange.readDelay
        }
      });
    } else {
      if (southConnector) {
        this.form.controls.southSettings.patchValue(southConnector.settings);
        this.inMemoryItems = southConnector.items.map(
          item =>
            ({
              id: null,
              name: item.name,
              enabled: item.enabled,
              settings: item.settings
            }) as any
        );
      }
      if (northConnector) {
        northConnector.caching.trigger.scanMode = this.scanModes.find(
          element => element.id === northConnector.caching.trigger.scanMode.id
        )!;
        this.form.controls.northSettings.patchValue(northConnector.settings);
        this.form.controls.caching.patchValue(northConnector.caching);
        this.inMemoryTransformersWithOptions = northConnector.transformers
          .filter(transformer => transformer.source.type === 'south')
          .map(transformer => ({
            id: '',
            transformer: transformer.transformer,
            options: transformer.options,
            items: (transformer.source as SourceOriginSouthDTO).items
          }));
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
    const dateRange = formValue.queryTimeRange!.dateRange!;
    const command = {
      name: formValue.name!,
      description: formValue.description!,
      queryTimeRange: {
        startTime: dateRange.startTime,
        endTime: dateRange.endTime,
        maxReadInterval: formValue.queryTimeRange!.maxReadInterval!,
        readDelay: formValue.queryTimeRange!.readDelay!
      },
      southType: this.southType as OIBusSouthType,
      southSettings: formValue.southSettings,
      northType: this.northType as OIBusNorthType,
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
      items: this.inMemoryItems,
      northTransformers: this.inMemoryTransformersWithOptions.map(element => ({
        id: element.id,
        transformer: element.transformer,
        options: element.options,
        items: element.items
      }))
    } as HistoryQueryCommandDTO;

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

  updateInMemoryTransformers(transformersWithOptions: Array<HistoryTransformerDTOWithOptions> | null) {
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

  // Item management methods (in-memory)

  addItem() {
    const modalRef = this.modalService.open(EditHistoryQueryItemModalComponent, {
      size: 'xl',
      beforeDismiss: () => {
        const component: EditHistoryQueryItemModalComponent = modalRef.componentInstance;
        const result = component.canDismiss();
        return typeof result === 'boolean' ? result : firstValueFrom(result);
      }
    });
    const component: EditHistoryQueryItemModalComponent = modalRef.componentInstance;
    component.prepareForCreation(this.inMemoryItems, this.historyId, this.fromSouthId, this.southConnectorCommand, this.southManifest!);
    modalRef.result.subscribe((command: HistoryQueryItemCommandDTO) => {
      this.inMemoryItems = [
        ...this.inMemoryItems,
        { id: command.id ?? null, name: command.name, enabled: command.enabled, settings: command.settings } as any
      ];
      this.resetPage();
    });
  }

  editItem(item: HistoryQueryItemCommandDTO) {
    const modalRef = this.modalService.open(EditHistoryQueryItemModalComponent, {
      size: 'xl',
      beforeDismiss: () => {
        const component: EditHistoryQueryItemModalComponent = modalRef.componentInstance;
        const result = component.canDismiss();
        return typeof result === 'boolean' ? result : firstValueFrom(result);
      }
    });
    const component: EditHistoryQueryItemModalComponent = modalRef.componentInstance;
    const tableIndex = this.inMemoryItems.findIndex(i => i.id === item.id || i.name === item.name);
    component.prepareForEdition(
      this.inMemoryItems,
      item,
      this.historyId,
      this.fromSouthId,
      this.southConnectorCommand,
      this.southManifest!,
      tableIndex
    );
    modalRef.result.subscribe((command: HistoryQueryItemCommandDTO) => {
      const updated = this.inMemoryItems.filter(i => i.name !== item.name);
      updated.splice(tableIndex, 0, { ...item, ...command });
      this.inMemoryItems = updated;
      this.resetPage();
    });
  }

  duplicateItem(item: HistoryQueryItemCommandDTO) {
    const modalRef = this.modalService.open(EditHistoryQueryItemModalComponent, { size: 'xl', backdrop: 'static' });
    const component: EditHistoryQueryItemModalComponent = modalRef.componentInstance;
    component.prepareForCopy(this.inMemoryItems, item, this.historyId, this.fromSouthId, this.southConnectorCommand, this.southManifest!);
    modalRef.result.subscribe((command: HistoryQueryItemCommandDTO) => {
      this.inMemoryItems = [
        ...this.inMemoryItems,
        { id: command.id ?? null, name: command.name, enabled: command.enabled, settings: command.settings } as any
      ];
      this.resetPage();
    });
  }

  deleteItem(item: HistoryQueryItemCommandDTO) {
    this.confirmationService.confirm({ messageKey: 'history-query.items.confirm-deletion' }).subscribe(() => {
      this.inMemoryItems = this.inMemoryItems.filter(i => i.name !== item.name);
      this.resetPage();
    });
  }

  deleteAllItems() {
    this.confirmationService.confirm({ messageKey: 'history-query.items.confirm-delete-all' }).subscribe(() => {
      this.inMemoryItems = [];
      this.resetPage();
    });
  }

  exportItems() {
    const modalRef = this.modalService.open(ExportItemModalComponent, { backdrop: 'static' });
    const filename = `${this.historyQuery?.name || 'items'}`;
    modalRef.componentInstance.prepare(filename);
    modalRef.result.subscribe(response => {
      if (!response) return;
      if (this.historyId === 'create') {
        this.historyQueryService.itemsToCsv(this.southManifest!.id, this.inMemoryItems, response.filename, response.delimiter).subscribe();
      } else {
        this.historyQueryService.exportItems(this.historyId, response.filename, response.delimiter).subscribe();
      }
    });
  }

  importItems() {
    const modalRef = this.modalService.open(ImportItemModalComponent, { backdrop: 'static' });
    const expectedHeaders = ['name', 'enabled'];
    const optionalHeaders: Array<string> = ['scanMode'];
    const settingsAttribute = this.southManifest!.items.rootAttribute.attributes.find(
      attribute => attribute.key === 'settings'
    )! as OIBusObjectAttribute;
    settingsAttribute.attributes.forEach(setting => {
      if (settingsAttribute.enablingConditions.find(element => element.targetPathFromRoot === setting.key)) {
        optionalHeaders.push(`settings_${setting.key}`);
      } else {
        expectedHeaders.push(`settings_${setting.key}`);
      }
    });
    modalRef.componentInstance.prepare(expectedHeaders, optionalHeaders, [], false);
    modalRef.result.subscribe(response => {
      if (!response) return;
      this.checkImportItems(response.file, response.delimiter);
    });
  }

  checkImportItems(file: File, delimiter: string) {
    this.historyQueryService.checkImportItems(this.southManifest!.id, this.inMemoryItems, file, delimiter).subscribe(result => {
      const modalRef = this.modalService.open(ImportHistoryQueryItemsModalComponent, { size: 'xl', backdrop: 'static' });
      const component: ImportHistoryQueryItemsModalComponent = modalRef.componentInstance;
      component.prepare(this.southManifest!, this.inMemoryItems, result.items, result.errors);
      modalRef.result.subscribe((newItems: Array<HistoryQueryItemCommandDTO>) => {
        this.inMemoryItems = [...this.inMemoryItems, ...newItems];
        this.resetPage();
      });
    });
  }

  getFieldValue(element: any, field: string): string {
    const settingsAttribute = this.southManifest!.items.rootAttribute.attributes.find(
      attribute => attribute.key === 'settings'
    )! as OIBusObjectAttribute;

    const foundFormControl = settingsAttribute.attributes.find(formControl => formControl.key === field);
    if (foundFormControl && element[field] && foundFormControl.type === 'string-select') {
      return this.translateService.instant(foundFormControl.translationKey + '.' + element[field]);
    }
    return element[field];
  }

  // Filter, sort, pagination

  resetPage() {
    this.filteredItems = this.filter();
    this.changePage(0);
  }

  changePage(pageNumber: number) {
    this.sortTable();
    this.displayedItems = createPageFromArray(this.filteredItems, PAGE_SIZE, pageNumber);
  }

  filter(): Array<HistoryQueryItemCommandDTO> {
    const searchText = this.searchControl.value || '';
    const statusFilter = this.statusFilterControl.value;

    return this.inMemoryItems.filter(item => {
      if (searchText && !item.name.toLowerCase().includes(searchText.toLowerCase())) return false;
      if (statusFilter === 'enabled' && !item.enabled) return false;
      if (statusFilter === 'disabled' && item.enabled) return false;
      return true;
    });
  }

  toggleColumnSort(columnName: keyof TableData) {
    this.currentColumnSort = columnName;
    this.columnSortStates[this.currentColumnSort] = (this.columnSortStates[this.currentColumnSort] + 1) % 3;
    Object.keys(this.columnSortStates).forEach(key => {
      if (this.currentColumnSort !== key) {
        this.columnSortStates[key as keyof typeof this.columnSortStates] = 0;
      }
    });
    this.changePage(0);
  }

  private sortTable() {
    if (this.currentColumnSort && this.columnSortStates[this.currentColumnSort] !== ColumnSortState.INDETERMINATE) {
      const ascending = this.columnSortStates[this.currentColumnSort] === ColumnSortState.ASCENDING;
      switch (this.currentColumnSort) {
        case 'name':
          this.filteredItems.sort((a, b) => (ascending ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)));
          break;
        case 'enabled':
          this.filteredItems.sort((a, b) => {
            const aVal = a.enabled ? 1 : 0;
            const bVal = b.enabled ? 1 : 0;
            return ascending ? aVal - bVal : bVal - aVal;
          });
          break;
      }
    }
  }

  // Mass action methods

  toggleItemSelection(item: HistoryQueryItemCommandDTO) {
    if (this.selectedItems.has(item.name)) {
      this.selectedItems.delete(item.name);
    } else {
      this.selectedItems.set(item.name, item);
    }
    this.updateSelectionState();
  }

  selectAll() {
    this.filteredItems.forEach(item => this.selectedItems.set(item.name, item));
    this.updateSelectionState();
  }

  unselectAll() {
    this.selectedItems.clear();
    this.updateSelectionState();
  }

  updateSelectionState() {
    const totalItems = this.filteredItems.length;
    const selectedCount = this.selectedItems.size;
    this.isAllSelected = selectedCount === totalItems && totalItems > 0;
    this.isIndeterminate = selectedCount > 0 && selectedCount < totalItems;
  }

  getSelectedItemsCount(): number {
    return this.selectedItems.size;
  }

  enableSelectedItems() {
    this.inMemoryItems = this.inMemoryItems.map(item => (this.selectedItems.has(item.name) ? { ...item, enabled: true } : item));
    this.selectedItems.clear();
    this.updateSelectionState();
    this.resetPage();
  }

  disableSelectedItems() {
    this.inMemoryItems = this.inMemoryItems.map(item => (this.selectedItems.has(item.name) ? { ...item, enabled: false } : item));
    this.selectedItems.clear();
    this.updateSelectionState();
    this.resetPage();
  }

  deleteSelectedItems() {
    this.confirmationService
      .confirm({
        messageKey: 'history-query.items.delete-multiple-message',
        interpolateParams: { count: this.selectedItems.size.toString() }
      })
      .subscribe(() => {
        this.inMemoryItems = this.inMemoryItems.filter(item => !this.selectedItems.has(item.name));
        this.selectedItems.clear();
        this.updateSelectionState();
        this.resetPage();
      });
  }
}
