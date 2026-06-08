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
  imports: [TranslateDirective, ReactiveFormsModule, OI_FORM_VALIDATION_DIRECTIVES]
})
export class EditEngineProxyModalComponent {
  private modal = inject(NgbActiveModal);
  private engineService = inject(EngineService);
  private notificationService = inject(NotificationService);

  private fb = inject(NonNullableFormBuilder);

  form = this.fb.group({
    proxyEnabled: [false as boolean, Validators.required],
    proxyPort: [null as number | null, Validators.required]
  });

  constructor() {
    this.form.controls.proxyEnabled.valueChanges.subscribe(enabled => {
      if (enabled) {
        this.form.controls.proxyPort.enable();
      } else {
        this.form.controls.proxyPort.disable();
        this.form.controls.proxyPort.setValue(null);
      }
    });
  }

  initialize(settings: EngineSettingsDTO) {
    this.form.patchValue({ proxyEnabled: settings.proxyEnabled, proxyPort: settings.proxyPort });
    if (!settings.proxyEnabled) {
      this.form.controls.proxyPort.disable();
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
        proxyPort: formValue.proxyEnabled ? formValue.proxyPort : null
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
