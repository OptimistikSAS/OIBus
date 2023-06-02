import { Component, OnInit } from '@angular/core';
import { NgForOf, NgIf } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { SouthConnectorCommandDTO, SouthConnectorDTO, SouthConnectorManifest } from '../../../../../shared/model/south-connector.model';
import { SouthConnectorService } from '../../services/south-connector.service';
import { ObservableState, SaveButtonComponent } from '../../shared/save-button/save-button.component';
import { formDirectives } from '../../shared/form-directives';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { NotificationService } from '../../shared/notification.service';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest, Observable, of, switchMap, tap } from 'rxjs';
import { FormComponent } from '../../shared/form/form.component';
import { OibFormControl } from '../../../../../shared/model/form.model';
import { ScanModeDTO } from '../../../../../shared/model/scan-mode.model';
import { ProxyDTO } from '../../../../../shared/model/proxy.model';
import { ScanModeService } from '../../services/scan-mode.service';
import { ProxyService } from '../../services/proxy.service';
import { createInput, disableInputs, getRowSettings } from '../../shared/utils';
import { BackNavigationDirective } from '../../shared/back-navigation.directives';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { SouthItemsComponent } from '../south-items/south-items.component';

@Component({
  selector: 'oib-edit-south',
  standalone: true,
  imports: [
    NgIf,
    NgForOf,
    TranslateModule,
    ...formDirectives,
    RouterLink,
    SaveButtonComponent,
    FormComponent,
    BackNavigationDirective,
    BoxComponent,
    BoxTitleDirective,
    SouthItemsComponent
  ],
  templateUrl: './edit-south.component.html',
  styleUrls: ['./edit-south.component.scss']
})
export class EditSouthComponent implements OnInit {
  mode: 'create' | 'edit' = 'create';
  southConnector: SouthConnectorDTO | null = null;
  southType = '';
  state = new ObservableState();

  loading = true;
  southSettingsSchema: Array<Array<OibFormControl>> = [];
  scanModes: Array<ScanModeDTO> = [];
  proxies: Array<ProxyDTO> = [];
  manifest: SouthConnectorManifest | null = null;
  southForm = this.fb.group({
    name: ['', Validators.required],
    description: '',
    enabled: true,
    history: this.fb.group({
      maxInstantPerItem: false,
      maxReadInterval: 0,
      readDelay: 200
    }),
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
    combineLatest([this.proxyService.list(), this.scanModeService.list(), this.route.paramMap, this.route.queryParamMap])
      .pipe(
        switchMap(([proxies, scanModes, params, queryParams]) => {
          this.proxies = proxies;
          this.scanModes = scanModes.filter(scanMode => scanMode.id !== 'subscription');
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
            return this.southConnectorService.get(paramSouthId).pipe(this.state.pendingUntilFinalization());
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
              enabled: southConnector.enabled,
              history: southConnector.history
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
        this.southSettingsSchema = getRowSettings(manifest.settings, this.southConnector?.settings);
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
          disableInputs(manifest.settings, input, settingsForm.controls[input].value, settingsForm);
          // Check on value changes
          settingsForm.controls[input].valueChanges.subscribe(inputValue => {
            // When a value of such an input changes, check if its inputValue implies to disable another input
            disableInputs(manifest.settings, input, inputValue, settingsForm);
          });
        });

        this.manifest = manifest;
        this.loading = false;
      });
  }

  createOrUpdateSouthConnector(command: SouthConnectorCommandDTO): void {
    let createOrUpdate: Observable<SouthConnectorDTO>;
    // if we are editing
    if (this.mode === 'edit') {
      createOrUpdate = this.southConnectorService.update(this.southConnector!.id, command).pipe(
        tap(() => this.notificationService.success('south.updated', { name: command.name })),
        switchMap(() => this.southConnectorService.get(this.southConnector!.id))
      );
    } else {
      createOrUpdate = this.southConnectorService
        .create(command)
        .pipe(tap(() => this.notificationService.success('south.created', { name: command.name })));
    }
    createOrUpdate.pipe(this.state.pendingUntilFinalization()).subscribe(southConnector => {
      if (this.mode === 'create') {
        this.router.navigate(['/south', southConnector.id, 'edit']);
      } else {
        this.router.navigate(['south']);
      }
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
      history: {
        maxInstantPerItem: formValue.history!.maxInstantPerItem!,
        maxReadInterval: formValue.history!.maxReadInterval!,
        readDelay: formValue.history!.readDelay!
      },
      settings: formValue.settings!
    };
    this.createOrUpdateSouthConnector(command);
  }
}
