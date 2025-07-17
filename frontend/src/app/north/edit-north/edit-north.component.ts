import { Component, inject, OnInit } from '@angular/core';

import { TranslateDirective } from '@ngx-translate/core';
import { ObservableState, SaveButtonComponent } from '../../shared/save-button/save-button.component';
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NotificationService } from '../../shared/notification.service';
import { ActivatedRoute, Router } from '@angular/router';
import { combineLatest, Observable, of, switchMap, tap } from 'rxjs';
import { ScanModeDTO } from '../../../../../backend/shared/model/scan-mode.model';
import { ScanModeService } from '../../services/scan-mode.service';
import {
  NorthConnectorCommandDTO,
  NorthConnectorDTO,
  NorthConnectorLightDTO,
  NorthConnectorManifest,
  OIBusNorthType
} from '../../../../../backend/shared/model/north-connector.model';
import { NorthConnectorService } from '../../services/north-connector.service';
import { BackNavigationDirective } from '../../shared/back-navigation.directives';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { TestConnectionResultModalComponent } from '../../shared/test-connection-result-modal/test-connection-result-modal.component';
import { ModalService } from '../../shared/modal.service';
import { CertificateDTO } from '../../../../../backend/shared/model/certificate.model';
import { CertificateService } from '../../services/certificate.service';
import { OibHelpComponent } from '../../shared/oib-help/oib-help.component';
import { SouthConnectorLightDTO } from '../../../../../backend/shared/model/south-connector.model';
import { NorthSettings } from '../../../../../backend/shared/model/north-settings.model';
import { OIBusNorthTypeEnumPipe } from '../../shared/oibus-north-type-enum.pipe';
import { TransformerDTO, TransformerDTOWithOptions } from '../../../../../backend/shared/model/transformer.model';
import { TransformerService } from '../../services/transformer.service';
import { NorthTransformersComponent } from '../north-transformers/north-transformers.component';
import { addAttributeToForm, addEnablingConditions } from '../../shared/form/dynamic-form.builder';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../shared/form/form-validation-directives';
import { OIBusObjectFormControlComponent } from '../../shared/form/oibus-object-form-control/oibus-object-form-control.component';
import { OIBusScanModeAttribute } from '../../../../../backend/shared/model/form.model';
import { OIBusScanModeFormControlComponent } from '../../shared/form/oibus-scan-mode-form-control/oibus-scan-mode-form-control.component';
import { NorthSubscriptionsComponent } from '../north-subscriptions/north-subscriptions.component';
import { CanComponentDeactivate } from '../../shared/unsaved-changes.guard';
import { UnsavedChangesConfirmationService } from '../../shared/unsaved-changes-confirmation.service';
import { SouthConnectorService } from '../../services/south-connector.service';

