import { Component, OnInit, inject } from '@angular/core';

import { TranslateModule } from '@ngx-translate/core';
import { ObservableState, SaveButtonComponent } from '../../shared/save-button/save-button.component';
import { formDirectives } from '../../shared/form-directives';
import { AbstractControl, FormControl, FormGroup, NonNullableFormBuilder, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { NotificationService } from '../../shared/notification.service';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest, Observable, of, switchMap, tap } from 'rxjs';
import { FormComponent } from '../../shared/form/form.component';
import { OibFormControl } from '../../../../../shared/model/form.model';
import { ScanModeDTO } from '../../../../../shared/model/scan-mode.model';
import { ScanModeService } from '../../services/scan-mode.service';
import { NorthConnectorCommandDTO, NorthConnectorDTO, NorthConnectorManifest } from '../../../../../shared/model/north-connector.model';
import { NorthConnectorService } from '../../services/north-connector.service';
import { OibScanModeComponent } from '../../shared/form/oib-scan-mode/oib-scan-mode.component';
import { createFormGroup, groupFormControlsByRow } from '../../shared/form-utils';
import { HistoryQueryCommandDTO, HistoryQueryDTO, HistoryQueryItemCommandDTO } from '../../../../../shared/model/history-query.model';
import { SouthConnectorCommandDTO, SouthConnectorDTO, SouthConnectorManifest } from '../../../../../shared/model/south-connector.model';
import { SouthConnectorService } from '../../services/south-connector.service';
import { HistoryQueryService } from '../../services/history-query.service';
import { Instant } from '../../../../../shared/model/types';
import { DatetimepickerComponent } from '../../shared/datetimepicker/datetimepicker.component';
import { BackNavigationDirective } from '../../shared/back-navigation.directives';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { SouthItemsComponent } from '../../south/south-items/south-items.component';
import { HistoryQueryItemsComponent } from '../history-query-items/history-query-items.component';
import { DateTime } from 'luxon';
import { ModalService } from '../../shared/modal.service';
import { TestConnectionResultModalComponent } from '../../shared/test-connection-result-modal/test-connection-result-modal.component';
import { OibHelpComponent } from '../../shared/oib-help/oib-help.component';
import { ResetCacheHistoryQueryModalComponent } from '../reset-cache-history-query-modal/reset-cache-history-query-modal.component';
import { SouthItemSettings, SouthSettings } from '../../../../../shared/model/south-settings.model';
import { NorthSettings } from '../../../../../shared/model/north-settings.model';

