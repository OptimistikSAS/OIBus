import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';
import { map } from 'rxjs';

import { RegistrationSettingsCommandDTO, RegistrationSettingsDTO } from '@oibus/shared/api/engine.model';
import { CommandPermission } from '@oibus/shared/domain/engine.model';
import { SERVER_CERTIFICATE_VALIDATIONS, ServerCertificateValidation } from '@oibus/shared/domain/server-identity.model';

import { CertificateService } from '../../../services/certificate.service';
import { EngineService } from '../../../services/engine.service';
import { BoxComponent, BoxTitleDirective } from '../../../shared/box/box.component';
import { extractErrorMessage } from '../../../shared/extract-error-message';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../../shared/form/form-validation-directives';
import { SelectOrCreateComponent } from '../../../shared/form/select-or-create/select-or-create.component';
import { trackControl } from '../../../shared/form/tracked-control';
import { NotificationService } from '../../../shared/notification.service';
import { ObservableState, SaveButtonComponent } from '../../../shared/save-button/save-button.component';
import { TrustedCertificateCreator } from '../../certificate-list/trusted-certificate-creator.service';

interface CommandPermissionGroup {
  key: string;
  permissions: ReadonlyArray<CommandPermission>;
}

/**
 * The permissions granted to OIAnalytics, grouped by what they put at risk.
 */
const COMMAND_PERMISSION_GROUPS: ReadonlyArray<CommandPermissionGroup> = [
  { key: 'lifecycle', permissions: ['updateVersion', 'operate'] },
  { key: 'configuration', permissions: ['configureEngine', 'configureDataFlow', 'configureCustomCode'] },
  { key: 'security', permissions: ['manageAccess', 'manageRegistration'] },
  { key: 'data', permissions: ['connectToDataSources', 'manageCache', 'diagnostics', 'setpoint'] }
];

