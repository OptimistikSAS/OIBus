import { Component, OnInit } from '@angular/core';
import { NgForOf, NgIf } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ObservableState, SaveButtonComponent } from '../../shared/save-button/save-button.component';
import { formDirectives } from '../../shared/form-directives';
import { FormControl, FormGroup, NonNullableFormBuilder, Validators } from '@angular/forms';
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
import { HistoryQueryCommandDTO, HistoryQueryDTO } from '../../../../../shared/model/history-query.model';
import {
  SouthConnectorCommandDTO,
  SouthConnectorDTO,
  SouthConnectorItemDTO,
  SouthConnectorManifest
} from '../../../../../shared/model/south-connector.model';
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

@Component({
  selector: 'oib-edit-history-query',
  standalone: true,
  imports: [
    NgIf,
    NgForOf,
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
  mode: 'create' | 'edit' = 'create';
  historyQuery: HistoryQueryDTO | null = null;
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
      groupCount: FormControl<number>;
      maxSendCount: FormControl<number>;
      sendFileImmediately: FormControl<boolean>;
      maxSize: FormControl<number>;
    }>;
    archive: FormGroup<{
      enabled: FormControl<boolean>;
      retentionDuration: FormControl<number>;
    }>;
    northSettings: FormGroup;
    southSettings: FormGroup;
  }> | null = null;

  inMemoryItems: Array<SouthConnectorItemDTO> = [];
  inMemoryItemIdsToDelete: Array<string> = [];

  constructor(
    private historyQueryService: HistoryQueryService,
    private northConnectorService: NorthConnectorService,
    private southConnectorService: SouthConnectorService,
    private fb: NonNullableFormBuilder,
    private notificationService: NotificationService,
    private scanModeService: ScanModeService,
    private modalService: ModalService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    combineLatest([this.scanModeService.list(), this.route.paramMap, this.route.queryParamMap])
      .pipe(
        switchMap(([scanModes, params, queryParams]) => {
          this.scanModes = scanModes.filter(scanMode => scanMode.id !== 'subscription');

          const paramHistoryQueryId = params.get('historyQueryId');
          const paramDuplicateHistoryQuery = queryParams.get('duplicate');
          const southId = queryParams.get('southId');
          const northId = queryParams.get('northId') || '';

          let historyQueryObs: Observable<null | HistoryQueryDTO> = of(null);
          let northObs: Observable<null | NorthConnectorDTO> = of(null);
          let southObs: Observable<null | SouthConnectorDTO> = of(null);
          let southItemsObs: Observable<null | Array<SouthConnectorItemDTO>> = of(null);
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
              southItemsObs = this.southConnectorService.listItems(southId);
            } else {
              this.southType = queryParams.get('southType') || '';
            }
            if (northId) {
              northObs = this.northConnectorService.get(northId);
            } else {
              this.northType = queryParams.get('northType') || '';
            }
          }
          return combineLatest([historyQueryObs, northObs, southObs, southItemsObs]);
        }),
        switchMap(([historyQuery, northConnector, southConnector, items]) => {
          this.historyQuery = historyQuery;
          if (historyQuery) {
            this.southType = historyQuery.southType;
            this.northType = historyQuery.northType;
          } else {
            if (southConnector) {
              this.southType = southConnector.type;
              this.fromSouthId = southConnector.id;
              this.inMemoryItems = items || [];
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
          startTime: DateTime.now().minus({ days: 1 }).toUTC().toISO()!,
          endTime: DateTime.now().toUTC().toISO()!,
          history: this.fb.group({
            maxInstantPerItem: false,
            maxReadInterval: 0,
            readDelay: 200
          }),
          caching: this.fb.group({
            scanModeId: this.fb.control<string | null>(null, Validators.required),
            retryInterval: [5000, Validators.required],
            retryCount: [3, Validators.required],
            groupCount: [1000, Validators.required],
            maxSendCount: [10_000, Validators.required],
            sendFileImmediately: true,
            maxSize: [0, Validators.required]
          }),
          archive: this.fb.group({
            enabled: [false, Validators.required],
            retentionDuration: [72, Validators.required]
          }),
          northSettings: createFormGroup(northManifest.settings, this.fb),
          southSettings: createFormGroup(southManifest.settings, this.fb)
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
            this.historyQueryForm.controls.archive.patchValue(northConnector.archive);
          }
        }

        // we should provoke all value changes to make sure fields are properly hidden and disabled
        this.historyQueryForm.setValue(this.historyQueryForm.getRawValue());
      });
  }

  save() {
    if (!this.historyQueryForm!.valid) {
      return;
    }

    const formValue = this.historyQueryForm!.value;
    const command: HistoryQueryCommandDTO = {
      name: formValue.name!,
      description: formValue.description!,
      startTime: formValue.startTime!,
      endTime: formValue.endTime!,
      northType: this.northType,
      southType: this.southType,
      southSettings: formValue.southSettings,
      northSettings: formValue.northSettings,
      history: {
        maxInstantPerItem: formValue.history!.maxInstantPerItem!,
        maxReadInterval: formValue.history!.maxReadInterval!,
        readDelay: formValue.history!.readDelay!,
        overlap: 0
      },
      caching: {
        scanModeId: formValue.caching!.scanModeId!,
        retryInterval: formValue.caching!.retryInterval!,
        retryCount: formValue.caching!.retryCount!,
        groupCount: formValue.caching!.groupCount!,
        maxSendCount: formValue.caching!.maxSendCount!,
        sendFileImmediately: formValue.caching!.sendFileImmediately!,
        maxSize: formValue.caching!.maxSize!
      },
      archive: {
        enabled: formValue.archive!.enabled!,
        retentionDuration: formValue.archive!.retentionDuration!
      }
    };
    this.createOrUpdateHistoryQuery(command);
  }

  createOrUpdateHistoryQuery(command: HistoryQueryCommandDTO): void {
    let createOrUpdate: Observable<HistoryQueryDTO>;
    // if we are editing
    if (this.mode === 'edit') {
      createOrUpdate = this.historyQueryService
        .update(this.historyQuery!.id, command, this.inMemoryItems, this.inMemoryItemIdsToDelete)
        .pipe(
          tap(() => this.notificationService.success('history-query.updated', { name: command.name })),
          switchMap(() => this.historyQueryService.get(this.historyQuery!.id))
        );
    } else {
      createOrUpdate = this.historyQueryService
        .create(command, this.inMemoryItems, this.fromSouthId, this.fromNorthId, this.duplicateId)
        .pipe(tap(() => this.notificationService.success('history-query.created', { name: command.name })));
    }
    createOrUpdate.pipe(this.state.pendingUntilFinalization()).subscribe(historyQuery => {
      this.router.navigate(['/history-queries', historyQuery.id]);
    });
  }

  updateInMemoryItems({ items, itemIdsToDelete }: { items: Array<SouthConnectorItemDTO>; itemIdsToDelete: Array<string> }) {
    this.inMemoryItems = items;
    this.inMemoryItemIdsToDelete = itemIdsToDelete;
  }

  test(type: 'south' | 'north') {
    this.historyQueryForm?.markAllAsTouched();

    if (!this.historyQueryForm?.valid) {
      return;
    }
    const formValue = this.historyQueryForm.value;
    const historyQueryId = this.historyQuery?.id ?? null;
    let command: SouthConnectorCommandDTO | NorthConnectorCommandDTO;
    let fromConnectorId;

    if (type === 'south') {
      command = {
        type: this.southManifest!.id,
        settings: formValue.southSettings
      } as SouthConnectorCommandDTO;
      fromConnectorId = this.fromSouthId;
    } else {
      command = {
        type: this.northManifest!.id,
        archive: { enabled: false },
        settings: formValue.northSettings
      } as NorthConnectorCommandDTO;
      fromConnectorId = this.fromNorthId;
    }

    const modalRef = this.modalService.open(TestConnectionResultModalComponent);
    const component: TestConnectionResultModalComponent = modalRef.componentInstance;
    component.runHistoryQueryTest(type, command, historyQueryId, fromConnectorId.length ? fromConnectorId : null);
  }
}