@Component({
  selector: 'oib-edit-history-query',
  standalone: true,
  imports: [
    TranslateModule,
    ...formDirectives,
    RouterLink,
    SaveButtonComponent,
    FormComponent,
    OibScanModeComponent,
    DatetimepickerComponent,
    BackNavigationDirective,
    BoxComponent,
    BoxTitleDirective,
    SouthItemsComponent,
    HistoryQueryItemsComponent,
    OibHelpComponent
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
  private modalService = inject(ModalService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  mode: 'create' | 'edit' = 'create';
  historyQuery: HistoryQueryDTO<SouthSettings, NorthSettings, SouthItemSettings> | null = null;
  state = new ObservableState();
  northSettingsControls: Array<Array<OibFormControl>> = [];
  southSettingsControls: Array<Array<OibFormControl>> = [];
  scanModes: Array<ScanModeDTO> = [];
  northManifest: NorthConnectorManifest | null = null;
  southManifest: SouthConnectorManifest | null = null;
  southType = '';
  fromSouthId = '';
  northType = '';
  fromNorthId = '';
  duplicateId = '';

  historyQueryForm: FormGroup<{
    name: FormControl<string>;
    description: FormControl<string>;
    startTime: FormControl<Instant>;
    endTime: FormControl<Instant>;
    history: FormGroup<{
      maxInstantPerItem: FormControl<boolean>;
      maxReadInterval: FormControl<number>;
      readDelay: FormControl<number>;
    }>;
    caching: FormGroup<{
      scanModeId: FormControl<string | null>;
      retryInterval: FormControl<number>;
      retryCount: FormControl<number>;
      maxSize: FormControl<number>;
      oibusTimeValues: FormGroup<{ groupCount: FormControl<number>; maxSendCount: FormControl<number> }>;
      rawFiles: FormGroup<{
        sendFileImmediately: FormControl<boolean>;
        archive: FormGroup<{
          enabled: FormControl<boolean>;
          retentionDuration: FormControl<number>;
        }>;
      }>;
    }>;
    northSettings: FormGroup;
    southSharedConnection: FormControl<boolean>;
    southSettings: FormGroup;
  }> | null = null;

  inMemoryItems: Array<HistoryQueryItemCommandDTO<SouthItemSettings>> = [];

  ngOnInit() {
    combineLatest([this.scanModeService.list(), this.route.paramMap, this.route.queryParamMap])
      .pipe(
        switchMap(([scanModes, params, queryParams]) => {
          this.scanModes = scanModes.filter(scanMode => scanMode.id !== 'subscription');

          const paramHistoryQueryId = params.get('historyQueryId');
          const paramDuplicateHistoryQuery = queryParams.get('duplicate');
          const southId = queryParams.get('southId');
          const northId = queryParams.get('northId') || '';

          let historyQueryObs: Observable<null | HistoryQueryDTO<SouthSettings, NorthSettings, SouthItemSettings>> = of(null);
          let northObs: Observable<null | NorthConnectorDTO<NorthSettings>> = of(null);
          let southObs: Observable<null | SouthConnectorDTO<SouthSettings, SouthItemSettings>> = of(null);
          if (paramHistoryQueryId) {
            this.mode = 'edit';
            historyQueryObs = this.historyQueryService.get(paramHistoryQueryId);
          } else if (paramDuplicateHistoryQuery) {
            // fetch the existing history query in case of duplicate
            historyQueryObs = this.historyQueryService.get(paramDuplicateHistoryQuery);
            this.duplicateId = paramDuplicateHistoryQuery;
          } else {
            // In creation mode, check if we create a history query from new or existing connectors
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
          if (historyQuery) {
            this.southType = historyQuery.southType;
            this.northType = historyQuery.northType;
          } else {
            if (southConnector) {
              this.southType = southConnector.type;
              this.fromSouthId = southConnector.id;
              this.inMemoryItems = southConnector.items.map(item => ({
                id: '',
                name: item.name,
                enabled: item.enabled,
                settings: item.settings
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
        this.northManifest = northManifest;
        this.southManifest = southManifest;
        this.northSettingsControls = groupFormControlsByRow(northManifest.settings);
        this.southSettingsControls = groupFormControlsByRow(southManifest.settings);

        this.historyQueryForm = this.fb.group({
          name: ['', Validators.required],
          description: '',
          startTime: [DateTime.now().minus({ days: 1 }).toUTC().toISO()!, [this.dateRangeValidator('start')]],
          endTime: [DateTime.now().toUTC().toISO()!, [this.dateRangeValidator('end')]],
          history: this.fb.group({
            maxInstantPerItem: false,
            maxReadInterval: 0,
            readDelay: 200
          }),
          caching: this.fb.group({
            scanModeId: this.fb.control<string | null>(null, Validators.required),
            retryInterval: [5000, Validators.required],
            retryCount: [3, Validators.required],
            maxSize: [0, Validators.required],
            oibusTimeValues: this.fb.group({
              groupCount: [1000, Validators.required],
              maxSendCount: [10_000, Validators.required]
            }),
            rawFiles: this.fb.group({
              sendFileImmediately: true as boolean,
              archive: this.fb.group({
                enabled: [false, Validators.required],
                retentionDuration: [72, Validators.required]
              })
            })
          }),
          northSettings: createFormGroup(northManifest.settings, this.fb),
          southSettings: createFormGroup(southManifest.settings, this.fb),
          southSharedConnection: this.fb.control(false)
        });

        if (this.historyQuery) {
          this.historyQueryForm.patchValue(this.historyQuery);
        } else {
          if (southConnector) {
            this.historyQueryForm.controls.southSettings.patchValue(southConnector.settings);
            this.historyQueryForm.controls.history.patchValue(southConnector.history);
          }
          if (northConnector) {
            this.historyQueryForm.controls.northSettings.patchValue(northConnector.settings);
            this.historyQueryForm.controls.caching.patchValue(northConnector.caching);
          }
        }

        // we should provoke all value changes to make sure fields are properly hidden and disabled
        this.historyQueryForm.setValue(this.historyQueryForm.getRawValue());

        // when changing one of the dates the other should re-evaluate errors
        this.historyQueryForm.controls.startTime.valueChanges.subscribe(() => {
          this.historyQueryForm?.controls.endTime.updateValueAndValidity({ emitEvent: false });
        });
        this.historyQueryForm.controls.endTime.valueChanges.subscribe(() => {
          this.historyQueryForm?.controls.startTime.updateValueAndValidity({ emitEvent: false });
        });
      });
  }

  save() {
    if (!this.historyQueryForm!.valid) {
      return;
    }

    const formValue = this.historyQueryForm!.value;
    const command: HistoryQueryCommandDTO<SouthSettings, NorthSettings, SouthItemSettings> = {
      name: formValue.name!,
      description: formValue.description!,
      startTime: formValue.startTime!,
      endTime: formValue.endTime!,
      northType: this.northType,
      southType: this.southType,
      southSettings: formValue.southSettings,
      southSharedConnection: formValue.southSharedConnection!,
      northSettings: formValue.northSettings,
      history: {
        maxInstantPerItem: formValue.history!.maxInstantPerItem!,
        maxReadInterval: formValue.history!.maxReadInterval!,
        readDelay: formValue.history!.readDelay!
      },
      caching: {
        scanModeId: formValue.caching!.scanModeId!,
        scanModeName: null,
        retryInterval: formValue.caching!.retryInterval!,
        retryCount: formValue.caching!.retryCount!,
        maxSize: formValue.caching!.maxSize!,
        oibusTimeValues: {
          groupCount: formValue.caching!.oibusTimeValues!.groupCount!,
          maxSendCount: formValue.caching!.oibusTimeValues!.maxSendCount!
        },
        rawFiles: {
          sendFileImmediately: formValue.caching!.rawFiles!.sendFileImmediately!,
          archive: {
            enabled: formValue.caching!.rawFiles!.archive!.enabled!,
            retentionDuration: formValue.caching!.rawFiles!.archive!.retentionDuration!
          }
        }
      },
      items: this.historyQuery
        ? this.historyQuery.items.map(item => ({
            id: item.id,
            name: item.name,
            enabled: item.enabled,
            settings: item.settings
          }))
        : this.inMemoryItems
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
        this.historyQuery = JSON.parse(JSON.stringify(this.historyQuery)); // Used to force a refresh in history query item list
      });
    }
  }

  test(type: 'south' | 'north') {
    this.historyQueryForm?.markAllAsTouched();

    if (!this.historyQueryForm?.valid) {
      return;
    }
    const formValue = this.historyQueryForm.value;
    const historyQueryId = this.historyQuery?.id ?? null;
    let command: SouthConnectorCommandDTO<SouthSettings, SouthItemSettings> | NorthConnectorCommandDTO<NorthSettings>;
    let fromConnectorId;

    if (type === 'south') {
      command = {
        type: this.southManifest!.id,
        settings: formValue.southSettings
      } as SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>;
      fromConnectorId = this.fromSouthId;
    } else {
      command = {
        type: this.northManifest!.id,
        settings: formValue.northSettings
      } as NorthConnectorCommandDTO<NorthSettings>;
      fromConnectorId = this.fromNorthId;
    }

    const modalRef = this.modalService.open(TestConnectionResultModalComponent);
    const component: TestConnectionResultModalComponent = modalRef.componentInstance;
    component.runHistoryQueryTest(type, command, historyQueryId, fromConnectorId.length ? fromConnectorId : null);
  }

  dateRangeValidator(type: 'start' | 'end'): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const startTime = control.parent?.get('startTime')?.value as string;
      const endTime = control.parent?.get('endTime')?.value as string;

      if (!startTime || !endTime) {
        return null;
      }

      const startDateTime = DateTime.fromISO(startTime).startOf('minute');
      const endDateTime = DateTime.fromISO(endTime).startOf('minute');

      if (startDateTime > endDateTime) {
        return type === 'start' ? { badStartDateRange: true } : { badEndDateRange: true };
      }

      return null;
    };
  }
}
