import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';

import { EngineSettingsDTO } from '@oibus/shared/api/engine.model';

import { EngineService } from '../../services/engine.service';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../shared/form/form-validation-directives';
import { NotificationService } from '../../shared/notification.service';

@Component({
  selector: 'oib-edit-engine-proxy-modal',
  templateUrl: './edit-engine-proxy-modal.component.html',
  styleUrl: './edit-engine-proxy-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateDirective, ReactiveFormsModule, OI_FORM_VALIDATION_DIRECTIVES]
})
export class EditEngineProxyModalComponent {
  private readonly modal = inject(NgbActiveModal);
  private readonly engineService = inject(EngineService);
  private readonly notificationService = inject(NotificationService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly form = this.fb.group({
    proxyEnabled: [false as boolean, Validators.required],
    proxyPort: [null as number | null, Validators.required],
    proxyUsername: [null as string | null],
    proxyPassword: [null as string | null],
    forwardProxyEnabled: [false as boolean],
    forwardProxyUrl: [null as string | null, Validators.required],
    forwardProxyUsername: [null as string | null],
    forwardProxyPassword: [null as string | null]
  });

  /** Whether the proxy server is enabled, as a signal for the template (the form is also patched by `initialize()`) */
  readonly proxyEnabled = toSignal(this.form.controls.proxyEnabled.valueChanges, { initialValue: this.form.controls.proxyEnabled.value });
  readonly forwardProxyEnabled = toSignal(this.form.controls.forwardProxyEnabled.valueChanges, {
    initialValue: this.form.controls.forwardProxyEnabled.value
  });

  constructor() {
    this.form.controls.proxyEnabled.valueChanges.pipe(takeUntilDestroyed()).subscribe(enabled => {
      if (enabled) {
        this.form.controls.proxyPort.enable();
        this.form.controls.proxyUsername.enable();
        this.form.controls.proxyPassword.enable();
        this.form.controls.forwardProxyEnabled.enable();
      } else {
        this.form.controls.proxyPort.disable();
        this.form.controls.proxyPort.setValue(null);
        this.form.controls.proxyUsername.disable();
        this.form.controls.proxyUsername.setValue(null);
        this.form.controls.proxyPassword.disable();
        this.form.controls.proxyPassword.setValue(null);
        this.form.controls.forwardProxyEnabled.disable();
        this.form.controls.forwardProxyEnabled.setValue(false);
        this.form.controls.forwardProxyUrl.disable();
        this.form.controls.forwardProxyUrl.setValue(null);
        this.form.controls.forwardProxyUsername.disable();
        this.form.controls.forwardProxyUsername.setValue(null);
        this.form.controls.forwardProxyPassword.disable();
        this.form.controls.forwardProxyPassword.setValue(null);
      }
    });

    this.form.controls.forwardProxyEnabled.valueChanges.pipe(takeUntilDestroyed()).subscribe(next => {
      if (next) {
        this.form.controls.forwardProxyUrl.enable();
        this.form.controls.forwardProxyUsername.enable();
        this.form.controls.forwardProxyPassword.enable();
      } else {
        this.form.controls.forwardProxyUrl.disable();
        this.form.controls.forwardProxyUrl.setValue(null);
        this.form.controls.forwardProxyUsername.disable();
        this.form.controls.forwardProxyUsername.setValue(null);
        this.form.controls.forwardProxyPassword.disable();
        this.form.controls.forwardProxyPassword.setValue(null);
      }
    });
  }

  initialize(settings: EngineSettingsDTO) {
    const forwardProxyEnabled = settings.proxyServer.forward.enabled;
    this.form.patchValue({
      proxyEnabled: settings.proxyServer.enabled,
      proxyPort: settings.proxyServer.port,
      proxyUsername: settings.proxyServer.username ?? null,
      proxyPassword: settings.proxyServer.password ?? null,
      forwardProxyEnabled,
      forwardProxyUrl: settings.proxyServer.forward.url ?? null,
      forwardProxyUsername: settings.proxyServer.forward.username ?? null,
      forwardProxyPassword: settings.proxyServer.forward.password ?? null
    });
    if (!settings.proxyServer.enabled) {
      this.form.controls.proxyPort.disable();
      this.form.controls.proxyUsername.disable();
      this.form.controls.proxyPassword.disable();
      this.form.controls.forwardProxyEnabled.disable();
      this.form.controls.forwardProxyUrl.disable();
      this.form.controls.forwardProxyUsername.disable();
      this.form.controls.forwardProxyPassword.disable();
    } else if (!forwardProxyEnabled) {
      this.form.controls.forwardProxyUrl.disable();
      this.form.controls.forwardProxyUsername.disable();
      this.form.controls.forwardProxyPassword.disable();
    }
  }

  save() {
    if (!this.form.valid) {
      return;
    }
    const formValue = this.form.getRawValue();
    const forwardActive = formValue.proxyEnabled && formValue.forwardProxyEnabled;
    this.engineService
      .updateEngineProxy({
        enabled: formValue.proxyEnabled,
        port: formValue.proxyEnabled ? formValue.proxyPort : null,
        username: formValue.proxyEnabled ? formValue.proxyUsername || null : null,
        password: formValue.proxyEnabled ? formValue.proxyPassword || null : null,
        forward: {
          enabled: forwardActive,
          url: forwardActive ? formValue.forwardProxyUrl! : undefined,
          username: forwardActive ? formValue.forwardProxyUsername || null : null,
          password: forwardActive ? formValue.forwardProxyPassword || null : null
        }
      })
      .subscribe(() => {
        this.notificationService.success('engine.updated');
        this.modal.close();
      });
  }

  cancel() {
    this.modal.dismiss();
  }
}
