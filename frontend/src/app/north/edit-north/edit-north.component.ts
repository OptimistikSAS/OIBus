import { Component, OnInit, inject } from '@angular/core';

import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
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
import {
  NorthConnectorCommandDTO,
  NorthConnectorDTO,
  NorthConnectorManifest,
  OIBusNorthType
} from '../../../../../backend/shared/model/north-connector.model';
import { NorthConnectorService } from '../../services/north-connector.service';
import { OibScanModeComponent } from '../../shared/form/oib-scan-mode/oib-scan-mode.component';
import { createFormGroup, groupFormControlsByRow } from '../../shared/form-utils';
import { BackNavigationDirective } from '../../shared/back-navigation.directives';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { TestConnectionResultModalComponent } from '../../shared/test-connection-result-modal/test-connection-result-modal.component';
import { ModalService } from '../../shared/modal.service';
import { CertificateDTO } from '../../../../../backend/shared/model/certificate.model';
import { CertificateService } from '../../services/certificate.service';
import { NorthSubscriptionsComponent } from '../north-subscriptions/north-subscriptions.component';
import { OibHelpComponent } from '../../shared/oib-help/oib-help.component';
import { SouthConnectorLightDTO } from '../../../../../backend/shared/model/south-connector.model';
import { NorthSettings } from '../../../../../backend/shared/model/north-settings.model';
import { OIBusNorthTypeEnumPipe } from '../../shared/oibus-north-type-enum.pipe';
import { CanComponentDeactivate } from '../../shared/unsaved-changes.guard';
import { UnsavedChangesConfirmationService } from '../../shared/unsaved-changes-confirmation.service';

@Component({
  selector: 'oib-edit-north',
  imports: [
    TranslateDirective,
    ...formDirectives,
    SaveButtonComponent,
    FormComponent,
    OibScanModeComponent,
    BackNavigationDirective,
    BoxComponent,
    BoxTitleDirective,
    NorthSubscriptionsComponent,
    OibHelpComponent,
    TranslatePipe,
    OIBusNorthTypeEnumPipe
  ],
  templateUrl: './edit-north.component.html',
  styleUrl: './edit-north.component.scss'
})
export class EditNorthComponent implements OnInit, CanComponentDeactivate {
  private northConnectorService = inject(NorthConnectorService);
  private fb = inject(NonNullableFormBuilder);
  private notificationService = inject(NotificationService);
  private scanModeService = inject(ScanModeService);
  private certificateService = inject(CertificateService);
  private modalService = inject(ModalService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private unsavedChangesConfirmation = inject(UnsavedChangesConfirmationService);

  mode: 'create' | 'edit' = 'create';
  northConnector: NorthConnectorDTO<NorthSettings> | null = null;
  northType = '';
  duplicateId = '';
  state = new ObservableState();
  loading = true;
  northSettingsControls: Array<Array<OibFormControl>> = [];
  scanModes: Array<ScanModeDTO> = [];
  certificates: Array<CertificateDTO> = [];
  manifest: NorthConnectorManifest | null = null;

  northForm: FormGroup<{
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
  }> | null = null;

  inMemorySubscriptions: Array<SouthConnectorLightDTO> = [];

  ngOnInit() {
    combineLatest([this.scanModeService.list(), this.certificateService.list(), this.route.paramMap, this.route.queryParamMap])
      .pipe(
        switchMap(([scanModes, certificates, params, queryParams]) => {
          this.scanModes = scanModes.filter(scanMode => scanMode.id !== 'subscription');
          this.certificates = certificates;
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
            this.duplicateId = paramNorthId;
            return this.northConnectorService.get(paramNorthId).pipe(this.state.pendingUntilFinalization());
          }
          // otherwise, we are creating one
          return of(null);
        }),
        switchMap(northConnector => {
          this.northConnector = northConnector;
          if (northConnector) {
            this.northType = northConnector.type;
          }

          return combineLatest([of(northConnector), this.northConnectorService.getNorthConnectorTypeManifest(this.northType)]);
        })
      )
      .subscribe(([northConnector, manifest]) => {
        if (!manifest) {
          this.loading = false;
          return;
        }

        this.northSettingsControls = groupFormControlsByRow(manifest.settings);

        this.northForm = this.fb.group({
          name: ['', Validators.required],
          description: '',
          enabled: true as boolean,
          settings: createFormGroup(manifest.settings, this.fb),
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
          })
        });

        // if we have a south connector we initialize the values
        if (northConnector) {
          this.northForm.patchValue(northConnector);
        } else {
          this.northForm.setValue(this.northForm.getRawValue());
        }

        this.manifest = manifest;
        this.loading = false;
      });
  }

  canDeactivate(): Observable<boolean> | boolean {
    if (this.northForm?.dirty) {
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
          this.northForm?.markAsPristine();
        }),
        switchMap(() => this.northConnectorService.get(this.northConnector!.id))
      );
    } else {
      createOrUpdate = this.northConnectorService.create(command, this.duplicateId).pipe(
        tap(() => {
          this.notificationService.success('north.created', { name: command.name });
          this.northForm?.markAsPristine();
        })
      );
    }
    createOrUpdate.pipe(this.state.pendingUntilFinalization()).subscribe(northConnector => {
      this.router.navigate(['/north', northConnector.id]);
    });
  }

  submit(value: 'save' | 'test') {
    if (!this.northForm!.valid) {
      return;
    }

    const formValue = this.northForm!.value;

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
        : this.inMemorySubscriptions.map(subscription => subscription.id)
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
