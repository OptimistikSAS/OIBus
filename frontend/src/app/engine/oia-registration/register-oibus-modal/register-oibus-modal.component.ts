import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';

import { RegistrationSettingsCommandDTO, RegistrationSettingsDTO } from '@oibus/shared/api/engine.model';
import { RegistrationCommandPermissions } from '@oibus/shared/domain/engine.model';

import { EngineService } from '../../../services/engine.service';
import { BoxComponent, BoxTitleDirective } from '../../../shared/box/box.component';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../../shared/form/form-validation-directives';
import { trackControl } from '../../../shared/form/tracked-control';
import { NotificationService } from '../../../shared/notification.service';
import { ObservableState, SaveButtonComponent } from '../../../shared/save-button/save-button.component';

type CommandPermission = keyof RegistrationCommandPermissions;

interface CommandPermissionSection {
  key: string;
  entries: ReadonlyArray<{ permission: CommandPermission; labelKey: string }>;
}

interface CommandPermissionGroup {
  key: string;
  sections: ReadonlyArray<CommandPermissionSection>;
}

/**
 * The command permissions, grouped as displayed. The labels are relative to their section (e.g. "Create" in "Scan mode").
 */
const COMMAND_PERMISSION_GROUPS: ReadonlyArray<CommandPermissionGroup> = [
  {
    key: 'oibus',
    sections: [
      {
        key: 'engine',
        entries: [
          { permission: 'updateVersion', labelKey: 'upgrade' },
          { permission: 'restartEngine', labelKey: 'restart' },
          { permission: 'updateEngineSettings', labelKey: 'settings' },
          { permission: 'importConfiguration', labelKey: 'import-config' }
        ]
      },
      {
        key: 'diagnostic',
        entries: [
          { permission: 'dumpMemory', labelKey: 'memory-dump' },
          { permission: 'retrieveLogsDatabase', labelKey: 'logs-database' }
        ]
      },
      {
        key: 'registration',
        entries: [
          { permission: 'regenerateCipherKeys', labelKey: 'cipher-keys' },
          { permission: 'updateRegistrationSettings', labelKey: 'update' }
        ]
      },
      {
        key: 'scan-mode',
        entries: [
          { permission: 'createScanMode', labelKey: 'create' },
          { permission: 'updateScanMode', labelKey: 'update' },
          { permission: 'deleteScanMode', labelKey: 'delete' }
        ]
      },
      {
        key: 'ip-filter',
        entries: [
          { permission: 'createIpFilter', labelKey: 'create' },
          { permission: 'updateIpFilter', labelKey: 'update' },
          { permission: 'deleteIpFilter', labelKey: 'delete' }
        ]
      },
      {
        key: 'certificate',
        entries: [
          { permission: 'createCertificate', labelKey: 'create' },
          { permission: 'updateCertificate', labelKey: 'update' },
          { permission: 'deleteCertificate', labelKey: 'delete' }
        ]
      },
      {
        key: 'transformers',
        entries: [
          { permission: 'createCustomTransformer', labelKey: 'create' },
          { permission: 'updateCustomTransformer', labelKey: 'update' },
          { permission: 'deleteCustomTransformer', labelKey: 'delete' },
          { permission: 'testCustomTransformer', labelKey: 'test' }
        ]
      }
    ]
  },
  {
    key: 'connectors',
    sections: [
      {
        key: 'north-connector',
        entries: [
          { permission: 'createNorth', labelKey: 'create' },
          { permission: 'updateNorth', labelKey: 'update' },
          { permission: 'deleteNorth', labelKey: 'delete' }
        ]
      },
      {
        key: 'south-connector',
        entries: [
          { permission: 'createSouth', labelKey: 'create' },
          { permission: 'updateSouth', labelKey: 'update' },
          { permission: 'deleteSouth', labelKey: 'delete' }
        ]
      },
      {
        key: 'north-actions',
        entries: [
          { permission: 'testNorthConnection', labelKey: 'test-connection' },
          { permission: 'setpoint', labelKey: 'setpoint' }
        ]
      },
      {
        key: 'south-actions',
        entries: [
          { permission: 'testSouthConnection', labelKey: 'test-connection' },
          { permission: 'createOrUpdateSouthItemsFromCsv', labelKey: 'import-items' },
          { permission: 'testSouthItem', labelKey: 'test-item' }
        ]
      },
      {
        key: 'north-cache',
        entries: [
          { permission: 'searchNorthCacheContent', labelKey: 'search' },
          { permission: 'getNorthCacheFileContent', labelKey: 'view-file' },
          { permission: 'updateNorthCacheContent', labelKey: 'update' }
        ]
      }
    ]
  },
  {
    key: 'history-query',
    sections: [
      {
        key: 'history-query',
        entries: [
          { permission: 'createHistoryQuery', labelKey: 'create' },
          { permission: 'updateHistoryQuery', labelKey: 'update' },
          { permission: 'deleteHistoryQuery', labelKey: 'delete' },
          { permission: 'createOrUpdateHistoryItemsFromCsv', labelKey: 'import-items' }
        ]
      },
      {
        key: 'test-history-query',
        entries: [
          { permission: 'testHistoryNorthConnection', labelKey: 'north' },
          { permission: 'testHistorySouthConnection', labelKey: 'south' },
          { permission: 'testHistorySouthItem', labelKey: 'item' }
        ]
      },
      {
        key: 'history-cache',
        entries: [
          { permission: 'searchHistoryCacheContent', labelKey: 'search' },
          { permission: 'getHistoryCacheFileContent', labelKey: 'view-file' },
          { permission: 'updateHistoryCacheContent', labelKey: 'update' }
        ]
      }
    ]
  }
];

