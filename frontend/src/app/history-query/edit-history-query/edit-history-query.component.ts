import { Component, OnInit } from '@angular/core';
import { NgForOf, NgIf } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ObservableState, SaveButtonComponent } from '../../shared/save-button/save-button.component';
import { formDirectives } from '../../shared/form-directives';
import { FormGroup, NonNullableFormBuilder, Validators } from '@angular/forms';
import { NotificationService } from '../../shared/notification.service';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest, switchMap, tap } from 'rxjs';
import { FormComponent } from '../../shared/form/form.component';
import { OibFormControl } from '../../../../../shared/model/form.model';
import { ScanModeDTO } from '../../../../../shared/model/scan-mode.model';
import { ProxyDTO } from '../../../../../shared/model/proxy.model';
import { ScanModeService } from '../../services/scan-mode.service';
import { ProxyService } from '../../services/proxy.service';
import { NorthConnectorManifest } from '../../../../../shared/model/north-connector.model';
import { NorthConnectorService } from '../../services/north-connector.service';
import { OibScanModeComponent } from '../../shared/form/oib-scan-mode/oib-scan-mode.component';
import { createInput, getRowSettings } from '../../shared/utils';
import { HistoryQueryCommandDTO, HistoryQueryDTO } from '../../../../../shared/model/history-query.model';
import { SouthConnectorManifest } from '../../../../../shared/model/south-connector.model';
import { SouthConnectorService } from '../../services/south-connector.service';
import { HistoryQueryService } from '../../services/history-query.service';
import { Instant } from '../../../../../shared/model//types';
import { DatetimepickerComponent } from '../../shared/datetimepicker/datetimepicker.component';

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
    DatetimepickerComponent
  ],
  templateUrl: './edit-history-query.component.html',
  styleUrls: ['./edit-history-query.component.scss']
})
export class EditHistoryQueryComponent implements OnInit {
  historyQuery: HistoryQueryDTO | null = null;
  state = new ObservableState();
  loading = true;
  northSettingsSchema: Array<Array<OibFormControl>> = [];
  southSettingsSchema: Array<Array<OibFormControl>> = [];
  scanModes: Array<ScanModeDTO> = [];
  proxies: Array<ProxyDTO> = [];
  northManifest: NorthConnectorManifest | null = null;
  southManifest: SouthConnectorManifest | null = null;

  historyQueryForm = this.fb.group({
    name: ['', Validators.required],
    description: '',
    enabled: false,
    start: null as Instant | null,
    end: null as Instant | null,
    caching: this.fb.group({
      scanMode: [null as ScanModeDTO | null, Validators.required],
      retryInterval: [5000 as number | null, Validators.required],
      retryCount: [3 as number | null, Validators.required],
      groupCount: [1000 as number | null, Validators.required],
      maxSendCount: [10_000 as number | null, Validators.required],
      timeout: [30 as number | null, Validators.required]
    }),
    archive: this.fb.group({
      enabled: [false, Validators.required],
      retentionDuration: [720, Validators.required]
    }),
    north: this.fb.group({
      settings: this.fb.record({})
    }),
    south: this.fb.group({
      settings: this.fb.record({})
    })
  });

  constructor(
    private historyQueryService: HistoryQueryService,
    private northConnectorService: NorthConnectorService,
    private southConnectorService: SouthConnectorService,
    private fb: NonNullableFormBuilder,
    private notificationService: NotificationService,
    private scanModeService: ScanModeService,
    private proxyService: ProxyService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    combineLatest([this.proxyService.getProxies(), this.scanModeService.getScanModes(), this.route.paramMap])
      .pipe(
        switchMap(([proxies, scanModes, params]) => {
          this.proxies = proxies;
          this.scanModes = scanModes;
          return this.historyQueryService.getHistoryQuery(params.get('historyQueryId') || '').pipe(this.state.pendingUntilFinalization());
        }),
        switchMap(historyQuery => {
          this.historyQuery = historyQuery;
          this.historyQueryForm.patchValue({
            name: historyQuery.name,
            description: historyQuery.description,
            enabled: historyQuery.enabled,
            start: historyQuery.startTime,
            end: historyQuery.endTime,
            caching: {
              scanMode: this.scanModes.find(scanMode => scanMode.id === historyQuery.caching.scanModeId),
              groupCount: historyQuery.caching.groupCount,
              retryCount: historyQuery.caching.retryCount,
              retryInterval: historyQuery.caching.retryInterval,
              maxSendCount: historyQuery.caching.maxSendCount,
              timeout: historyQuery.caching.timeout
            },
            archive: historyQuery.archive
          });
          return combineLatest([
            this.northConnectorService.getNorthConnectorTypeManifest(historyQuery.northType),
            this.southConnectorService.getSouthConnectorTypeManifest(historyQuery.southType)
          ]);
        })
      )
      .subscribe(([northManifest, southManifest]) => {
        const northRowList = getRowSettings(northManifest.settings, this.historyQuery!.northSettings);
        const southRowList = getRowSettings(southManifest.settings, this.historyQuery!.southSettings);

        this.northManifest = northManifest;
        this.southManifest = southManifest;
        this.northSettingsSchema = northRowList;
        this.southSettingsSchema = southRowList;

        this.monitorInputs(this.historyQueryForm.controls.north.controls.settings, this.northSettingsSchema);
        this.monitorInputs(this.historyQueryForm.controls.south.controls.settings, this.southSettingsSchema);

        this.loading = false;
      });
  }

