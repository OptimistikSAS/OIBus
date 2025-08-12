import { Component, inject } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators, FormGroup, FormControl } from '@angular/forms';
import { ObservableState, SaveButtonComponent } from '../../../shared/save-button/save-button.component';
import { TranslateDirective } from '@ngx-translate/core';
import { EngineService } from '../../../services/engine.service';
import { RegistrationSettingsCommandDTO, RegistrationSettingsDTO } from '../../../../../../backend/shared/model/engine.model';
import { BoxComponent } from '../../../shared/box/box.component';
import { OibusCommandTypeEnumPipe } from '../../../shared/oibus-command-type-enum.pipe';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../../shared/form/form-validation-directives';

@Component({
  selector: 'oib-register-oibus-modal',
  templateUrl: './register-oibus-modal.component.html',
  styleUrl: './register-oibus-modal.component.scss',
  imports: [
    ReactiveFormsModule,
    TranslateDirective,
    OibusCommandTypeEnumPipe,
    BoxComponent,
    OI_FORM_VALIDATION_DIRECTIVES,
    SaveButtonComponent
  ]
})
export class RegisterOibusModalComponent {
  private modal = inject(NgbActiveModal);
  private oibusService = inject(EngineService);
  private fb = inject(NonNullableFormBuilder);
  state = new ObservableState();
  form = this.fb.group({
    host: ['', Validators.required],
    useProxy: [false as boolean, Validators.required],
    proxyUrl: '',
    proxyUsername: '',
    proxyPassword: '',
    acceptUnauthorized: [false, Validators.required],
    commandRefreshInterval: [60, [Validators.required, Validators.min(1), Validators.max(3600)]],
    commandRetryInterval: [5, [Validators.required, Validators.min(1), Validators.max(3600)]],
    messageRetryInterval: [5, [Validators.required, Validators.min(1), Validators.max(3600)]],
    commandPermissions: this.fb.group({
      updateVersion: [true, Validators.required],
      restartEngine: [true, Validators.required],
      regenerateCipherKeys: [true, Validators.required],
      updateEngineSettings: [true, Validators.required],
      updateRegistrationSettings: [true, Validators.required],
      createScanMode: [true, Validators.required],
      updateScanMode: [true, Validators.required],
      deleteScanMode: [true, Validators.required],
      createIpFilter: [true, Validators.required],
      updateIpFilter: [true, Validators.required],
      deleteIpFilter: [true, Validators.required],
      createCertificate: [true, Validators.required],
      updateCertificate: [true, Validators.required],
      deleteCertificate: [true, Validators.required],
      createHistoryQuery: [true, Validators.required],
      updateHistoryQuery: [true, Validators.required],
      createOrUpdateHistoryItemsFromCsv: [true, Validators.required],
      testHistoryNorthConnection: [true, Validators.required],
      testHistorySouthConnection: [true, Validators.required],
      testHistorySouthItem: [true, Validators.required],
      deleteHistoryQuery: [true, Validators.required],
      createSouth: [true, Validators.required],
      updateSouth: [true, Validators.required],
      createOrUpdateSouthItemsFromCsv: [true, Validators.required],
      deleteSouth: [true, Validators.required],
      testSouthConnection: [true, Validators.required],
      testSouthItem: [true, Validators.required],
      createNorth: [true, Validators.required],
      updateNorth: [true, Validators.required],
      deleteNorth: [true, Validators.required],
      testNorthConnection: [true, Validators.required]
    })
  });
  mode: 'register' | 'edit' = 'register';
  host = '';

  /**
   * Prepares the component for edition.
   */
  prepare(registration: RegistrationSettingsDTO, mode: 'edit' | 'register') {
    this.mode = mode;
    this.form.patchValue({
      host: registration.host,
      useProxy: registration.useProxy,
      proxyUrl: registration.proxyUrl || '',
      proxyUsername: registration.proxyUsername || '',
      proxyPassword: '',
      acceptUnauthorized: registration.acceptUnauthorized,
      commandRefreshInterval: registration.commandRefreshInterval,
      commandRetryInterval: registration.commandRetryInterval,
      messageRetryInterval: registration.messageRetryInterval,
      commandPermissions: registration.commandPermissions
    });
    if (this.mode === 'edit') {
      this.host = registration.host;
      this.form.controls.host.disable();
    }
  }

  cancel() {
    this.modal.dismiss();
  }

