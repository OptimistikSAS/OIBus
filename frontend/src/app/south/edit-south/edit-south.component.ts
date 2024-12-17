import { Component, OnInit, inject } from '@angular/core';

import { TranslateDirective } from '@ngx-translate/core';
import {
  SouthConnectorCommandDTO,
  SouthConnectorDTO,
  SouthConnectorItemCommandDTO,
  SouthConnectorManifest
} from '../../../../../backend/shared/model/south-connector.model';
import { SouthConnectorService } from '../../services/south-connector.service';
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
import { createFormGroup, groupFormControlsByRow } from '../../shared/form-utils';
import { BackNavigationDirective } from '../../shared/back-navigation.directives';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { SouthItemsComponent } from '../south-items/south-items.component';
import { TestConnectionResultModalComponent } from '../../shared/test-connection-result-modal/test-connection-result-modal.component';
import { ModalService } from '../../shared/modal.service';
import { OibHelpComponent } from '../../shared/oib-help/oib-help.component';
import { SouthItemSettings, SouthSettings } from '../../../../../backend/shared/model/south-settings.model';

@Component({
  selector: 'oib-edit-south',
  imports: [
    TranslateDirective,
    ...formDirectives,
    SaveButtonComponent,
    FormComponent,
    BackNavigationDirective,
    BoxComponent,
    BoxTitleDirective,
    SouthItemsComponent,
    OibHelpComponent
  ],
  templateUrl: './edit-south.component.html',
  styleUrl: './edit-south.component.scss'
})
export class EditSouthComponent implements OnInit {
  private southConnectorService = inject(SouthConnectorService);
  private fb = inject(NonNullableFormBuilder);
  private notificationService = inject(NotificationService);
  private scanModeService = inject(ScanModeService);
  private modalService = inject(ModalService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  mode: 'create' | 'edit' = 'create';
  southId!: string;
  southConnector: SouthConnectorDTO<SouthSettings, SouthItemSettings> | null = null;
  southType = '';
  duplicateId = '';
  saveItemChangesDirectly!: boolean;
  state = new ObservableState();

  southSettingsControls: Array<Array<OibFormControl>> = [];
  scanModes: Array<ScanModeDTO> = [];
  manifest: SouthConnectorManifest | null = null;
  southForm: FormGroup<{
    name: FormControl<string>;
    description: FormControl<string>;
    enabled: FormControl<boolean>;
    settings: FormGroup;
  }> | null = null;

  inMemoryItems: Array<SouthConnectorItemCommandDTO<SouthItemSettings>> = [];

  ngOnInit() {
    combineLatest([this.scanModeService.list(), this.route.paramMap, this.route.queryParamMap])
      .pipe(
        switchMap(([scanModes, params, queryParams]) => {
          this.scanModes = scanModes.filter(scanMode => scanMode.id !== 'subscription');
          const paramSouthId = params.get('southId');
          const duplicateSouthId = queryParams.get('duplicate');
          this.southType = queryParams.get('type') || '';

          // if there is a South ID, we are editing a South connector
          if (paramSouthId) {
            this.mode = 'edit';
            this.southId = paramSouthId;
            this.saveItemChangesDirectly = true;
            return this.southConnectorService.get(paramSouthId).pipe(this.state.pendingUntilFinalization());
          }
          // fetch the South connector in case of duplicate
          else if (duplicateSouthId) {
            this.mode = 'create';
            this.southId = 'create';
            this.duplicateId = duplicateSouthId;
            this.saveItemChangesDirectly = false;
            return this.southConnectorService.get(duplicateSouthId).pipe(this.state.pendingUntilFinalization());
          }
          // otherwise, we are creating one
          else {
            this.mode = 'create';
            this.southId = 'create';
            this.saveItemChangesDirectly = false;
            return of(null);
          }
        }),
        switchMap(southConnector => {
          this.southConnector = southConnector;
          if (southConnector) {
            this.southType = southConnector.type;

            // When changes are not saved directly, items come from memory
            if (!this.saveItemChangesDirectly) {
              this.inMemoryItems = southConnector.items.map(item => ({
                ...item,
                id: null, // we need to remove the exiting ids
                scanModeName: null
              }));
            }
          }

          return this.southConnectorService.getSouthConnectorTypeManifest(this.southType);
        })
      )
      .subscribe(manifest => {
        if (!manifest) {
          return;
        }

        this.manifest = manifest;
        this.southSettingsControls = groupFormControlsByRow(manifest.settings);

        this.southForm = this.fb.group({
          name: ['', Validators.required],
          description: '',
          enabled: true as boolean,
          settings: createFormGroup(manifest.settings, this.fb)
        });

        // if we have a south connector we initialize the values
        if (this.southConnector) {
          this.southForm.patchValue(this.southConnector);
        } else {
          // we should provoke all value changes to make sure fields are properly hidden and disabled
          this.southForm.setValue(this.southForm.getRawValue());
        }
      });
  }

  createOrUpdateSouthConnector(command: SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>): void {
    let createOrUpdate: Observable<SouthConnectorDTO<SouthSettings, SouthItemSettings>>;
    if (this.mode === 'edit') {
      createOrUpdate = this.southConnectorService.update(this.southConnector!.id, command).pipe(
        tap(() => this.notificationService.success('south.updated', { name: command.name })),
        switchMap(() => this.southConnectorService.get(this.southConnector!.id))
      );
    } else {
      createOrUpdate = this.southConnectorService
        .create(command, this.duplicateId)
        .pipe(tap(() => this.notificationService.success('south.created', { name: command.name })));
    }
    createOrUpdate.pipe(this.state.pendingUntilFinalization()).subscribe(southConnector => {
      this.router.navigate(['/south', southConnector.id]);
    });
  }

  submit(value: 'save' | 'test') {
    if (!this.southForm!.valid) {
      return;
    }

    if (value === 'save') {
      this.createOrUpdateSouthConnector(this.formSouthConnectorCommand);
    } else {
      const modalRef = this.modalService.open(TestConnectionResultModalComponent);
      const component: TestConnectionResultModalComponent = modalRef.componentInstance;
      component.runTest('south', this.southConnector, this.formSouthConnectorCommand);
    }
  }

  updateInMemoryItems(items: Array<SouthConnectorItemCommandDTO<SouthItemSettings>> | null) {
    if (items) {
      this.inMemoryItems = items;
    } else {
      this.southConnectorService.get(this.southConnector!.id).subscribe(southConnector => {
        this.southConnector!.items = southConnector.items;
        this.southConnector = JSON.parse(JSON.stringify(this.southConnector)); // Used to force a refresh in south item list
      });
    }
  }

  get formSouthConnectorCommand(): SouthConnectorCommandDTO<SouthSettings, SouthItemSettings> {
    const formValue = this.southForm!.value;
    const command: SouthConnectorCommandDTO<SouthSettings, SouthItemSettings> = {
      name: formValue.name!,
      type: this.southType,
      description: formValue.description!,
      enabled: formValue.enabled!,
      settings: formValue.settings!,
      items:
        this.saveItemChangesDirectly && this.southConnector
          ? this.southConnector.items.map(item => ({
              id: item.id,
              name: item.name,
              enabled: item.enabled,
              scanModeId: item.scanModeId,
              scanModeName: null,
              settings: item.settings
            }))
          : this.inMemoryItems
    };

    return command;
  }
}
