import { Component, inject, OnInit } from '@angular/core';

import { TranslateDirective } from '@ngx-translate/core';
import { ObservableState, SaveButtonComponent } from '../../shared/save-button/save-button.component';
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
  HistoryQueryItemCommandDTO
} from '../../../../../backend/shared/model/history-query.model';
import {
  OIBusSouthType,
  SouthConnectorCommandDTO,
  SouthConnectorDTO,
  SouthConnectorManifest
} from '../../../../../backend/shared/model/south-connector.model';
import { SouthConnectorService } from '../../services/south-connector.service';
import { HistoryQueryService } from '../../services/history-query.service';
import { Instant } from '../../../../../backend/shared/model/types';
import { DatetimepickerComponent } from '../../shared/datetimepicker/datetimepicker.component';
import { BackNavigationDirective } from '../../shared/back-navigation.directives';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { HistoryQueryItemsComponent } from '../history-query-items/history-query-items.component';
import { DateTime } from 'luxon';
import { ModalService } from '../../shared/modal.service';
import { TestConnectionResultModalComponent } from '../../shared/test-connection-result-modal/test-connection-result-modal.component';
import { OibHelpComponent } from '../../shared/oib-help/oib-help.component';
import { ResetCacheHistoryQueryModalComponent } from '../reset-cache-history-query-modal/reset-cache-history-query-modal.component';
import { SouthItemSettings, SouthSettings } from '../../../../../backend/shared/model/south-settings.model';
import { NorthSettings } from '../../../../../backend/shared/model/north-settings.model';
import { dateTimeRangeValidatorBuilder } from '../../shared/form/validators';
import { OIBusNorthTypeEnumPipe } from '../../shared/oibus-north-type-enum.pipe';
import { OIBusSouthTypeEnumPipe } from '../../shared/oibus-south-type-enum.pipe';
import { TransformerDTO, TransformerDTOWithOptions } from '../../../../../backend/shared/model/transformer.model';
import { TransformerService } from '../../services/transformer.service';
import { CertificateService } from '../../services/certificate.service';
import { CertificateDTO } from '../../../../../backend/shared/model/certificate.model';
import { NorthTransformersComponent } from '../../north/north-transformers/north-transformers.component';
import { addAttributeToForm, addEnablingConditions } from '../../shared/form/dynamic-form.builder';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../shared/form/form-validation-directives';
import { OIBusScanModeFormControlComponent } from '../../shared/form/oibus-scan-mode-form-control/oibus-scan-mode-form-control.component';
import { OIBusScanModeAttribute } from '../../../../../backend/shared/model/form.model';
import { OIBusObjectFormControlComponent } from '../../shared/form/oibus-object-form-control/oibus-object-form-control.component';

@Component({
  selector: 'oib-edit-history-query',
  imports: [
    ReactiveFormsModule,
    TranslateDirective,
    SaveButtonComponent,
    DatetimepickerComponent,
    BackNavigationDirective,
    BoxComponent,
    BoxTitleDirective,
    HistoryQueryItemsComponent,
    OibHelpComponent,
    OIBusNorthTypeEnumPipe,
    OIBusSouthTypeEnumPipe,
    NorthTransformersComponent,
    OI_FORM_VALIDATION_DIRECTIVES,
    OIBusScanModeFormControlComponent,
    OIBusObjectFormControlComponent
  ],
  templateUrl: './edit-history-query.component.html',
  styleUrl: './edit-history-query.component.scss'
})
export class EditHistoryQueryComponent implements OnInit {
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

  mode: 'create' | 'edit' = 'create';
  historyId!: string;
  historyQuery: HistoryQueryDTO<SouthSettings, NorthSettings, SouthItemSettings> | null = null;
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

