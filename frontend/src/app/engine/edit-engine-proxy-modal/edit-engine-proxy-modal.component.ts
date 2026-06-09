import { Component, inject } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateDirective } from '@ngx-translate/core';
import { EngineService } from '../../services/engine.service';
import { NotificationService } from '../../shared/notification.service';
import { EngineSettingsDTO } from '../../../../../backend/shared/model/engine.model';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../shared/form/form-validation-directives';

@Component({
  selector: 'oib-edit-engine-proxy-modal',
  templateUrl: './edit-engine-proxy-modal.component.html',
  styleUrl: './edit-engine-proxy-modal.component.scss',
  imports: [TranslateDirective, ReactiveFormsModule, OI_FORM_VALIDATION_DIRECTIVES]
})
export class EditEngineProxyModalComponent {
  private modal = inject(NgbActiveModal);
  private engineService = inject(EngineService);
  private notificationService = inject(NotificationService);

  private fb = inject(NonNullableFormBuilder);

  form = this.fb.group({
    proxyEnabled: [false as boolean, Validators.required],
    proxyPort: [null as number | null, Validators.required],
    proxyUsername: [null as string | null],
    proxyPassword: [null as string | null],
    forwardProxyEnabled: [false as boolean],
    forwardProxyUrl: [null as string | null]
  });

  constructor() {
    this.form.controls.proxyEnabled.valueChanges.subscribe(enabled => {
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
      }
    });

    this.form.controls.forwardProxyEnabled.valueChanges.subscribe(next => {
      if (next) {
        this.form.controls.forwardProxyUrl.enable();
      } else {
        this.form.controls.forwardProxyUrl.disable();
        this.form.controls.forwardProxyUrl.setValue(null);
      }
    });
  }

  initialize(settings: EngineSettingsDTO) {
    const forwardProxyEnabled = !!settings.forwardProxyUrl;
    this.form.patchValue({
      proxyEnabled: settings.proxyEnabled,
      proxyPort: settings.proxyPort,
      proxyUsername: settings.proxyUsername ?? null,
      proxyPassword: settings.proxyPassword ?? null,
      forwardProxyEnabled,
      forwardProxyUrl: settings.forwardProxyUrl ?? null
    });
    if (!settings.proxyEnabled) {
      this.form.controls.proxyPort.disable();
      this.form.controls.proxyUsername.disable();
      this.form.controls.proxyPassword.disable();
      this.form.controls.forwardProxyEnabled.disable();
      this.form.controls.forwardProxyUrl.disable();
    } else if (!forwardProxyEnabled) {
      this.form.controls.forwardProxyUrl.disable();
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
        proxyEnabled: formValue.proxyEnabled,
        proxyPort: formValue.proxyEnabled ? formValue.proxyPort : null,
        proxyUsername: formValue.proxyEnabled ? formValue.proxyUsername || null : null,
        proxyPassword: formValue.proxyEnabled ? formValue.proxyPassword || null : null,
        forwardProxyUrl: forwardActive ? formValue.forwardProxyUrl || null : null,
        forwardProxyUsername: forwardActive ? formValue.proxyUsername || null : null,
        forwardProxyPassword: forwardActive ? formValue.proxyPassword || null : null
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
