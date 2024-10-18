import { Component, OnInit, inject } from '@angular/core';

import { TranslateModule } from '@ngx-translate/core';
import {
  SouthConnectorCommandDTO,
  SouthConnectorDTO,
  SouthConnectorItemCommandDTO,
  SouthConnectorManifest
} from '../../../../../shared/model/south-connector.model';
import { SouthConnectorService } from '../../services/south-connector.service';
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
import { createFormGroup, groupFormControlsByRow } from '../../shared/form-utils';
import { BackNavigationDirective } from '../../shared/back-navigation.directives';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { SouthItemsComponent } from '../south-items/south-items.component';
import { EditElementComponent } from '../../shared/form/oib-form-array/edit-element/edit-element.component';
import { TestConnectionResultModalComponent } from '../../shared/test-connection-result-modal/test-connection-result-modal.component';
import { ModalService } from '../../shared/modal.service';
import { OibHelpComponent } from '../../shared/oib-help/oib-help.component';
import { SouthItemSettings, SouthSettings } from '../../../../../shared/model/south-settings.model';

@Component({
  selector: 'oib-edit-south',
  standalone: true,
  imports: [
    TranslateModule,
    ...formDirectives,
    RouterLink,
    SaveButtonComponent,
    FormComponent,
    BackNavigationDirective,
    BoxComponent,
    BoxTitleDirective,
    SouthItemsComponent,
    EditElementComponent,
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
  southConnector: SouthConnectorDTO<SouthSettings, SouthItemSettings> | null = null;
  southType = '';
  duplicateId = '';
  state = new ObservableState();

  southSettingsControls: Array<Array<OibFormControl>> = [];
  scanModes: Array<ScanModeDTO> = [];
  manifest: SouthConnectorManifest | null = null;
  southForm: FormGroup<{
    name: FormControl<string>;
    description: FormControl<string>;
    enabled: FormControl<boolean>;
    sharedConnection: FormControl<boolean>;
    history: FormGroup<{
      maxInstantPerItem: FormControl<boolean>;
      maxReadInterval: FormControl<number>;
      readDelay: FormControl<number>;
      overlap: FormControl<number>;
    }>;
    settings: FormGroup;
  }> | null = null;

  inMemoryItems: Array<SouthConnectorItemCommandDTO<SouthItemSettings>> = [];

  initialMaxInstantPerItem: boolean | null = null;
  showMaxInstantPerItemWarning = false;

  ngOnInit() {
    combineLatest([this.scanModeService.list(), this.route.paramMap, this.route.queryParamMap])
      .pipe(
        switchMap(([scanModes, params, queryParams]) => {
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
            this.duplicateId = paramSouthId;
            return this.southConnectorService.get(paramSouthId).pipe(this.state.pendingUntilFinalization());
          }
          // otherwise, we are creating one
          return of(null);
        }),
        switchMap(southConnector => {
          this.southConnector = southConnector;
          if (southConnector) {
            this.southType = southConnector.type;
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
          sharedConnection: false as boolean,
          history: this.fb.group({
            maxInstantPerItem: manifest.modes.forceMaxInstantPerItem,
            maxReadInterval: 0,
            readDelay: 200,
            overlap: 0
          }),
          settings: createFormGroup(manifest.settings, this.fb)
        });

        // if we have a south connector we initialize the values
        if (this.southConnector) {
          this.southForm.patchValue(this.southConnector);
        } else {
          // we should provoke all value changes to make sure fields are properly hidden and disabled
          this.southForm.setValue(this.southForm.getRawValue());
        }

        this.initialMaxInstantPerItem = Boolean(this.southForm!.get('history.maxInstantPerItem')!.value);
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

    const formValue = this.southForm!.value;
    const command: SouthConnectorCommandDTO<SouthSettings, SouthItemSettings> = {
      name: formValue.name!,
      type: this.southType,
      description: formValue.description!,
      enabled: formValue.enabled!,
      sharedConnection: formValue.sharedConnection!,
      history: {
        maxInstantPerItem: formValue.history!.maxInstantPerItem!,
        maxReadInterval: formValue.history!.maxReadInterval!,
        readDelay: formValue.history!.readDelay!,
        overlap: formValue.history!.overlap!
      },
      settings: formValue.settings!,
      items: this.southConnector
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
    if (value === 'save') {
      this.createOrUpdateSouthConnector(command);
    } else {
      const modalRef = this.modalService.open(TestConnectionResultModalComponent);
      const component: TestConnectionResultModalComponent = modalRef.componentInstance;
      component.runTest('south', this.southConnector, command);
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

  onMaxInstantPerItemChange() {
    if (!this.initialMaxInstantPerItem) {
      this.showMaxInstantPerItemWarning = false;
      return;
    }

    const currentMaxInstantPerItem = Boolean(this.southForm!.get('history.maxInstantPerItem')!.value);
    if (this.initialMaxInstantPerItem === currentMaxInstantPerItem) {
      this.showMaxInstantPerItemWarning = false;
      return;
    }

    // enabled -> disabled
    if (this.initialMaxInstantPerItem && !currentMaxInstantPerItem) {
      this.showMaxInstantPerItemWarning = true;
    }
  }

  get maxInstantPerItem() {
    if (this.mode === 'create') {
      // When we are creating a new South connector,
      // we don't pass down the max instant per item value
      // because item changes are not persisted until the South connector is created
      return null;
    }
    return Boolean(this.southForm!.get('history.maxInstantPerItem')?.value);
  }
}
