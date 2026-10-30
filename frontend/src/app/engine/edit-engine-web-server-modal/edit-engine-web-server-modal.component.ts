import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';

import { EngineSettingsDTO } from '@oibus/shared/api/engine.model';
import { AuthTokenDuration, WebServerCertificateSource } from '@oibus/shared/domain/engine.model';

import { CertificateService } from '../../services/certificate.service';
import { EngineService } from '../../services/engine.service';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../shared/form/form-validation-directives';
import { ModalService } from '../../shared/modal.service';
import { NotificationService } from '../../shared/notification.service';
import { PortRedirectModalComponent } from '../../shared/port-redirect-modal/port-redirect-modal.component';

@Component({
  selector: 'oib-edit-engine-web-server-modal',
  templateUrl: './edit-engine-web-server-modal.component.html',
  styleUrl: './edit-engine-web-server-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateDirective, ReactiveFormsModule, OI_FORM_VALIDATION_DIRECTIVES]
})
export class EditEngineWebServerModalComponent {
  private readonly modal = inject(NgbActiveModal);
  private readonly engineService = inject(EngineService);
  private readonly certificateService = inject(CertificateService);
  private readonly notificationService = inject(NotificationService);
  private readonly modalService = inject(ModalService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly authTokenDurationOptions: Array<{ value: AuthTokenDuration; labelKey: string }> = [
    { value: '1h', labelKey: 'engine.web-server-settings.auth-token-duration-options.1h' },
    { value: '6h', labelKey: 'engine.web-server-settings.auth-token-duration-options.6h' },
    { value: '1d', labelKey: 'engine.web-server-settings.auth-token-duration-options.1d' },
    { value: '3d', labelKey: 'engine.web-server-settings.auth-token-duration-options.3d' },
    { value: '7d', labelKey: 'engine.web-server-settings.auth-token-duration-options.7d' },
    { value: '14d', labelKey: 'engine.web-server-settings.auth-token-duration-options.14d' },
    { value: '30d', labelKey: 'engine.web-server-settings.auth-token-duration-options.30d' }
  ];

  readonly certificateSourceOptions: Array<{ value: WebServerCertificateSource; labelKey: string }> = [
    { value: 'store', labelKey: 'engine.web-server-settings.certificate-sources.store' },
    { value: 'file', labelKey: 'engine.web-server-settings.certificate-sources.file' }
  ];

  readonly certificates = toSignal(this.certificateService.list(), { initialValue: [] });

  readonly form = this.fb.group({
    port: [null as number | null, Validators.required],
    authTokenDuration: ['7d' as AuthTokenDuration, Validators.required],
    httpsEnabled: [false as boolean],
    certificateSource: ['store' as WebServerCertificateSource],
    certificateId: [null as string | null, Validators.required],
    certificatePath: [null as string | null, Validators.required],
    privateKeyPath: [null as string | null, Validators.required],
    enableContentEndpoint: [false as boolean]
  });

  /** Signals of the controls showing the https fields, for the template (the form is also patched by `initialize()`) */
  readonly httpsEnabled = toSignal(this.form.controls.httpsEnabled.valueChanges, { initialValue: this.form.controls.httpsEnabled.value });
  readonly certificateSource = toSignal(this.form.controls.certificateSource.valueChanges, {
    initialValue: this.form.controls.certificateSource.value
  });

  constructor() {
    this.updateHttpsControls();
    this.form.controls.httpsEnabled.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.updateHttpsControls());
    this.form.controls.certificateSource.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.updateHttpsControls());
  }

  initialize(settings: EngineSettingsDTO) {
    const https = settings.webServer.https;
    this.form.patchValue({
      port: settings.webServer.port,
      authTokenDuration: settings.webServer.authTokenDuration,
      httpsEnabled: https.enabled,
      certificateSource: https.certificateSource,
      certificateId: https.certificateId,
      certificatePath: https.certificatePath,
      privateKeyPath: https.privateKeyPath,
      enableContentEndpoint: settings.webServer.enableContentEndpoint
    });
  }

  /** Only the certificate fields of the selected source are validated, and only when https is enabled */
  private updateHttpsControls() {
    const { httpsEnabled, certificateSource, certificateId, certificatePath, privateKeyPath } = this.form.controls;
    const fromStore = httpsEnabled.value && certificateSource.value === 'store';
    const fromFile = httpsEnabled.value && certificateSource.value === 'file';
    if (httpsEnabled.value) {
      certificateSource.enable({ emitEvent: false });
    } else {
      certificateSource.disable({ emitEvent: false });
    }
    for (const [control, enabled] of [
      [certificateId, fromStore],
      [certificatePath, fromFile],
      [privateKeyPath, fromFile]
    ] as const) {
      if (enabled) {
        control.enable();
      } else {
        control.disable();
      }
    }
  }

  save() {
    if (!this.form.valid) {
      return;
    }
    const {
      port,
      authTokenDuration,
      httpsEnabled,
      certificateSource,
      certificateId,
      certificatePath,
      privateKeyPath,
      enableContentEndpoint
    } = this.form.getRawValue();
    this.engineService
      .updateEngineWebServer({
        port: port!,
        authTokenDuration,
        https: {
          enabled: httpsEnabled,
          certificateSource,
          certificateId: certificateId || null,
          certificatePath: certificatePath || null,
          privateKeyPath: privateKeyPath || null
        },
        enableContentEndpoint
      })
      .subscribe(result => {
        if (result.needsRedirect && result.newPort && result.newProtocol) {
          this.modal.close();
          const redirectModal = this.modalService.open(PortRedirectModalComponent, { backdrop: 'static', keyboard: false });
          redirectModal.componentInstance.initialize(result.newPort, result.newProtocol);
        } else {
          this.notificationService.success('engine.updated');
          this.modal.close();
        }
      });
  }

  cancel() {
    this.modal.dismiss();
  }
}
