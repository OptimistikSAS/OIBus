import { Component, OnInit } from '@angular/core';
import { NgForOf, NgIf } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { SouthConnectorCommandDTO, SouthConnectorDTO } from '../../model/south-connector.model';
import { SouthConnectorService } from '../../services/south-connector.service';
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
import { createInput, getRowSettings } from '../../shared/utils';

@Component({
  selector: 'oib-edit-south',
  standalone: true,
  imports: [NgIf, NgForOf, TranslateModule, ...formDirectives, RouterLink, SaveButtonComponent, FormComponent],
  templateUrl: './edit-south.component.html',
  styleUrls: ['./edit-south.component.scss']
})
export class EditSouthComponent implements OnInit {
  mode: 'create' | 'edit' = 'create';
  southConnector: SouthConnectorDTO | null = null;
  state = new ObservableState();
  loading = true;
  southSettingsSchema: Array<Array<OibFormControl>> = [];
  scanModes: Array<ScanModeDTO> = [];
  proxies: Array<ProxyDTO> = [];
  southType = '';
  southForm = this.fb.group({
    name: ['', Validators.required],
    description: '',
    enabled: false,
    settings: this.fb.record({})
  });

  constructor(
    private southConnectorService: SouthConnectorService,
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
          let paramSouthId = params.get('southId');
          this.southType = queryParams.get('type') || '';
          // if there is a South ID, we are editing a South connector
          if (paramSouthId) {
            this.mode = 'edit';
          } else {
            // fetch the South connector in case of duplicate
            paramSouthId = queryParams.get('duplicate');
          }

          if (paramSouthId) {
            return this.southConnectorService.getSouthConnector(paramSouthId).pipe(this.state.pendingUntilFinalization());
          }
          // otherwise, we are creating one
          return of(null);
        }),
        switchMap(southConnector => {
          this.southConnector = southConnector;
          if (southConnector) {
            this.southType = southConnector.type;
            this.southForm.patchValue({
              name: southConnector.name,
              description: southConnector.description,
              enabled: southConnector.enabled
            });
          }
          // If a south connector is not retrieved, the types are needed to create a new connector
          return this.southConnectorService.getSouthConnectorTypeManifest(this.southType);
        })
      )
      .subscribe(manifest => {
        if (!manifest) {
          this.loading = false;
          return;
        }
        const rowList = getRowSettings(manifest.settings, this.southConnector?.settings);

        this.southSettingsSchema = rowList;
        const inputsToSubscribeTo: Set<string> = new Set();
        const settingsForm = this.southForm.controls.settings;
        this.southSettingsSchema.forEach(row => {
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
    this.southSettingsSchema.forEach(row => {
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

  createOrUpdateSouthConnector(command: SouthConnectorCommandDTO): void {
    let createOrUpdate: Observable<SouthConnectorDTO>;
    // if we are editing
    if (this.mode === 'edit') {
      createOrUpdate = this.southConnectorService.updateSouthConnector(this.southConnector!.id, command).pipe(
        tap(() => this.notificationService.success('south.updated', { name: command.name })),
        switchMap(() => this.southConnectorService.getSouthConnector(this.southConnector!.id))
      );
    } else {
      createOrUpdate = this.southConnectorService
        .createSouthConnector(command)
        .pipe(tap(() => this.notificationService.success('south.created', { name: command.name })));
    }
    createOrUpdate.pipe(this.state.pendingUntilFinalization()).subscribe(southConnector => {
      this.router.navigate(['/south', southConnector.id]);
    });
  }

  save() {
    if (!this.southForm.valid) {
      return;
    }

    const formValue = this.southForm.value;
    const command: SouthConnectorCommandDTO = {
      name: formValue.name!,
      type: this.southType,
      description: formValue.description!,
      enabled: formValue.enabled!,
      settings: formValue.settings!
    };
    this.createOrUpdateSouthConnector(command);
  }
}
