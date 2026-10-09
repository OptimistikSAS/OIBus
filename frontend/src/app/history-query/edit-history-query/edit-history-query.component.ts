import { ChangeDetectionStrategy, Component, computed, forwardRef, inject, linkedSignal, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
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
import { ActivatedRoute, Router } from '@angular/router';

import { NgbDropdown, NgbDropdownItem, NgbDropdownMenu, NgbDropdownToggle, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { DateTime } from 'luxon';
import { combineLatest, firstValueFrom, Observable, of, switchMap, tap } from 'rxjs';

import { CertificateDTO } from '@oibus/shared/api/certificate.model';
import {
  HistoryQueryCommandDTO,
  HistoryQueryDTO,
  HistoryQueryItemCommandDTO,
  HistoryQueryLightDTO
} from '@oibus/shared/api/history-query.model';
import { NorthConnectorCommandDTO, NorthConnectorDTO } from '@oibus/shared/api/north-connector.model';
import { ScanModeDTO } from '@oibus/shared/api/scan-mode.model';
import { SouthConnectorCommandDTO, SouthConnectorDTO } from '@oibus/shared/api/south-connector.model';
import { HistoryTransformerDTOWithOptions, SourceOriginSouthDTO, TransformerDTO } from '@oibus/shared/api/transformer.model';
import { createPageFromArray, Page } from '@oibus/shared/common/types';
import { OIBusObjectAttribute, OIBusScanModeAttribute } from '@oibus/shared/connector/form.model';
import { NorthConnectorManifest, OIBusNorthType } from '@oibus/shared/connector/north-manifest.model';
import { OIBusSouthType, SouthConnectorManifest } from '@oibus/shared/connector/south-manifest.model';

import { CertificateService } from '../../services/certificate.service';
import { HistoryQueryService } from '../../services/history-query.service';
import { NorthConnectorService } from '../../services/north-connector.service';
import { ScanModeService } from '../../services/scan-mode.service';
import { SouthConnectorService } from '../../services/south-connector.service';
import { TransformerService } from '../../services/transformer.service';
import { BackNavigationDirective } from '../../shared/back-navigation.directives';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { ConfirmationService } from '../../shared/confirmation.service';
import { DateRange, DateRangeSelectorComponent } from '../../shared/date-range-selector/date-range-selector.component';
import { DocsUrlService } from '../../shared/docs-url.service';
import { ExportItemModalComponent } from '../../shared/export-item-modal/export-item-modal.component';
import { findItemIndex } from '../../shared/find-item-index';
import { addAttributeToForm, addEnablingConditions } from '../../shared/form/dynamic-form.builder';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../shared/form/form-validation-directives';
import { OIBUS_FORM_MODE } from '../../shared/form/oibus-form-mode.token';
import { OIBusObjectFormControlComponent } from '../../shared/form/oibus-object-form-control/oibus-object-form-control.component';
import { OIBusScanModeFormControlComponent } from '../../shared/form/oibus-scan-mode-form-control/oibus-scan-mode-form-control.component';
import { ModalService } from '../../shared/modal.service';
import { NotificationService } from '../../shared/notification.service';
import { OibHelpComponent } from '../../shared/oib-help/oib-help.component';
import { OIBusNorthTypeEnumPipe } from '../../shared/oibus-north-type-enum.pipe';
import { OIBusSouthTypeEnumPipe } from '../../shared/oibus-south-type-enum.pipe';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { ObservableState, SaveButtonComponent } from '../../shared/save-button/save-button.component';
import { SouthExploreModalComponent } from '../../shared/south-explore-modal/south-explore-modal.component';
import { TestConnectionResultModalComponent } from '../../shared/test-connection-result-modal/test-connection-result-modal.component';
import { CanComponentDeactivate } from '../../shared/unsaved-changes.guard';
import { UnsavedChangesConfirmationService } from '../../shared/unsaved-changes-confirmation.service';
import { EditHistoryQueryItemModalComponent } from '../history-query-items/edit-history-query-item-modal/edit-history-query-item-modal.component';
import {
  filterItems,
  ItemSort,
  ItemSortColumn,
  itemSortIcon,
  nextItemSort,
  NO_ITEM_SORT,
  selectItems,
  sortItems,
  toggleItemSelection
} from '../history-query-items/history-query-item-table';
import { ImportHistoryQueryItemsModalComponent } from '../history-query-items/import-history-query-items-modal/import-history-query-items-modal.component';
import { HistoryQueryTransformersComponent } from '../history-query-transformers/history-query-transformers.component';
import { ResetCacheHistoryQueryModalComponent } from '../reset-cache-history-query-modal/reset-cache-history-query-modal.component';

const PAGE_SIZE = 20;

type HistoryQueryForm = FormGroup<{
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
}>;

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
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [
    {
      provide: OIBUS_FORM_MODE,
      useFactory: (component: EditHistoryQueryComponent) => () => component.mode(),
      deps: [forwardRef(() => EditHistoryQueryComponent)]
    }
  ]
})
export class EditHistoryQueryComponent implements CanComponentDeactivate {
  private readonly historyQueryService = inject(HistoryQueryService);
  private readonly northConnectorService = inject(NorthConnectorService);
  private readonly southConnectorService = inject(SouthConnectorService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly notificationService = inject(NotificationService);
  private readonly scanModeService = inject(ScanModeService);
  private readonly transformerService = inject(TransformerService);
  private readonly certificateService = inject(CertificateService);
  private readonly modalService = inject(ModalService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly unsavedChangesConfirmation = inject(UnsavedChangesConfirmationService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly docsUrlService = inject(DocsUrlService);

  readonly generalSettingsHelpUrl = this.docsUrlService.resolve('guide/history-queries');
  readonly cachingHelpUrl = this.docsUrlService.resolve('guide/north-connectors/common-settings#caching');
  readonly itemSectionHelpUrl = this.docsUrlService.resolve('guide/south-connectors/common-settings#item-section');

  readonly mode = signal<'create' | 'edit'>('create');
  private historyId = 'create';
  readonly historyQuery = signal<HistoryQueryDTO | null>(null);
  readonly southType = signal<OIBusSouthType | null>(null);
  readonly northType = signal<OIBusNorthType | null>(null);
  readonly northTypeHelpUrl = computed(() => this.docsUrlService.resolve('guide/north-connectors/' + this.northType()));
  readonly southTypeHelpUrl = computed(() => this.docsUrlService.resolve('guide/south-connectors/' + this.southType()));
  private duplicateId = '';
  private fromSouthId = '';
  private fromNorthId = '';
  readonly state = new ObservableState();
  readonly scanModes = signal<Array<ScanModeDTO>>([]);
  readonly transformers = signal<Array<TransformerDTO>>([]);
  readonly certificates = signal<Array<CertificateDTO>>([]);
  readonly northManifest = signal<NorthConnectorManifest | null>(null);
  readonly southManifest = signal<SouthConnectorManifest | null>(null);
  private existingHistoryQueries: Array<HistoryQueryLightDTO> = [];

  /** Built along with the manifests */
  readonly form = signal<HistoryQueryForm | null>(null);

  readonly inMemoryTransformersWithOptions = signal<Array<HistoryTransformerDTOWithOptions>>([]);
  readonly scanModeAttribute: OIBusScanModeAttribute = {
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

  /** The items of the history query, saved with it */
  readonly inMemoryItems = signal<Array<HistoryQueryItemCommandDTO>>([]);
  readonly searchControl = this.fb.control(null as string | null);
  readonly statusFilterControl = this.fb.control(null as string | null);
  private readonly searchText = toSignal(this.searchControl.valueChanges, { initialValue: this.searchControl.value });
  private readonly statusFilter = toSignal(this.statusFilterControl.valueChanges, { initialValue: this.statusFilterControl.value });
  readonly itemSort = signal<ItemSort>(NO_ITEM_SORT);
  readonly filteredItems = computed(() =>
    sortItems(filterItems(this.inMemoryItems(), { name: this.searchText(), status: this.statusFilter() }), this.itemSort())
  );
  /** Back to the first page when the filters or the sort change (the page is kept when the items change) */
  private readonly itemsPageNumber = linkedSignal({
    source: () => [this.searchText(), this.statusFilter(), this.itemSort()],
    computation: () => 0
  });
  readonly displayedItems = computed<Page<HistoryQueryItemCommandDTO>>(() =>
    createPageFromArray(this.filteredItems(), PAGE_SIZE, this.itemsPageNumber())
  );
  /** The selected items, by name */
  readonly selectedItems = signal<ReadonlyMap<string, HistoryQueryItemCommandDTO>>(new Map());

  constructor() {
    combineLatest([
      this.scanModeService.list(),
      this.certificateService.list(),
      this.transformerService.list(),
      this.historyQueryService.list(),
      this.route.paramMap,
      this.route.queryParamMap
    ])
      .pipe(
        takeUntilDestroyed(),
        switchMap(([scanModes, certificates, transformers, historyQueries, params, queryParams]) => {
          this.scanModes.set(scanModes.filter(scanMode => scanMode.id !== 'subscription'));
          this.certificates.set(certificates);
          this.transformers.set(transformers);
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
            this.mode.set('edit');
            this.historyId = paramHistoryQueryId;
            historyQueryObs = this.historyQueryService.findById(paramHistoryQueryId);
          } else {
            this.mode.set('create');
            this.historyId = 'create';
            if (paramDuplicateHistoryQueryId) {
              this.duplicateId = paramDuplicateHistoryQueryId;
              historyQueryObs = this.historyQueryService.findById(paramDuplicateHistoryQueryId);
            } else {
              if (southId) {
                southObs = this.southConnectorService.findById(southId);
              } else {
                this.southType.set((queryParams.get('southType') as OIBusSouthType) || null);
              }
              if (northId) {
                northObs = this.northConnectorService.findById(northId);
              } else {
                this.northType.set((queryParams.get('northType') as OIBusNorthType) || null);
              }
            }
          }
          return combineLatest([historyQueryObs, northObs, southObs]);
        }),
        switchMap(([historyQuery, northConnector, southConnector]) => {
          this.historyQuery.set(historyQuery);

          // creating/duplicating a history query
          if (historyQuery) {
            if (this.duplicateId) {
              historyQuery.name = `${historyQuery.name}-copy`;
            }
            this.southType.set(historyQuery.southType);
            this.northType.set(historyQuery.northType);
            this.inMemoryItems.set(
              historyQuery.items.map(
                item =>
                  ({
                    id: this.duplicateId ? `temp_${item.id}` : item.id, // temp id id used to create items and use this id to reference them from transformers
                    name: item.name,
                    enabled: item.enabled,
                    settings: item.settings
                  }) as HistoryQueryItemCommandDTO
              )
            );
            this.inMemoryTransformersWithOptions.set(
              historyQuery.northTransformers.map(element => ({
                id: this.duplicateId ? `temp_${element.id}` : element.id, // temp id is used to create new transformers and manage through the id transformer from list
                items: element.items.map(item => ({
                  ...item,
                  id: this.duplicateId ? `temp_${item.id}` : item.id // use temp id that should match item id with temp from previous map loop
                })),
                transformer: element.transformer,
                options: element.options
              }))
            );
          }
          // creating new from an existing south and north connector
          else {
            if (southConnector) {
              this.southType.set(southConnector.type);
              this.fromSouthId = southConnector.id;
              this.inMemoryItems.set(
                southConnector.items.map(
                  item =>
                    ({
                      id: `temp_${item.id}`,
                      name: item.name,
                      enabled: item.enabled,
                      settings: item.settings
                    }) as HistoryQueryItemCommandDTO
                )
              );
            }
            if (northConnector) {
              this.northType.set(northConnector.type);
              this.fromNorthId = northConnector.id;
              this.inMemoryTransformersWithOptions.set(
                northConnector.transformers
                  // only keep transformers attached to the south used to create the history query. Otherwise, the transformers are not useful for this history
                  .filter(element => element.source.type === 'south' && element.source.south.id === this.fromSouthId)
                  .map(element => ({
                    id: `temp_${element.id}`,
                    transformer: element.transformer,
                    options: element.options,
                    items: (element.source as SourceOriginSouthDTO).items.map(item => ({
                      ...item,
                      id: `temp_${item.id}` // use temp id that should match item id with temp from previous map loop
                    }))
                  }))
              );
            }
          }
          return combineLatest([
            this.northConnectorService.getNorthManifest(this.northType()!),
            this.southConnectorService.getSouthManifest(this.southType()!),
            of(southConnector),
            of(northConnector)
          ]);
        })
      )
      .subscribe(([northManifest, southManifest, southConnector, northConnector]) => {
        if (!northManifest || !southManifest) {
          return;
        }
        this.northManifest.set(northManifest);
        this.southManifest.set(southManifest);
        this.buildForm(northConnector, southConnector);
      });
  }

  private checkUniqueness(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = (control.value ?? '').toString().trim().toLowerCase();
      if (!value) {
        return null;
      }

      const editedHistoryQuery = this.historyQuery();
      const isDuplicate = this.existingHistoryQueries.some(historyQuery => {
        if (editedHistoryQuery && historyQuery.id === editedHistoryQuery.id) {
          return false;
        }
        return historyQuery.name.trim().toLowerCase() === value;
      });

      return isDuplicate ? { mustBeUnique: true } : null;
    };
  }

  private buildForm(northConnector: NorthConnectorDTO | null, southConnector: SouthConnectorDTO | null) {
    const form: HistoryQueryForm = this.fb.group({
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
    this.form.set(form);
    const northManifest = this.northManifest()!;
    for (const attribute of northManifest.settings.attributes) {
      addAttributeToForm(this.fb, form.controls.northSettings, attribute);
    }
    addEnablingConditions(form.controls.northSettings, northManifest.settings.enablingConditions);

    const southManifest = this.southManifest()!;
    for (const attribute of southManifest.settings.attributes) {
      addAttributeToForm(this.fb, form.controls.southSettings, attribute);
    }
    addEnablingConditions(form.controls.southSettings, southManifest.settings.enablingConditions);

    // if we have a history query, we initialize the values
    const historyQuery = this.historyQuery();
    if (historyQuery) {
      // used to have the same ref
      historyQuery.caching.trigger.scanMode = this.scanModes().find(element => element.id === historyQuery.caching.trigger.scanMode.id)!;
      form.patchValue({
        ...historyQuery,
        queryTimeRange: {
          dateRange: {
            startTime: historyQuery.queryTimeRange.startTime,
            endTime: historyQuery.queryTimeRange.endTime
          },
          maxReadInterval: historyQuery.queryTimeRange.maxReadInterval,
          readDelay: historyQuery.queryTimeRange.readDelay
        }
      });
    } else {
      if (southConnector) {
        form.patchValue({ southSettings: southConnector.settings });
      }
      if (northConnector) {
        // used to have the same ref
        northConnector.caching.trigger.scanMode = this.scanModes().find(
          element => element.id === northConnector.caching.trigger.scanMode.id
        )!;
        form.patchValue({ northSettings: northConnector.settings, caching: northConnector.caching });
      }
      // we should provoke all value changes to make sure fields are properly hidden and disabled
      form.setValue(form.getRawValue());
    }

    form.controls.name.updateValueAndValidity({ onlySelf: true, emitEvent: false });
  }

  canDeactivate(): Observable<boolean> | boolean {
    if (this.form()?.dirty) {
      return this.unsavedChangesConfirmation.confirmUnsavedChanges();
    }
    return true;
  }

  createOrUpdateHistoryQuery(command: HistoryQueryCommandDTO, resetCache: boolean): void {
    let createOrUpdate: Observable<HistoryQueryDTO>;
    // if we are editing
    if (this.mode() === 'edit') {
      const historyQueryId = this.historyQuery()!.id;
      createOrUpdate = this.historyQueryService.update(historyQueryId, command, resetCache).pipe(
        tap(() => {
          this.notificationService.success('history-query.updated', {
            name: command.name
          });
          this.form()?.markAsPristine();
        }),
        switchMap(() => this.historyQueryService.findById(historyQueryId))
      );
    } else {
      createOrUpdate = this.historyQueryService.create(command, this.fromSouthId, this.fromNorthId, this.duplicateId).pipe(
        tap(() => {
          this.notificationService.success('history-query.created', {
            name: command.name
          });
          this.form()?.markAsPristine();
        })
      );
    }
    createOrUpdate.pipe(this.state.pendingUntilFinalization()).subscribe(historyQuery => {
      this.router.navigate(['/history-queries', historyQuery.id]);
    });
  }

  save() {
    const form = this.form();
    if (!form?.valid) {
      return;
    }

    const formValue = form.value;
    const command = {
      name: formValue.name!,
      description: formValue.description!,
      queryTimeRange: {
        startTime: formValue.queryTimeRange!.dateRange!.startTime,
        endTime: formValue.queryTimeRange!.dateRange!.endTime,
        maxReadInterval: formValue.queryTimeRange!.maxReadInterval!,
        readDelay: formValue.queryTimeRange!.readDelay!
      },
      southType: this.southType() as OIBusSouthType,
      southSettings: formValue.southSettings,
      northType: this.northType() as OIBusNorthType,
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
      items: this.inMemoryItems(),
      northTransformers: this.inMemoryTransformersWithOptions().map(element => ({
        id: element.id,
        transformerId: element.transformer.id,
        options: element.options,
        items: element.items.map(item => ({
          id: item.id,
          name: item.name,
          enabled: item.enabled
        }))
      }))
    } as HistoryQueryCommandDTO;

    if (this.mode() === 'edit') {
      const modalRef = this.modalService.open(ResetCacheHistoryQueryModalComponent);
      modalRef.result.subscribe(resetCache => {
        this.createOrUpdateHistoryQuery(command, resetCache);
      });
    } else {
      this.createOrUpdateHistoryQuery(command, false);
    }
  }

  updateInMemoryTransformers(transformersWithOptions: Array<HistoryTransformerDTOWithOptions> | null) {
    if (transformersWithOptions) {
      this.inMemoryTransformersWithOptions.set(transformersWithOptions);
    } else {
      // When child signals backend update, refresh current connector view and in-memory cache
      this.historyQueryService.findById(this.historyQuery()!.id).subscribe(historyQuery => {
        this.historyQuery.set(JSON.parse(JSON.stringify(historyQuery)));
        this.inMemoryTransformersWithOptions.set([...historyQuery.northTransformers]);
      });
    }
  }

  test(type: 'south' | 'north') {
    // Only validate the relevant settings group depending on type
    if (type === 'south') {
      this.form()?.controls.southSettings.markAllAsTouched();
      if (!this.form()?.controls.southSettings.valid) return;
    } else {
      this.form()?.controls.northSettings.markAllAsTouched();
      if (!this.form()?.controls.northSettings.valid) return;
    }

    const historyQueryId = this.historyQuery()?.id ?? null;
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

  explore() {
    // Explore: only validate the south settings section, like the test connection button
    this.form()?.controls.southSettings.markAllAsTouched();
    if (!this.form()?.controls.southSettings.valid) {
      return;
    }

    const historyQueryId = this.historyQuery()?.id ?? null;
    const fromSouthId = this.fromSouthId || null;
    const modalRef = this.modalService.open(SouthExploreModalComponent, { size: 'lg' });
    const component: SouthExploreModalComponent = modalRef.componentInstance;
    component.prepare(historyQueryId, this.southConnectorCommand.settings, this.southConnectorCommand.type, {
      start: (settings, type) => this.historyQueryService.startExplore(historyQueryId || 'create', settings, type, fromSouthId),
      browse: (sessionId, parentId) => this.historyQueryService.browseExplore(historyQueryId || 'create', sessionId, parentId),
      close: sessionId => this.historyQueryService.closeExplore(historyQueryId || 'create', sessionId)
    });
  }

  private get southConnectorCommand() {
    const formValue = this.form()!.value;
    return {
      type: this.southManifest()!.id,
      settings: formValue.southSettings,
      items: this.inMemoryItems()
    } as SouthConnectorCommandDTO;
  }

  private get northConnectorCommand() {
    const formValue = this.form()!.value;

    return {
      type: this.northManifest()!.id,
      settings: formValue.northSettings,
      caching: formValue.caching
    } as NorthConnectorCommandDTO;
  }

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
    component.directSave.set(false);
    component.inMemoryTransformers.set(this.inMemoryTransformersWithOptions());
    component.prepareForCreation(this.inMemoryItems(), this.historyId, this.fromSouthId, this.southConnectorCommand, this.southManifest()!);
    modalRef.result.subscribe((command: HistoryQueryItemCommandDTO) => {
      this.inMemoryItems.update(items => [...items, command]);
    });
  }

  duplicateItem(item: HistoryQueryItemCommandDTO) {
    const modalRef = this.modalService.open(EditHistoryQueryItemModalComponent, { size: 'xl', backdrop: 'static' });
    const component: EditHistoryQueryItemModalComponent = modalRef.componentInstance;
    component.directSave.set(false);
    component.inMemoryTransformers.set(this.inMemoryTransformersWithOptions());
    component.prepareForCopy(
      this.inMemoryItems(),
      item,
      this.historyId,
      this.fromSouthId,
      this.southConnectorCommand,
      this.southManifest()!
    );
    modalRef.result.subscribe((command: HistoryQueryItemCommandDTO) => {
      this.inMemoryItems.update(items => [...items, command]);
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
    component.directSave.set(false);
    component.inMemoryTransformers.set(this.inMemoryTransformersWithOptions());
    const tableIndex = findItemIndex(this.inMemoryItems(), item);
    component.prepareForEdition(
      this.inMemoryItems(),
      item,
      this.historyId,
      this.fromSouthId,
      this.southConnectorCommand,
      this.southManifest()!,
      tableIndex
    );
    modalRef.result.subscribe((command: HistoryQueryItemCommandDTO) => {
      this.inMemoryItems.update(items => items.map((element, index) => (index === tableIndex ? command : element)));
    });
  }

  deleteItem(item: HistoryQueryItemCommandDTO) {
    this.confirmationService.confirm({ messageKey: 'history-query.items.confirm-deletion' }).subscribe(() => {
      this.inMemoryItems.update(items => items.filter(i => i.name !== item.name));
    });
  }

  deleteAllItems() {
    this.confirmationService.confirm({ messageKey: 'history-query.items.confirm-delete-all' }).subscribe(() => {
      this.inMemoryItems.set([]);
      this.itemsPageNumber.set(0);
    });
  }

  exportItems() {
    const modalRef = this.modalService.open(ExportItemModalComponent, { backdrop: 'static' });
    const filename = `${this.historyQuery()?.name || 'items'}`;
    modalRef.componentInstance.prepare(filename);
    modalRef.result.subscribe(response => {
      if (!response) return;
      if (this.historyId === 'create') {
        this.historyQueryService
          .itemsToCsv(this.southManifest()!.id, this.inMemoryItems(), response.filename, response.delimiter)
          .subscribe();
      } else {
        this.historyQueryService.exportItems(this.historyId, response.filename, response.delimiter).subscribe();
      }
    });
  }

  importItems() {
    const modalRef = this.modalService.open(ImportHistoryQueryItemsModalComponent, { size: 'xl', backdrop: 'static' });
    const expectedHeaders = ['name', 'enabled'];
    const optionalHeaders: Array<string> = ['scanMode'];
    const settingsAttribute = this.southManifest()!.items.rootAttribute.attributes.find(
      attribute => attribute.key === 'settings'
    )! as OIBusObjectAttribute;
    settingsAttribute.attributes.forEach(setting => {
      if (settingsAttribute.enablingConditions.find(element => element.targetPathFromRoot === setting.key)) {
        optionalHeaders.push(`settings_${setting.key}`);
      } else {
        expectedHeaders.push(`settings_${setting.key}`);
      }
    });

    const checkFn = (file: File, delimiter: string, deleteItemsNotPresent: boolean) =>
      this.historyQueryService.checkImportItems(this.southManifest()!.id, this.inMemoryItems(), file, delimiter, deleteItemsNotPresent);

    modalRef.componentInstance.prepare(this.southManifest()!, expectedHeaders, optionalHeaders, true, checkFn);
    modalRef.result.subscribe((response: { items: Array<HistoryQueryItemCommandDTO>; eraseExisting: boolean } | undefined) => {
      if (!response) return;
      this.inMemoryItems.update(items => (response.eraseExisting ? [...response.items] : [...items, ...response.items]));
      this.itemsPageNumber.set(0);
    });
  }

  changePage(pageNumber: number) {
    this.itemsPageNumber.set(pageNumber);
  }

  toggleColumnSort(column: ItemSortColumn) {
    this.itemSort.update(sort => nextItemSort(sort, column));
  }

  sortIcon(column: ItemSortColumn): string {
    return itemSortIcon(this.itemSort(), column);
  }

  // Mass action methods
  toggleItemSelection(item: HistoryQueryItemCommandDTO) {
    this.selectedItems.update(selectedItems => toggleItemSelection(selectedItems, item));
  }

  selectAll() {
    this.selectedItems.update(selectedItems => selectItems(selectedItems, this.filteredItems()));
  }

  unselectAll() {
    this.selectedItems.set(new Map());
  }

  enableSelectedItems() {
    this.setSelectedItemsEnabled(true);
  }

  disableSelectedItems() {
    this.setSelectedItemsEnabled(false);
  }

  private setSelectedItemsEnabled(enabled: boolean) {
    const selectedItems = this.selectedItems();
    this.inMemoryItems.update(items => items.map(item => (selectedItems.has(item.name) ? { ...item, enabled } : item)));
    this.unselectAll();
  }

  deleteSelectedItems() {
    const selectedItems = this.selectedItems();
    this.confirmationService
      .confirm({
        messageKey: 'history-query.items.delete-multiple-message',
        interpolateParams: { count: selectedItems.size.toString() }
      })
      .subscribe(() => {
        this.inMemoryItems.update(items => items.filter(item => !selectedItems.has(item.name)));
        this.unselectAll();
      });
  }
}