  form: FormGroup<{
    name: FormControl<string>;
    description: FormControl<string>;
    startTime: FormControl<Instant>;
    endTime: FormControl<Instant>;
    caching: FormGroup<{
      trigger: FormGroup<{
        scanModeId: FormControl<string | null>;
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
    northTransformers: FormControl<Array<TransformerDTOWithOptions>>;
  }> | null = null;

  inMemoryItems: Array<HistoryQueryItemCommandDTO<SouthItemSettings>> = [];
  scanModeAttribute: OIBusScanModeAttribute = {
    type: 'scan-mode',
    key: 'scanModeId',
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
      this.route.paramMap,
      this.route.queryParamMap
    ])
      .pipe(
        switchMap(([scanModes, certificates, transformers, params, queryParams]) => {
          this.scanModes = scanModes.filter(scanMode => scanMode.id !== 'subscription');
          this.certificates = certificates;
          this.transformers = transformers;

          const paramHistoryQueryId = params.get('historyQueryId');
          const paramDuplicateHistoryQueryId = queryParams.get('duplicate');
          const southId = queryParams.get('southId');
          const northId = queryParams.get('northId') || '';

          let historyQueryObs: Observable<null | HistoryQueryDTO<SouthSettings, NorthSettings, SouthItemSettings>> = of(null);
          let northObs: Observable<null | NorthConnectorDTO<NorthSettings>> = of(null);
          let southObs: Observable<null | SouthConnectorDTO<SouthSettings, SouthItemSettings>> = of(null);

          // if there is a History ID, we are editing a South connector
          if (paramHistoryQueryId) {
            this.mode = 'edit';
            this.historyId = paramHistoryQueryId;
            this.saveItemChangesDirectly = true;
            historyQueryObs = this.historyQueryService.get(paramHistoryQueryId);
          }
          // fetch the existing history query in case of duplicate
          else if (paramDuplicateHistoryQueryId) {
            this.mode = 'create';
            this.historyId = 'create';
            this.duplicateId = paramDuplicateHistoryQueryId;
            this.saveItemChangesDirectly = false;
            historyQueryObs = this.historyQueryService.get(paramDuplicateHistoryQueryId);
          }
          // otherwise, we are creating one
          else {
            // In creation mode, check if we create a history query from new or existing connectors
            this.mode = 'create';
            this.historyId = 'create';
            this.saveItemChangesDirectly = false;
            if (southId) {
              southObs = this.southConnectorService.get(southId);
            } else {
              this.southType = queryParams.get('southType') || '';
            }
            if (northId) {
              northObs = this.northConnectorService.get(northId);
            } else {
              this.northType = queryParams.get('northType') || '';
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
                id: null // we need to remove the exiting ids
              }));
            }
          }
          // creating new from an existing south and north connector
          else {
            if (southConnector) {
              this.southType = southConnector.type;
              this.fromSouthId = southConnector.id;
              this.inMemoryItems = southConnector.items.map(item => ({
                ...item,
                id: null, // we need to remove the exiting ids
                scanModeId: undefined // remove scanModeId retrieved from south connector
              }));
            }
            if (northConnector) {
              this.northType = northConnector.type;
              this.fromNorthId = northConnector.id;
            }
          }

          return combineLatest([
            this.northConnectorService.getNorthConnectorTypeManifest(this.northType),
            this.southConnectorService.getSouthConnectorTypeManifest(this.southType),
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

  buildForm(
    northConnector: NorthConnectorDTO<NorthSettings> | null,
    southConnector: SouthConnectorDTO<SouthSettings, SouthItemSettings> | null
  ) {
    this.form = this.fb.group({
      name: ['', Validators.required],
      description: '',
      startTime: [DateTime.now().minus({ days: 1 }).toUTC().toISO()!, [dateTimeRangeValidatorBuilder('start')]],
      endTime: [DateTime.now().toUTC().toISO()!, [dateTimeRangeValidatorBuilder('end')]],
      caching: this.fb.group({
        trigger: this.fb.group({
          scanModeId: this.fb.control<string | null>(null, Validators.required),
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
          retentionDuration: [72, Validators.required]
        }),
        archive: this.fb.group({
          enabled: [false, Validators.required],
          retentionDuration: [72, Validators.required]
        })
      }),
      northSettings: this.fb.group({}),
      southSettings: this.fb.group({}),
      northTransformers: [[] as Array<TransformerDTOWithOptions>]
    });
    for (const attribute of this.northManifest!.settings.attributes) {
      addAttributeToForm(this.fb, this.form.controls.northSettings, attribute);
    }
    addEnablingConditions(this.form.controls.northSettings, this.northManifest!.settings.enablingConditions);

    for (const attribute of this.southManifest!.settings.attributes) {
      addAttributeToForm(this.fb, this.form.controls.southSettings, attribute);
    }
    addEnablingConditions(this.form.controls.southSettings, this.southManifest!.settings.enablingConditions);

    // when changing one of the dates, the other should re-evaluate errors
    this.form.controls.startTime.valueChanges.subscribe(() => {
      this.form?.controls.endTime.updateValueAndValidity({ emitEvent: false });
    });
    this.form.controls.endTime.valueChanges.subscribe(() => {
      this.form?.controls.startTime.updateValueAndValidity({ emitEvent: false });
    });
    // if we have a south connector, we initialize the values
    if (this.historyQuery) {
      this.form.patchValue(this.historyQuery);
    } else {
      if (southConnector) {
        this.form.controls.southSettings.patchValue(southConnector.settings);
      }
      if (northConnector) {
        this.form.controls.northSettings.patchValue(northConnector.settings);
        this.form.controls.caching.patchValue(northConnector.caching);
        this.form.controls.northTransformers.patchValue(northConnector.transformers);
      }
      // we should provoke all value changes to make sure fields are properly hidden and disabled
      this.form.setValue(this.form.getRawValue());
    }
  }

  save() {
    if (!this.form!.valid) {
      return;
    }

    const formValue = this.form!.value;
    const command: HistoryQueryCommandDTO<SouthSettings, NorthSettings, SouthItemSettings> = {
      name: formValue.name!,
      description: formValue.description!,
      startTime: formValue.startTime!,
      endTime: formValue.endTime!,
      northType: this.northType as OIBusNorthType,
      southType: this.southType as OIBusSouthType,
      southSettings: formValue.southSettings,
      northSettings: formValue.northSettings,
      caching: {
        trigger: {
          scanModeId: formValue.caching!.trigger!.scanModeId!,
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
      northTransformers: formValue.northTransformers!.map(element => ({
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

  createOrUpdateHistoryQuery(command: HistoryQueryCommandDTO<SouthSettings, NorthSettings, SouthItemSettings>, resetCache: boolean): void {
    let createOrUpdate: Observable<HistoryQueryDTO<SouthSettings, NorthSettings, SouthItemSettings>>;
    // if we are editing
    if (this.mode === 'edit') {
      createOrUpdate = this.historyQueryService.update(this.historyQuery!.id, command, resetCache).pipe(
        tap(() => this.notificationService.success('history-query.updated', { name: command.name })),
        switchMap(() => this.historyQueryService.get(this.historyQuery!.id))
      );
    } else {
      createOrUpdate = this.historyQueryService
        .create(command, this.fromSouthId, this.fromNorthId, this.duplicateId)
        .pipe(tap(() => this.notificationService.success('history-query.created', { name: command.name })));
    }
    createOrUpdate.pipe(this.state.pendingUntilFinalization()).subscribe(historyQuery => {
      this.router.navigate(['/history-queries', historyQuery.id]);
    });
  }

  updateInMemoryItems(items: Array<HistoryQueryItemCommandDTO<SouthItemSettings>> | null) {
    if (items) {
      this.inMemoryItems = items;
    } else {
      this.historyQueryService.get(this.historyQuery!.id).subscribe(historyQuery => {
        this.historyQuery!.items = historyQuery.items;
        this.historyQuery = JSON.parse(JSON.stringify(this.historyQuery)); // Used to force a refresh in a history query item list
      });
    }
  }

  test(type: 'south' | 'north') {
    this.form?.markAllAsTouched();

    if (!this.form?.valid) {
      return;
    }

    const historyQueryId = this.historyQuery?.id ?? null;
    let command: SouthConnectorCommandDTO<SouthSettings, SouthItemSettings> | NorthConnectorCommandDTO<NorthSettings>;
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
    component.runHistoryQueryTest(type, command, historyQueryId, fromConnectorId ? fromConnectorId : null);
  }

  get southConnectorCommand() {
    const formValue = this.form!.value;
    return {
      type: this.southManifest!.id,
      settings: formValue.southSettings,
      items: this.inMemoryItems
    } as SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>;
  }

  get northConnectorCommand() {
    const formValue = this.form!.value;

    return {
      type: this.northManifest!.id,
      settings: formValue.northSettings,
      caching: formValue.caching
    } as NorthConnectorCommandDTO<NorthSettings>;
  }
}