  /**
   * Monitor inputs on values changes to adapt the South or North form settings appropriately
   */
  private monitorInputs(settingsForm: FormGroup, settingsSchema: Array<Array<OibFormControl>>) {
    const southInputsToSubscribeTo: Set<string> = new Set();
    settingsSchema.forEach(row => {
      row.forEach(settings => {
        createInput(settings, settingsForm);
        if (settings.conditionalDisplay) {
          Object.entries(settings.conditionalDisplay).forEach(([key]) => {
            // Keep only one occurrence of each input to subscribe to
            southInputsToSubscribeTo.add(key);
          });
        }
      });
    });
    // Each input that must be monitored is subscribed
    southInputsToSubscribeTo.forEach(input => {
      // Check once with initialized value
      this.disableInputs(input, settingsForm.controls[input].value as string | number | boolean, settingsForm, settingsSchema);
      // Check on value changes
      settingsForm.controls[input].valueChanges.subscribe(inputValue => {
        // When a value of such an input changes, check if its inputValue implies to disable another input
        this.disableInputs(input, inputValue as string | number | boolean, settingsForm, settingsSchema);
      });
    });
  }

  private disableInputs(
    input: string,
    inputValue: string | number | boolean,
    settingsForm: FormGroup,
    settingsSchema: Array<Array<OibFormControl>>
  ) {
    settingsSchema.forEach(row => {
      row.forEach(settings => {
        if (settings.conditionalDisplay) {
          Object.entries(settings.conditionalDisplay).forEach(([key, values]) => {
            if (key === input) {
              if (!values.includes(inputValue)) {
                settingsForm.controls[settings.key].disable();
              } else {
                settingsForm.controls[settings.key].enable();
              }
            }
          });
        }
      });
    });
  }

  save() {
    if (!this.historyQueryForm.valid || !this.historyQuery) {
      return;
    }

    const formValue = this.historyQueryForm.value;
    const command: HistoryQueryCommandDTO = {
      name: formValue.name!,
      description: formValue.description!,
      enabled: formValue.enabled!,
      startTime: formValue.start!,
      endTime: formValue.end!,
      northType: this.historyQuery.northType,
      southType: this.historyQuery.southType,
      southSettings: formValue.south!.settings!,
      northSettings: formValue.north!.settings!,
      caching: {
        scanModeId: formValue.caching!.scanMode!.id,
        retryInterval: formValue.caching!.retryInterval!,
        retryCount: formValue.caching!.retryCount!,
        groupCount: formValue.caching!.groupCount!,
        maxSendCount: formValue.caching!.maxSendCount!,
        timeout: formValue.caching!.timeout!
      },
      archive: {
        enabled: formValue.archive!.enabled!,
        retentionDuration: formValue.archive!.retentionDuration!
      }
    };
    this.historyQueryService
      .updateHistoryQuery(this.historyQuery!.id, command)
      .pipe(
        tap(() => this.notificationService.success('history-query.updated', { name: command.name })),
        switchMap(() => this.historyQueryService.getHistoryQuery(this.historyQuery!.id))
      )
      .pipe(this.state.pendingUntilFinalization())
      .subscribe(historyQuery => {
        this.router.navigate(['/history-queries', historyQuery.id]);
      });
  }
}
