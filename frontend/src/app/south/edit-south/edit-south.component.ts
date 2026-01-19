import { Component, forwardRef, inject, OnInit } from '@angular/core';

import { TranslateDirective } from '@ngx-translate/core';
import {
  OIBusSouthType,
  SouthConnectorCommandDTO,
  SouthConnectorDTO,
  SouthConnectorItemDTO,
  SouthConnectorLightDTO,
  SouthConnectorManifest
} from '../../../../../backend/shared/model/south-connector.model';
import { SouthConnectorService } from '../../services/south-connector.service';
import { ObservableState, SaveButtonComponent } from '../../shared/save-button/save-button.component';
import { FormControl, FormGroup, NonNullableFormBuilder, ValidatorFn, Validators } from '@angular/forms';
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
import { OIBusSouthTypeEnumPipe } from '../../shared/oibus-south-type-enum.pipe';
import { formDirectives } from '../../shared/form/form-directives';
import { CertificateDTO } from '../../../../../backend/shared/model/certificate.model';
import { CertificateService } from '../../services/certificate.service';
import { addAttributeToForm, addEnablingConditions, asFormGroup } from '../../shared/form/dynamic-form.builder';
import { OIBusObjectFormControlComponent } from '../../shared/form/oibus-object-form-control/oibus-object-form-control.component';
import { CanComponentDeactivate } from '../../shared/unsaved-changes.guard';
import { UnsavedChangesConfirmationService } from '../../shared/unsaved-changes-confirmation.service';
import { AbstractControl, ValidationErrors } from '@angular/forms';
import { OIBUS_FORM_MODE } from '../../shared/form/oibus-form-mode.token';

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
  styleUrl: './edit-south.component.scss',
  viewProviders: [
    {
      provide: OIBUS_FORM_MODE,
      useFactory: (component: EditSouthComponent) => () => component.mode,
      deps: [forwardRef(() => EditSouthComponent)]
    }
  ]
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
  southConnector: SouthConnectorDTO | null = null;
  southType: OIBusSouthType | null = null;
  duplicateId = '';
  state = new ObservableState();
  scanModes: Array<ScanModeDTO> = [];
  certificates: Array<CertificateDTO> = [];
  manifest: SouthConnectorManifest | null = null;
  existingSouthConnectors: Array<SouthConnectorLightDTO> = [];
  form: FormGroup<{
    name: FormControl<string>;
    description: FormControl<string>;
    enabled: FormControl<boolean>;
    settings: FormGroup;
  }> | null = null;

  inMemoryItems: Array<SouthConnectorItemDTO> = [];

  ngOnInit() {
    combineLatest([
      this.scanModeService.list(),
      this.certificateService.list(),
      this.southConnectorService.list(),
      this.route.paramMap,
      this.route.queryParamMap
    ])
      .pipe(
        switchMap(([scanModes, certificates, southConnectors, params, queryParams]) => {
          this.scanModes = scanModes;
          this.certificates = certificates;
          this.existingSouthConnectors = southConnectors;
          const paramSouthId = params.get('southId');
          const duplicateSouthId = queryParams.get('duplicate');
          this.southType = (queryParams.get('type') as OIBusSouthType) || null;

          // if there is a South ID, we are editing a South connector
          if (paramSouthId) {
            this.mode = 'edit';
            this.southId = paramSouthId;
            return this.southConnectorService.findById(paramSouthId).pipe(this.state.pendingUntilFinalization());
          } else {
            this.mode = 'create';
            this.southId = 'create';
            // fetch the South connector in case of duplicate
            if (duplicateSouthId) {
              this.duplicateId = duplicateSouthId;
              return this.southConnectorService.findById(duplicateSouthId).pipe(this.state.pendingUntilFinalization());
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
          return this.southConnectorService.getSouthManifest(this.southType!);
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

  createOrUpdateSouthConnector(command: SouthConnectorCommandDTO): void {
    let createOrUpdate: Observable<SouthConnectorDTO>;
    if (this.mode === 'edit') {
      createOrUpdate = this.southConnectorService.update(this.southConnector!.id, command).pipe(
        tap(() => {
          this.notificationService.success('south.updated', { name: command.name });
          this.form?.markAsPristine();
        }),
        switchMap(() => this.southConnectorService.findById(this.southConnector!.id))
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

  updateInMemoryItems(items: Array<SouthConnectorItemDTO> | null) {
    if (items) {
      this.inMemoryItems = items;
    } else {
      this.southConnectorService.findById(this.southConnector!.id).subscribe(southConnector => {
        this.southConnector!.items = southConnector.items;
        this.southConnector = JSON.parse(JSON.stringify(this.southConnector)); // Used to force a refresh in south item list
      });
    }
  }

  private checkUniqueness(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = (control.value ?? '').toString().trim().toLowerCase();
      if (!value) {
        return null;
      }

      const isDuplicate = this.existingSouthConnectors.some(south => {
        if (this.southConnector && south.id === this.southConnector.id) {
          return false;
        }
        return south.name.trim().toLowerCase() === value;
      });

      return isDuplicate ? { mustBeUnique: true } : null;
    };
  }

  buildForm() {
    this.form = this.fb.group({
      name: this.fb.control('', {
        validators: [Validators.required, this.checkUniqueness()]
      }),
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

    this.form.controls.name.updateValueAndValidity({ onlySelf: true, emitEvent: false });
  }

  get formSouthConnectorCommand(): SouthConnectorCommandDTO {
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
        scanModeName: null,
        groupId: item.group?.id || null
      })) as any
    };
  }

  protected readonly asFormGroup = asFormGroup;
}
