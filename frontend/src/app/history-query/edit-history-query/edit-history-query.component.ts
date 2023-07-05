import { Component, OnInit } from '@angular/core';
import { NgForOf, NgIf } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ObservableState, SaveButtonComponent } from '../../shared/save-button/save-button.component';
import { formDirectives } from '../../shared/form-directives';
import { FormControl, FormGroup, NonNullableFormBuilder, Validators } from '@angular/forms';
import { NotificationService } from '../../shared/notification.service';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest, of, switchMap, tap } from 'rxjs';
import { FormComponent } from '../../shared/form/form.component';
import { OibFormControl } from '../../../../../shared/model/form.model';
import { ScanModeDTO } from '../../../../../shared/model/scan-mode.model';
import { ScanModeService } from '../../services/scan-mode.service';
import { NorthConnectorManifest } from '../../../../../shared/model/north-connector.model';
import { NorthConnectorService } from '../../services/north-connector.service';
import { OibScanModeComponent } from '../../shared/form/oib-scan-mode/oib-scan-mode.component';
import { createFormGroup, groupFormControlsByRow } from '../../shared/form-utils';
import { HistoryQueryCommandDTO, HistoryQueryDTO } from '../../../../../shared/model/history-query.model';
import { SouthConnectorManifest } from '../../../../../shared/model/south-connector.model';
import { SouthConnectorService } from '../../services/south-connector.service';
import { HistoryQueryService } from '../../services/history-query.service';
import { Instant } from '../../../../../shared/model/types';
import { DatetimepickerComponent } from '../../shared/datetimepicker/datetimepicker.component';
import { BackNavigationDirective } from '../../shared/back-navigation.directives';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { SouthItemsComponent } from '../../south/south-items/south-items.component';
import { HistoryQueryItemsComponent } from '../history-query-items/history-query-items.component';

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
    HistoryQueryItemsComponent
  ],
  templateUrl: './edit-history-query.component.html',
  styleUrls: ['./edit-history-query.component.scss']
})
export class EditHistoryQueryComponent implements OnInit {
  historyQuery: HistoryQueryDTO | null = null;
  state = new ObservableState();
  northSettingsControls: Array<Array<OibFormControl>> = [];
  southSettingsControls: Array<Array<OibFormControl>> = [];
  scanModes: Array<ScanModeDTO> = [];
  northManifest: NorthConnectorManifest | null = null;
  southManifest: SouthConnectorManifest | null = null;

  historyQueryForm: FormGroup<{
    name: FormControl<string>;
    description: FormControl<string>;
    start: FormControl<Instant | null>;
    end: FormControl<Instant | null>;
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

  constructor(
    private historyQueryService: HistoryQueryService,
    private northConnectorService: NorthConnectorService,
    private southConnectorService: SouthConnectorService,
    private fb: NonNullableFormBuilder,
    private notificationService: NotificationService,
    private scanModeService: ScanModeService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    combineLatest([this.scanModeService.list(), this.route.paramMap])
      .pipe(
        switchMap(([scanModes, params]) => {
          this.scanModes = scanModes.filter(scanMode => scanMode.id !== 'subscription');
          return this.historyQueryService.get(params.get('historyQueryId') || '').pipe(this.state.pendingUntilFinalization());
        }),
        switchMap(historyQuery => {
          this.historyQuery = historyQuery;

          return combineLatest([
            of(historyQuery),
            this.northConnectorService.getNorthConnectorTypeManifest(historyQuery.northType),
            this.southConnectorService.getSouthConnectorTypeManifest(historyQuery.southType)
          ]);
        })
      )
      .subscribe(([historyQuery, northManifest, southManifest]) => {
        this.northManifest = northManifest;
        this.southManifest = southManifest;
        this.northSettingsControls = groupFormControlsByRow(northManifest.settings);
        this.southSettingsControls = groupFormControlsByRow(southManifest.settings);

        this.historyQueryForm = this.fb.group({
          name: ['', Validators.required],
          description: '',
          start: null as Instant | null,
          end: null as Instant | null,
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
            retentionDuration: [720, Validators.required]
          }),
          northSettings: createFormGroup(northManifest.settings, this.fb),
          southSettings: createFormGroup(southManifest.settings, this.fb)
        });

        if (historyQuery) {
          this.historyQueryForm.patchValue(historyQuery);
        }
      });
  }

  save() {
    if (!this.historyQueryForm!.valid || !this.historyQuery) {
      return;
    }

    const formValue = this.historyQueryForm!.value;
    const command: HistoryQueryCommandDTO = {
      name: formValue.name!,
      description: formValue.description!,
      startTime: formValue.start!,
      endTime: formValue.end!,
      northType: this.historyQuery.northType,
      southType: this.historyQuery.southType,
      southSettings: formValue.southSettings,
      northSettings: formValue.northSettings,
      history: {
        maxInstantPerItem: formValue.history!.maxInstantPerItem!,
        maxReadInterval: formValue.history!.maxReadInterval!,
        readDelay: formValue.history!.readDelay!
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
    this.historyQueryService
      .update(this.historyQuery!.id, command)
      .pipe(
        tap(() => this.notificationService.success('history-query.updated', { name: command.name })),
        switchMap(() => this.historyQueryService.get(this.historyQuery!.id))
      )
      .pipe(this.state.pendingUntilFinalization())
      .subscribe(historyQuery => {
        this.router.navigate(['/history-queries', historyQuery.id]);
      });
  }
}