@Component({
  selector: 'oib-register-oibus-modal',
  templateUrl: './register-oibus-modal.component.html',
  styleUrl: './register-oibus-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslateDirective, BoxComponent, BoxTitleDirective, OI_FORM_VALIDATION_DIRECTIVES, SaveButtonComponent]
})
export class RegisterOibusModalComponent {
  private readonly modal = inject(NgbActiveModal);
  private readonly oibusService = inject(EngineService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly notificationService = inject(NotificationService);
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
    acceptUnauthorized: [false as boolean, Validators.required],
    commandRefreshInterval: [60, [Validators.required, Validators.min(1), Validators.max(3600)]],
    commandRetryInterval: [5, [Validators.required, Validators.min(1), Validators.max(3600)]],
    messageRetryInterval: [5, [Validators.required, Validators.min(1), Validators.max(3600)]],
    commandPermissions: this.fb.group({
      updateVersion: [true, Validators.required],
      restartEngine: [true, Validators.required],
      regenerateCipherKeys: [true, Validators.required],
      updateEngineSettings: [true, Validators.required],
      importConfiguration: [true, Validators.required],
      dumpMemory: [true, Validators.required],
      retrieveLogsDatabase: [true, Validators.required],
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
      testNorthConnection: [true, Validators.required],
      setpoint: [true, Validators.required],
      searchHistoryCacheContent: [true, Validators.required],
      getHistoryCacheFileContent: [true, Validators.required],
      updateHistoryCacheContent: [true, Validators.required],
      searchNorthCacheContent: [true, Validators.required],
      getNorthCacheFileContent: [true, Validators.required],
      updateNorthCacheContent: [true, Validators.required],
      createCustomTransformer: [true, Validators.required],
      updateCustomTransformer: [true, Validators.required],
      deleteCustomTransformer: [true, Validators.required],
      testCustomTransformer: [true, Validators.required]
    })
  });
  private mode: 'register' | 'edit' = 'register';
  private host = '';
  // the permissions are changed by code (prepare, enable/disable all), outside of the template events
  // patched by prepare(), possibly after the first rendering
  readonly useProxy = trackControl(() => this.form.controls.useProxy);
  readonly useApiGateway = trackControl(() => this.form.controls.useApiGateway);
  private readonly commandPermissions = trackControl(() => this.form.controls.commandPermissions);
  // the "All" / "None" buttons of a group are disabled when they would change nothing (locked permissions ignored)
  readonly permissionGroups = computed(() => {
    const controls = this.commandPermissions()!.controls;
    return COMMAND_PERMISSION_GROUPS.map(group => {
      const values = this.groupPermissions(group)
        .filter(permission => controls[permission].enabled)
        .map(permission => controls[permission].value);
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
          this.testError.set(httpError.error?.message || httpError.message || 'Unknown error occurred');
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
      acceptUnauthorized: formValue.acceptUnauthorized,
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

  isAllowed(permission: CommandPermission): boolean {
    return this.commandPermissions()!.controls[permission].value;
  }

  setGroupPermissions(group: CommandPermissionGroup, value: boolean) {
    const controls = this.form.controls.commandPermissions.controls;
    for (const permission of this.groupPermissions(group)) {
      // the permissions locked by the OIBus startup arguments are disabled
      if (controls[permission].enabled) {
        controls[permission].setValue(value);
      }
    }
  }

  private groupPermissions(group: CommandPermissionGroup): Array<CommandPermission> {
    return group.sections.flatMap(section => section.entries.map(entry => entry.permission));
  }
}
