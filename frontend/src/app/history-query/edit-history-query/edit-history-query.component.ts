import { Component, OnInit, inject } from '@angular/core';

import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { ObservableState, SaveButtonComponent } from '../../shared/save-button/save-button.component';
import { formDirectives } from '../../shared/form-directives';
import { FormControl, FormGroup, NonNullableFormBuilder, Validators } from '@angular/forms';
import { NotificationService } from '../../shared/notification.service';
import { ActivatedRoute, Router } from '@angular/router';
import { combineLatest, Observable, of, switchMap, tap } from 'rxjs';
import { FormComponent } from '../../shared/form/form.component';
import { OibFormControl } from '../../../../../backend/shared/model/form.model';
import { ScanModeDTO } from '../../../../../backend/shared/model/scan-mode.model';
import { ScanModeService } from '../../services/scan-mode.service';
import {
  NorthConnectorCommandDTO,
  NorthConnectorDTO,
  NorthConnectorManifest,
  OIBusNorthType
} from '../../../../../backend/shared/model/north-connector.model';
import { NorthConnectorService } from '../../services/north-connector.service';
import { OibScanModeComponent } from '../../shared/form/oib-scan-mode/oib-scan-mode.component';
import { createFormGroup, groupFormControlsByRow } from '../../shared/form-utils';
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
import { dateTimeRangeValidatorBuilder } from '../../shared/validators';
import { OIBusNorthTypeEnumPipe } from '../../shared/oibus-north-type-enum.pipe';
import { OIBusSouthTypeEnumPipe } from '../../shared/oibus-south-type-enum.pipe';
import { CanComponentDeactivate } from '../../shared/unsaved-changes.guard';
import { UnsavedChangesConfirmationService } from '../../shared/unsaved-changes-confirmation.service';

@Component({
  selector: 'oib-edit-history-query',
  imports: [
    TranslateDirective,
    ...formDirectives,
    SaveButtonComponent,
    FormComponent,
    OibScanModeComponent,
    DatetimepickerComponent,
    BackNavigationDirective,
    BoxComponent,
    BoxTitleDirective,
    HistoryQueryItemsComponent,
    OibHelpComponent,
    TranslatePipe,
    OIBusNorthTypeEnumPipe,
    OIBusSouthTypeEnumPipe
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
  private modalService = inject(ModalService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private unsavedChangesConfirmation = inject(UnsavedChangesConfirmationService);

  mode: 'create' | 'edit' = 'create';
  historyId!: string;
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
  saveItemChangesDirectly!: boolean;

  historyQueryForm: FormGroup<{
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
  }> | null = null;

  inMemoryItems: Array<HistoryQueryItemCommandDTO<SouthItemSettings>> = [];

  ngOnInit() {
    combineLatest([this.scanModeService.list(), this.route.paramMap, this.route.queryParamMap])
      .pipe(
        switchMap(([scanModes, params, queryParams]) => {
          this.scanModes = scanModes.filter(scanMode => scanMode.id !== 'subscription');

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

          // creating/duplicating history query
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
                id: null // we need to remove the exiting ids
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
          northSettings: createFormGroup(northManifest.settings, this.fb),
          southSettings: createFormGroup(southManifest.settings, this.fb)
        });

        if (this.historyQuery) {
          this.historyQueryForm.patchValue(this.historyQuery);
        } else {
          if (southConnector) {
            this.historyQueryForm.controls.southSettings.patchValue(southConnector.settings);
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

  canDeactivate(): Observable<boolean> | boolean {
    if (this.historyQueryForm?.dirty) {
      return this.unsavedChangesConfirmation.confirmUnsavedChanges();
    }
    return true;
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
        tap(() => {
          this.notificationService.success('history-query.updated', { name: command.name });
          this.historyQueryForm?.markAsPristine();
        }),
        switchMap(() => this.historyQueryService.get(this.historyQuery!.id))
      );
    } else {
      createOrUpdate = this.historyQueryService.create(command, this.fromSouthId, this.fromNorthId, this.duplicateId).pipe(
        tap(() => {
          this.notificationService.success('history-query.created', { name: command.name });
          this.historyQueryForm?.markAsPristine();
        })
      );
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
    const formValue = this.historyQueryForm!.value;
    return {
      type: this.southManifest!.id,
      settings: formValue.southSettings,
      items: this.inMemoryItems
    } as SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>;
  }

  get northConnectorCommand() {
    const formValue = this.historyQueryForm!.value;

    return {
      type: this.northManifest!.id,
      settings: formValue.northSettings,
      caching: formValue.caching
    } as NorthConnectorCommandDTO<NorthSettings>;
  }
}