@Component({
  selector: 'oib-register-oibus-modal',
  templateUrl: './register-oibus-modal.component.html',
  styleUrl: './register-oibus-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    TranslateDirective,
    BoxComponent,
    BoxTitleDirective,
    OI_FORM_VALIDATION_DIRECTIVES,
    SaveButtonComponent,
    SelectOrCreateComponent
  ]
})
export class RegisterOibusModalComponent {
  private readonly modal = inject(NgbActiveModal);
  private readonly oibusService = inject(EngineService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly notificationService = inject(NotificationService);
  private readonly certificateService = inject(CertificateService);
  readonly trustedCertificateCreator = inject(TrustedCertificateCreator);
  readonly certificateValidations = SERVER_CERTIFICATE_VALIDATIONS;
  // the certificate of OIAnalytics is validated against a certificate OIBus trusts, which has no private key
  readonly trustedCertificates = toSignal(
    this.certificateService.list().pipe(map(certificates => certificates.filter(certificate => certificate.kind === 'trusted'))),
    { initialValue: [] }
  );
  readonly state = new ObservableState();
  readonly testState = new ObservableState();
  readonly testLoading = signal(false);
  readonly testSuccess = signal(false);
  readonly testError = signal<string | null>(null);
  readonly ignoreRemoteUpdate = signal(false);

  readonly form = this.fb.group({
    host: ['', Validators.required],
    useProxy: [false as boolean, Validators.required],
    proxyUrl: '',
    proxyUsername: '',
    proxyPassword: '',
    useApiGateway: [false as boolean, Validators.required],
    apiGatewayHeaderKey: '',
    apiGatewayHeaderValue: '',
    apiGatewayBaseEndpoint: '',
    certificateValidation: ['standard' as ServerCertificateValidation, Validators.required],
    trustedCertificateId: [{ value: null as string | null, disabled: true }, Validators.required],
    commandRefreshInterval: [60, [Validators.required, Validators.min(1), Validators.max(3600)]],
    commandRetryInterval: [5, [Validators.required, Validators.min(1), Validators.max(3600)]],
    messageRetryInterval: [5, [Validators.required, Validators.min(1), Validators.max(3600)]],
    commandPermissions: this.fb.group({
      updateVersion: [true, Validators.required],
      operate: [true, Validators.required],
      configureEngine: [true, Validators.required],
      configureDataFlow: [true, Validators.required],
      configureCustomCode: [false, Validators.required],
      manageAccess: [true, Validators.required],
      manageRegistration: [true, Validators.required],
      connectToDataSources: [true, Validators.required],
      manageCache: [true, Validators.required],
      diagnostics: [false, Validators.required],
      setpoint: [false, Validators.required]
    })
  });
  private mode: 'register' | 'edit' = 'register';
  private host = '';
  // the permissions are changed by code (prepare, enable/disable all), outside of the template events
  // patched by prepare(), possibly after the first rendering
  readonly useProxy = trackControl(() => this.form.controls.useProxy);
  readonly useApiGateway = trackControl(() => this.form.controls.useApiGateway);
  readonly certificateValidation = toSignal(this.form.controls.certificateValidation.valueChanges, {
    initialValue: this.form.controls.certificateValidation.value
  });

  constructor() {
    // the trusted certificate is only selected, and required, with the trusted validation
    this.form.controls.certificateValidation.valueChanges.pipe(takeUntilDestroyed()).subscribe(validation => {
      if (validation === 'trusted') {
        this.form.controls.trustedCertificateId.enable();
      } else {
        this.form.controls.trustedCertificateId.disable();
      }
    });
  }
  private readonly commandPermissions = trackControl(() => this.form.controls.commandPermissions);
  // the "All" / "None" buttons of a group are disabled when they would change nothing (locked permissions ignored)
  readonly permissionGroups = computed(() => {
    const controls = this.commandPermissions()!.controls;
    return COMMAND_PERMISSION_GROUPS.map(group => {
      const values = group.permissions.filter(permission => controls[permission].enabled).map(permission => controls[permission].value);
      return { ...group, allAllowed: values.every(value => value), noneAllowed: values.every(value => !value) };
    });
  });

  /**
   * Prepares the component for edition.
   */
  prepare(registration: RegistrationSettingsDTO, mode: 'edit' | 'register', ignoreRemoteUpdate: boolean) {
    this.mode = mode;
    this.form.patchValue({
      host: registration.host,
      useProxy: registration.useProxy,
      proxyUrl: registration.proxyUrl || '',
      proxyUsername: registration.proxyUsername || '',
      proxyPassword: '',
      useApiGateway: registration.useApiGateway,
      apiGatewayHeaderKey: registration.apiGatewayHeaderKey || '',
      apiGatewayHeaderValue: '',
      apiGatewayBaseEndpoint: registration.apiGatewayBaseEndpoint || '',
      certificateValidation: registration.certificateValidation,
      trustedCertificateId: registration.trustedCertificateId,
      commandRefreshInterval: registration.commandRefreshInterval,
      commandRetryInterval: registration.commandRetryInterval,
      messageRetryInterval: registration.messageRetryInterval,
      commandPermissions: registration.commandPermissions
    });
    if (this.mode === 'edit') {
      this.host = registration.host;
      this.form.controls.host.disable();
    }
    if (ignoreRemoteUpdate) {
      this.ignoreRemoteUpdate.set(true);
      this.form.controls.commandPermissions.controls.updateVersion.setValue(false);
      this.form.controls.commandPermissions.controls.updateVersion.disable();
    }
  }

  cancel() {
    this.modal.dismiss();
  }

  testConnection() {
    if (!this.form.valid) {
      return;
    }

    const command = this.buildCommand();

    // Reset test state
    this.testLoading.set(true);
    this.testSuccess.set(false);
    this.testError.set(null);

    this.oibusService
      .testOIAnalyticsConnection(command)
      .pipe(this.testState.pendingUntilFinalization())
      .subscribe({
        next: () => {
          this.testSuccess.set(true);
          this.testLoading.set(false);
          this.notificationService.success('oia-module.registration.test-connection-success');
        },
        error: (httpError: HttpErrorResponse) => {
          this.testError.set(extractErrorMessage(httpError));
          this.testLoading.set(false);
        }
      });
  }

  save() {
    if (!this.form.valid) {
      return;
    }

    const command = this.buildCommand();
    if (this.mode === 'register') {
      this.oibusService
        .register(command)
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

  private buildCommand(): RegistrationSettingsCommandDTO {
    const formValue = this.form.getRawValue();
    return {
      host: this.mode === 'edit' ? this.host : formValue.host,
      certificateValidation: formValue.certificateValidation,
      trustedCertificateId: formValue.certificateValidation === 'trusted' ? formValue.trustedCertificateId : null,
      useProxy: formValue.useProxy,
      proxyUrl: formValue.proxyUrl,
      proxyUsername: formValue.proxyUsername,
      proxyPassword: formValue.proxyPassword,
      useApiGateway: formValue.useApiGateway,
      apiGatewayHeaderKey: formValue.apiGatewayHeaderKey,
      apiGatewayHeaderValue: formValue.apiGatewayHeaderValue,
      apiGatewayBaseEndpoint: formValue.apiGatewayBaseEndpoint,
      commandRefreshInterval: formValue.commandRefreshInterval,
      commandRetryInterval: formValue.commandRetryInterval,
      messageRetryInterval: formValue.messageRetryInterval,
      commandPermissions: { ...formValue.commandPermissions }
    };
  }

  setGroupPermissions(group: CommandPermissionGroup, value: boolean) {
    const controls = this.form.controls.commandPermissions.controls;
    for (const permission of group.permissions) {
      // the permissions locked by the OIBus startup arguments are disabled
      if (controls[permission].enabled) {
        controls[permission].setValue(value);
      }
    }
  }
}