@Component({
  selector: 'oib-edit-north',
  imports: [
    TranslateDirective,
    SaveButtonComponent,
    BackNavigationDirective,
    BoxComponent,
    BoxTitleDirective,
    OibHelpComponent,
    OIBusNorthTypeEnumPipe,
    NorthTransformersComponent,
    ReactiveFormsModule,
    OI_FORM_VALIDATION_DIRECTIVES,
    OIBusObjectFormControlComponent,
    OIBusScanModeFormControlComponent,
    NorthSubscriptionsComponent
  ],
  templateUrl: './edit-north.component.html',
  styleUrl: './edit-north.component.scss'
})
export class EditNorthComponent implements OnInit, CanComponentDeactivate {
  private northConnectorService = inject(NorthConnectorService);
  private southConnectorService = inject(SouthConnectorService);
  private fb = inject(NonNullableFormBuilder);
  private notificationService = inject(NotificationService);
  private scanModeService = inject(ScanModeService);
  private certificateService = inject(CertificateService);
  private transformerService = inject(TransformerService);
  private modalService = inject(ModalService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private unsavedChangesConfirmation = inject(UnsavedChangesConfirmationService);

  mode: 'create' | 'edit' = 'create';
  northId!: string;
  northConnector: NorthConnectorDTO<NorthSettings> | null = null;
  northType = '';
  duplicateId = '';
  state = new ObservableState();
  loading = true;
  scanModes: Array<ScanModeDTO> = [];
  transformers: Array<TransformerDTO> = [];
  certificates: Array<CertificateDTO> = [];
  southConnectors: Array<SouthConnectorLightDTO> = [];
  northConnectors: Array<NorthConnectorLightDTO> = [];
  manifest: NorthConnectorManifest | null = null;

  form: FormGroup<{
    name: FormControl<string>;
    description: FormControl<string>;
    enabled: FormControl<boolean>;
    caching: FormGroup<{
      trigger: FormGroup<{
        scanModeId: FormControl<string | null>;
        numberOfElements: FormControl<number>;
        numberOfFiles: FormControl<number>;
      }>;
      throttling: FormGroup<{
        runMinDelay: FormControl<number>;
        maxSize: FormControl<number>;
        maxNumberOfElements: FormControl<number>;
      }>;
      error: FormGroup<{
        retryInterval: FormControl<number>;
        retryCount: FormControl<number>;
        retentionDuration: FormControl<number>;
      }>;
      archive: FormGroup<{
        enabled: FormControl<boolean>;
        retentionDuration: FormControl<number>;
      }>;
    }>;
    settings: FormGroup;
    transformers: FormControl<Array<TransformerDTOWithOptions>>;
  }> | null = null;

  inMemorySubscriptions: Array<SouthConnectorLightDTO> = [];
  scanModeAttribute: OIBusScanModeAttribute = {
    type: 'scan-mode',
    key: 'scanModeId',
    translationKey: 'north.caching.trigger.schedule',
    acceptableType: 'POLL',
    validators: [{ type: 'REQUIRED', arguments: [] }],
    displayProperties: {
      row: 0,
      columns: 4,
      displayInViewMode: true
    }
  };

  ngOnInit() {
    combineLatest([
      this.southConnectorService.list(),
      this.northConnectorService.list(),
      this.scanModeService.list(),
      this.certificateService.list(),
      this.transformerService.list(),
      this.route.paramMap,
      this.route.queryParamMap
    ])
      .pipe(
        switchMap(([southConnectors, northConnectors, scanModes, certificates, transformers, params, queryParams]) => {
          this.southConnectors = southConnectors;
          this.northConnectors = northConnectors;
          this.scanModes = scanModes.filter(scanMode => scanMode.id !== 'subscription');
          this.certificates = certificates;
          this.transformers = transformers;
          const paramNorthId = params.get('northId');
          const duplicateNorthId = queryParams.get('duplicate');
          this.northType = queryParams.get('type') || '';

          // if there is a North ID, we are editing a North connector
          if (paramNorthId) {
            this.mode = 'edit';
            this.northId = paramNorthId;
            return this.northConnectorService.get(paramNorthId).pipe(this.state.pendingUntilFinalization());
          }
          // fetch the North connector in case of duplicate
          else if (duplicateNorthId) {
            this.mode = 'create';
            this.northId = 'create';
            this.duplicateId = duplicateNorthId;
            return this.northConnectorService.get(duplicateNorthId).pipe(this.state.pendingUntilFinalization());
          }
          // otherwise, we are creating one
          else {
            this.mode = 'create';
            this.northId = 'create';
            return of(null);
          }
        }),
        switchMap(northConnector => {
          this.northConnector = northConnector;
          if (northConnector) {
            this.northType = northConnector.type;
          }
          return this.northConnectorService.getNorthConnectorTypeManifest(this.northType);
        })
      )
      .subscribe(manifest => {
        if (!manifest) {
          this.loading = false;
          return;
        }
        this.manifest = manifest;
        this.buildForm();
        this.loading = false;
      });
  }

  buildForm() {
    this.form = this.fb.group({
      name: ['', Validators.required],
      description: '',
      enabled: true as boolean,
      settings: this.fb.group({}),
      caching: this.fb.group({
        trigger: this.fb.group({
          scanModeId: this.fb.control<string | null>(null, Validators.required),
          numberOfElements: [1_000, Validators.required],
          numberOfFiles: [1, Validators.required]
        }),
        throttling: this.fb.group({
          runMinDelay: [200, Validators.required],
          maxSize: [0, Validators.required],
          maxNumberOfElements: [10_000, Validators.required]
        }),
        error: this.fb.group({
          retryInterval: [5_000, Validators.required],
          retryCount: [3, Validators.required],
          retentionDuration: [72, Validators.required]
        }),
        archive: this.fb.group({
          enabled: [false, Validators.required],
          retentionDuration: [72, Validators.required]
        })
      }),
      transformers: [[] as Array<TransformerDTOWithOptions>]
    });
    for (const attribute of this.manifest!.settings.attributes) {
      addAttributeToForm(this.fb, this.form.controls.settings, attribute);
    }
    addEnablingConditions(this.form.controls.settings, this.manifest!.settings.enablingConditions);
    // if we have a south connector, we initialize the values
    if (this.northConnector) {
      this.form.patchValue(this.northConnector);
    } else {
      // we should provoke all value changes to make sure fields are properly hidden and disabled
      this.form.setValue(this.form.getRawValue());
    }
  }

  canDeactivate(): Observable<boolean> | boolean {
    if (this.form?.dirty) {
      return this.unsavedChangesConfirmation.confirmUnsavedChanges();
    }
    return true;
  }

  createOrUpdateNorthConnector(command: NorthConnectorCommandDTO<NorthSettings>): void {
    let createOrUpdate: Observable<NorthConnectorDTO<NorthSettings>>;
    if (this.mode === 'edit') {
      createOrUpdate = this.northConnectorService.update(this.northConnector!.id, command).pipe(
        tap(() => {
          this.notificationService.success('north.updated', { name: command.name });
          this.form?.markAsPristine();
        }),
        switchMap(() => this.northConnectorService.get(this.northConnector!.id))
      );
    } else {
      createOrUpdate = this.northConnectorService.create(command, this.duplicateId).pipe(
        tap(() => {
          this.notificationService.success('north.created', { name: command.name });
          this.form?.markAsPristine();
        })
      );
    }
    createOrUpdate.pipe(this.state.pendingUntilFinalization()).subscribe(northConnector => {
      this.router.navigate(['/north', northConnector.id]);
    });
  }

  submit(value: 'save' | 'test') {
    if (!this.form!.valid) {
      return;
    }

    const formValue = this.form!.value;

    const command: NorthConnectorCommandDTO<NorthSettings> = {
      name: formValue.name!,
      type: this.northType as OIBusNorthType,
      description: formValue.description!,
      enabled: formValue.enabled!,
      settings: formValue.settings!,
      caching: {
        trigger: {
          scanModeId: formValue.caching!.trigger!.scanModeId!,
          scanModeName: null,
          numberOfElements: formValue.caching!.trigger!.numberOfElements!,
          numberOfFiles: formValue.caching!.trigger!.numberOfFiles!
        },
        throttling: {
          runMinDelay: formValue.caching!.throttling!.runMinDelay!,
          maxSize: formValue.caching!.throttling!.maxSize!,
          maxNumberOfElements: formValue.caching!.throttling!.maxNumberOfElements!
        },
        error: {
          retryInterval: formValue.caching!.error!.retryInterval!,
          retryCount: formValue.caching!.error!.retryCount!,
          retentionDuration: formValue.caching!.error!.retentionDuration!
        },
        archive: {
          enabled: formValue.caching!.archive!.enabled!,
          retentionDuration: formValue.caching!.archive!.retentionDuration!
        }
      },
      subscriptions: this.northConnector
        ? this.northConnector.subscriptions.map(subscription => subscription.id)
        : this.inMemorySubscriptions.map(subscription => subscription.id),
      transformers: formValue.transformers!.map(element => ({
        transformerId: element.transformer.id,
        options: element.options,
        inputType: element.inputType
      }))
    };
    if (value === 'save') {
      this.createOrUpdateNorthConnector(command);
    } else {
      const modalRef = this.modalService.open(TestConnectionResultModalComponent);
      const component: TestConnectionResultModalComponent = modalRef.componentInstance;
      component.runTest('north', this.northConnector, command);
    }
  }

  updateInMemorySubscriptions(subscriptions: Array<SouthConnectorLightDTO> | null) {
    if (subscriptions) {
      this.inMemorySubscriptions = subscriptions;
    } else {
      this.northConnectorService.get(this.northConnector!.id).subscribe(northConnector => {
        this.northConnector!.subscriptions = northConnector.subscriptions;
        this.northConnector = JSON.parse(JSON.stringify(this.northConnector));
      });
    }
  }
}
