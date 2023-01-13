import { Component, OnInit } from '@angular/core';
import { NgForOf, NgIf } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ObservableState, SaveButtonComponent } from '../../shared/save-button/save-button.component';
import { formDirectives } from '../../shared/form-directives';
import { FormGroup, NonNullableFormBuilder, Validators } from '@angular/forms';
import { NotificationService } from '../../shared/notification.service';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest, Observable, of, switchMap, tap } from 'rxjs';
import { FormComponent } from '../../shared/form/form.component';
import { OibFormControl } from '../../model/form.model';
import { ScanModeDTO } from '../../model/scan-mode.model';
import { ProxyDTO } from '../../model/proxy.model';
import { ScanModeService } from '../../services/scan-mode.service';
import { ProxyService } from '../../services/proxy.service';
import { NorthConnectorCommandDTO, NorthConnectorDTO, NorthConnectorManifest } from '../../model/north-connector.model';
import { NorthConnectorService } from '../../services/north-connector.service';
import { OibScanModeComponent } from '../../shared/form/oib-scan-mode/oib-scan-mode.component';
import { createInput, getRowSettings } from '../../shared/utils';

@Component({
  selector: 'oib-edit-north',
  standalone: true,
  imports: [NgIf, NgForOf, TranslateModule, ...formDirectives, RouterLink, SaveButtonComponent, FormComponent, OibScanModeComponent],
  templateUrl: './edit-north.component.html',
  styleUrls: ['./edit-north.component.scss']
})
export class EditNorthComponent implements OnInit {
  mode: 'create' | 'edit' = 'create';
  northConnector: NorthConnectorDTO | null = null;
  state = new ObservableState();
  loading = true;
  northSettingsSchema: Array<Array<OibFormControl>> = [];
  scanModes: Array<ScanModeDTO> = [];
  proxies: Array<ProxyDTO> = [];
  northType = '';
  manifest: NorthConnectorManifest | null = null;
  northForm = this.fb.group({
    name: ['', Validators.required],
    description: '',
    enabled: false,
    settings: this.fb.record({}),
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
    })
  });

  constructor(
    private northConnectorService: NorthConnectorService,
    private fb: NonNullableFormBuilder,
    private notificationService: NotificationService,
    private scanModeService: ScanModeService,
    private proxyService: ProxyService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    combineLatest([this.proxyService.getProxies(), this.scanModeService.getScanModes(), this.route.paramMap, this.route.queryParamMap])
      .pipe(
        switchMap(([proxies, scanModes, params, queryParams]) => {
          this.proxies = proxies;
          this.scanModes = scanModes;
          let paramNorthId = params.get('northId');
          this.northType = queryParams.get('type') || '';
          // if there is a North ID, we are editing a North connector
          if (paramNorthId) {
            this.mode = 'edit';
          } else {
            // fetch the North connector in case of duplicate
            paramNorthId = queryParams.get('duplicate');
          }

          if (paramNorthId) {
            return this.northConnectorService.getNorthConnector(paramNorthId).pipe(this.state.pendingUntilFinalization());
          }
          // otherwise, we are creating one
          return of(null);
        }),
        switchMap(northConnector => {
          this.northConnector = northConnector;
          if (northConnector) {
            this.northType = northConnector.type;
            this.northForm.patchValue({
              name: northConnector.name,
              description: northConnector.description,
              enabled: northConnector.enabled
            });
          }
          // If a North connector is not retrieved, the types are needed to create a new connector
          return this.northConnectorService.getNorthConnectorTypeManifest(this.northType);
        })
      )
      .subscribe(manifest => {
        if (!manifest) {
          this.loading = false;
          return;
        }
        const rowList = getRowSettings(manifest.settings, this.northConnector?.settings);

        this.manifest = manifest;
        this.northSettingsSchema = rowList;

        const inputsToSubscribeTo: Set<string> = new Set();
        const settingsForm = this.northForm.controls.settings;
        this.northSettingsSchema.forEach(row => {
          row.forEach(settings => {
            createInput(settings, settingsForm);
            if (settings.conditionalDisplay) {
              Object.entries(settings.conditionalDisplay).forEach(([key]) => {
                // Keep only one occurrence of each input to subscribe to
                inputsToSubscribeTo.add(key);
              });
            }
          });
        });

        // Each input that must be monitored is subscribed
        inputsToSubscribeTo.forEach(input => {
          // Check once with initialized value
          this.disableInputs(input, settingsForm.controls[input].value as string | number | boolean, settingsForm);
          // Check on value changes
          settingsForm.controls[input].valueChanges.subscribe(inputValue => {
            // When a value of such an input changes, check if its inputValue implies to disable another input
            this.disableInputs(input, inputValue as string | number | boolean, settingsForm);
          });
        });

        this.loading = false;
      });
  }

  private disableInputs(input: string, inputValue: string | number | boolean, settingsForm: FormGroup) {
    this.northSettingsSchema.forEach(row => {
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

  createOrUpdateNorthConnector(command: NorthConnectorCommandDTO): void {
    let createOrUpdate: Observable<NorthConnectorDTO>;
    // if we are editing
    if (this.mode === 'edit') {
      createOrUpdate = this.northConnectorService.updateNorthConnector(this.northConnector!.id, command).pipe(
        tap(() => this.notificationService.success('north.updated', { name: command.name })),
        switchMap(() => this.northConnectorService.getNorthConnector(this.northConnector!.id))
      );
    } else {
      createOrUpdate = this.northConnectorService
        .createNorthConnector(command)
        .pipe(tap(() => this.notificationService.success('north.created', { name: command.name })));
    }
    createOrUpdate.pipe(this.state.pendingUntilFinalization()).subscribe(northConnector => {
      this.router.navigate(['/north', northConnector.id]);
    });
  }

  save() {
    if (!this.northForm.valid) {
      return;
    }

    const formValue = this.northForm.value;
    const command: NorthConnectorCommandDTO = {
      name: formValue.name!,
      type: this.northType,
      description: formValue.description!,
      enabled: formValue.enabled!,
      settings: formValue.settings!,
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
    this.createOrUpdateNorthConnector(command);
  }
}
