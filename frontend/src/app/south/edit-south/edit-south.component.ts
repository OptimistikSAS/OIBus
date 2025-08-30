import { Component, inject, OnInit } from '@angular/core';

import { TranslateDirective } from '@ngx-translate/core';
import {
  OIBusSouthType,
  SouthConnectorCommandDTO,
  SouthConnectorDTO,
  SouthConnectorItemDTO,
  SouthConnectorManifest
} from '../../../../../backend/shared/model/south-connector.model';
import { SouthConnectorService } from '../../services/south-connector.service';
import { ObservableState, SaveButtonComponent } from '../../shared/save-button/save-button.component';
import { FormControl, FormGroup, NonNullableFormBuilder, Validators } from '@angular/forms';
import { NotificationService } from '../../shared/notification.service';
import { ActivatedRoute, Router } from '@angular/router';
import { combineLatest, Observable, of, switchMap, tap } from 'rxjs';
import { ScanModeDTO } from '../../../../../backend/shared/model/scan-mode.model';
import { ScanModeService } from '../../services/scan-mode.service';
import { BackNavigationDirective } from '../../shared/back-navigation.directives';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { SouthItemsComponent } from '../south-items/south-items.component';
import { TestConnectionResultModalComponent } from '../../shared/test-connection-result-modal/test-connection-result-modal.component';
import { ModalService } from '../../shared/modal.service';
import { OibHelpComponent } from '../../shared/oib-help/oib-help.component';
import { SouthItemSettings, SouthSettings } from '../../../../../backend/shared/model/south-settings.model';
import { OIBusSouthTypeEnumPipe } from '../../shared/oibus-south-type-enum.pipe';
import { formDirectives } from '../../shared/form/form-directives';
import { CertificateDTO } from '../../../../../backend/shared/model/certificate.model';
import { CertificateService } from '../../services/certificate.service';
import { addAttributeToForm, addEnablingConditions, asFormGroup } from '../../shared/form/dynamic-form.builder';
import { OIBusObjectFormControlComponent } from '../../shared/form/oibus-object-form-control/oibus-object-form-control.component';
import { CanComponentDeactivate } from '../../shared/unsaved-changes.guard';
import { UnsavedChangesConfirmationService } from '../../shared/unsaved-changes-confirmation.service';