  save() {
    if (!this.form.valid) {
      return;
    }

    const formValue = this.form.value;
    const commandHost = this.mode === 'edit' ? this.host : formValue.host!;

    const command: RegistrationSettingsCommandDTO = {
      host: commandHost,
      acceptUnauthorized: formValue.acceptUnauthorized!,
      useProxy: formValue.useProxy!,
      proxyUrl: formValue.proxyUrl!,
      proxyUsername: formValue.proxyUsername!,
      proxyPassword: formValue.proxyPassword!,
      commandRefreshInterval: formValue.commandRefreshInterval!,
      commandRetryInterval: formValue.commandRetryInterval!,
      messageRetryInterval: formValue.messageRetryInterval!,
      commandPermissions: {
        updateVersion: formValue.commandPermissions!.updateVersion!,
        restartEngine: formValue.commandPermissions!.restartEngine!,
        regenerateCipherKeys: formValue.commandPermissions!.regenerateCipherKeys!,
        updateEngineSettings: formValue.commandPermissions!.updateEngineSettings!,
        updateRegistrationSettings: formValue.commandPermissions!.updateRegistrationSettings!,
        createScanMode: formValue.commandPermissions!.createScanMode!,
        updateScanMode: formValue.commandPermissions!.updateScanMode!,
        deleteScanMode: formValue.commandPermissions!.deleteScanMode!,
        createIpFilter: formValue.commandPermissions!.createIpFilter!,
        updateIpFilter: formValue.commandPermissions!.updateIpFilter!,
        deleteIpFilter: formValue.commandPermissions!.deleteIpFilter!,
        createCertificate: formValue.commandPermissions!.createCertificate!,
        updateCertificate: formValue.commandPermissions!.updateCertificate!,
        deleteCertificate: formValue.commandPermissions!.deleteCertificate!,
        createHistoryQuery: formValue.commandPermissions!.createHistoryQuery!,
        updateHistoryQuery: formValue.commandPermissions!.updateHistoryQuery!,
        deleteHistoryQuery: formValue.commandPermissions!.deleteHistoryQuery!,
        createOrUpdateHistoryItemsFromCsv: formValue.commandPermissions!.createOrUpdateHistoryItemsFromCsv!,
        testHistoryNorthConnection: formValue.commandPermissions!.testHistoryNorthConnection!,
        testHistorySouthConnection: formValue.commandPermissions!.testHistorySouthConnection!,
        testHistorySouthItem: formValue.commandPermissions!.testHistorySouthItem!,
        createSouth: formValue.commandPermissions!.createSouth!,
        updateSouth: formValue.commandPermissions!.updateSouth!,
        deleteSouth: formValue.commandPermissions!.deleteSouth!,
        createOrUpdateSouthItemsFromCsv: formValue.commandPermissions!.createOrUpdateSouthItemsFromCsv!,
        testSouthConnection: formValue.commandPermissions!.testSouthConnection!,
        testSouthItem: formValue.commandPermissions!.testSouthItem!,
        createNorth: formValue.commandPermissions!.createNorth!,
        updateNorth: formValue.commandPermissions!.updateNorth!,
        deleteNorth: formValue.commandPermissions!.deleteNorth!,
        testNorthConnection: formValue.commandPermissions!.testNorthConnection!
      }
    };

    if (this.mode === 'register') {
      this.oibusService
        .updateRegistrationSettings(command)
        .pipe(this.state.pendingUntilFinalization())
        .subscribe(() => {
          this.modal.close();
        });
    } else {
      this.oibusService
        .editRegistrationSettings(command)
        .pipe(this.state.pendingUntilFinalization())
        .subscribe(() => {
          this.modal.close();
        });
    }
  }
  get commandPermissionsFormGroup(): FormGroup {
    return this.form.controls.commandPermissions as FormGroup;
  }

  get allPermissionsEnabled(): boolean {
    const permissions = this.commandPermissionsFormGroup.value;
    return Object.values(permissions).every(value => value === true);
  }

  get allPermissionsDisabled(): boolean {
    const permissions = this.commandPermissionsFormGroup.value;
    return Object.values(permissions).every(value => value === false);
  }

  enableAllPermissions() {
    Object.keys(this.commandPermissionsFormGroup.controls).forEach(key => {
      const control = this.commandPermissionsFormGroup.get(key);
      if (control instanceof FormControl) {
        control.setValue(true);
      }
    });
  }

  disableAllPermissions() {
    Object.keys(this.commandPermissionsFormGroup.controls).forEach(key => {
      const control = this.commandPermissionsFormGroup.get(key);
      if (control instanceof FormControl) {
        control.setValue(false);
      }
    });
  }
}
