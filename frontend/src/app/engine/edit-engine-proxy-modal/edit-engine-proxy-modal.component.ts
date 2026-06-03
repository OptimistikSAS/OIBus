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
    forwardProxyUrl: [null as string | null],
    forwardProxyUsername: [null as string | null],
    forwardProxyPassword: [null as string | null]
  });

  constructor() {
    this.form.controls.proxyEnabled.valueChanges.subscribe(enabled => {
      if (enabled) {
        this.form.controls.proxyPort.enable();
        this.form.controls.forwardProxyUrl.enable();
        this.form.controls.forwardProxyUsername.enable();
        this.form.controls.forwardProxyPassword.enable();
      } else {
        this.form.controls.proxyPort.disable();
        this.form.controls.proxyPort.setValue(null);
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
    this.form.patchValue({
      proxyEnabled: settings.proxyEnabled,
      proxyPort: settings.proxyPort,
      forwardProxyUrl: settings.forwardProxyUrl ?? null,
      forwardProxyUsername: settings.forwardProxyUsername ?? null,
      forwardProxyPassword: settings.forwardProxyPassword ?? null
    });
    if (!settings.proxyEnabled) {
      this.form.controls.proxyPort.disable();
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
    this.engineService
      .updateEngineProxy({
        proxyEnabled: formValue.proxyEnabled,
        proxyPort: formValue.proxyEnabled ? formValue.proxyPort : null,
        forwardProxyUrl: formValue.proxyEnabled ? formValue.forwardProxyUrl || null : null,
        forwardProxyUsername: formValue.proxyEnabled ? formValue.forwardProxyUsername || null : null,
        forwardProxyPassword: formValue.proxyEnabled ? formValue.forwardProxyPassword || null : null
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