@Component({
  selector: 'oib-edit-south',
  imports: [
    TranslateDirective,
    ...formDirectives,
    SaveButtonComponent,
    BackNavigationDirective,
    BoxComponent,
    BoxTitleDirective,
    SouthItemsComponent,
    OibHelpComponent,
    OIBusSouthTypeEnumPipe,
    OIBusObjectFormControlComponent
  ],
  templateUrl: './edit-south.component.html',
  styleUrl: './edit-south.component.scss'
})
export class EditSouthComponent implements OnInit, CanComponentDeactivate {
  private southConnectorService = inject(SouthConnectorService);
  private fb = inject(NonNullableFormBuilder);
  private notificationService = inject(NotificationService);
  private scanModeService = inject(ScanModeService);
  private certificateService = inject(CertificateService);
  private modalService = inject(ModalService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private unsavedChangesConfirmation = inject(UnsavedChangesConfirmationService);

  mode: 'create' | 'edit' = 'create';
  southId!: string;
  southConnector: SouthConnectorDTO<SouthSettings, SouthItemSettings> | null = null;
  southType = '';
  duplicateId = '';
  state = new ObservableState();
  scanModes: Array<ScanModeDTO> = [];
  certificates: Array<CertificateDTO> = [];
  manifest: SouthConnectorManifest | null = null;
  form: FormGroup<{
    name: FormControl<string>;
    description: FormControl<string>;
    enabled: FormControl<boolean>;
    settings: FormGroup;
  }> | null = null;

  inMemoryItems: Array<SouthConnectorItemDTO<SouthItemSettings>> = [];

  ngOnInit() {
    combineLatest([this.scanModeService.list(), this.certificateService.list(), this.route.paramMap, this.route.queryParamMap])
      .pipe(
        switchMap(([scanModes, certificates, params, queryParams]) => {
          this.scanModes = scanModes.filter(scanMode => scanMode.id !== 'subscription');
          this.certificates = certificates;
          const paramSouthId = params.get('southId');
          const duplicateSouthId = queryParams.get('duplicate');
          this.southType = queryParams.get('type') || '';

          // if there is a South ID, we are editing a South connector
          if (paramSouthId) {
            this.mode = 'edit';
            this.southId = paramSouthId;
            return this.southConnectorService.get(paramSouthId).pipe(this.state.pendingUntilFinalization());
          } else {
            this.mode = 'create';
            this.southId = 'create';
            // fetch the South connector in case of duplicate
            if (duplicateSouthId) {
              this.duplicateId = duplicateSouthId;
              return this.southConnectorService.get(duplicateSouthId).pipe(this.state.pendingUntilFinalization());
            }
            // otherwise, we are creating one
            else {
              return of(null);
            }
          }
        }),
        switchMap(southConnector => {
          this.southConnector = southConnector;
          if (southConnector) {
            this.southType = southConnector.type;
            this.inMemoryItems = southConnector.items;
          }
          return this.southConnectorService.getSouthConnectorTypeManifest(this.southType);
        })
      )
      .subscribe(manifest => {
        if (!manifest) {
          return;
        }
        this.manifest = manifest;
        this.buildForm();
      });
  }

  canDeactivate(): Observable<boolean> | boolean {
    if (this.form?.dirty) {
      return this.unsavedChangesConfirmation.confirmUnsavedChanges();
    }
    return true;
  }

  createOrUpdateSouthConnector(command: SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>): void {
    let createOrUpdate: Observable<SouthConnectorDTO<SouthSettings, SouthItemSettings>>;
    if (this.mode === 'edit') {
      createOrUpdate = this.southConnectorService.update(this.southConnector!.id, command).pipe(
        tap(() => {
          this.notificationService.success('south.updated', { name: command.name });
          this.form?.markAsPristine();
        }),
        switchMap(() => this.southConnectorService.get(this.southConnector!.id))
      );
    } else {
      createOrUpdate = this.southConnectorService.create(command, this.duplicateId).pipe(
        tap(() => {
          this.notificationService.success('south.created', { name: command.name });
          this.form?.markAsPristine();
        })
      );
    }
    createOrUpdate.pipe(this.state.pendingUntilFinalization()).subscribe(southConnector => {
      this.router.navigate(['/south', southConnector.id]);
    });
  }

  submit(value: 'save' | 'test') {
    if (value === 'save') {
      if (!this.form!.valid) {
        return;
      }
      this.createOrUpdateSouthConnector(this.formSouthConnectorCommand);
      return;
    }

    // Test: only validate the settings section
    this.form!.controls.settings.markAllAsTouched();
    if (!this.form!.controls.settings.valid) {
      return;
    }
    const modalRef = this.modalService.open(TestConnectionResultModalComponent);
    const component: TestConnectionResultModalComponent = modalRef.componentInstance;
    component.runTest('south', this.southConnector?.id || null, this.formSouthConnectorCommand.settings, this.southType as OIBusSouthType);
  }

  updateInMemoryItems(items: Array<SouthConnectorItemDTO<SouthItemSettings>> | null) {
    if (items) {
      this.inMemoryItems = items;
    } else {
      this.southConnectorService.get(this.southConnector!.id).subscribe(southConnector => {
        this.southConnector!.items = southConnector.items;
        this.southConnector = JSON.parse(JSON.stringify(this.southConnector)); // Used to force a refresh in south item list
      });
    }
  }

  buildForm() {
    this.form = this.fb.group({
      name: ['', Validators.required],
      description: '',
      enabled: true as boolean,
      settings: this.fb.group({})
    });
    for (const attribute of this.manifest!.settings.attributes) {
      addAttributeToForm(this.fb, this.form.controls.settings, attribute);
    }
    addEnablingConditions(this.form.controls.settings, this.manifest!.settings.enablingConditions);
    // if we have a south connector, we initialize the values
    if (this.southConnector) {
      this.form.patchValue(this.southConnector);
    } else {
      // we should provoke all value changes to make sure fields are properly hidden and disabled
      this.form.setValue(this.form.getRawValue());
    }
  }

  get formSouthConnectorCommand(): SouthConnectorCommandDTO<SouthSettings, SouthItemSettings> {
    const formValue = this.form!.value;
    return {
      name: formValue.name!,
      type: this.southType as OIBusSouthType,
      description: formValue.description!,
      enabled: formValue.enabled!,
      settings: formValue.settings!,
      items: this.inMemoryItems.map(item => ({
        id: item.id,
        enabled: item.enabled,
        name: item.name,
        settings: item.settings,
        scanModeId: item.scanMode.id,
        scanModeName: null
      }))
    };
  }

  protected readonly asFormGroup = asFormGroup;
}
