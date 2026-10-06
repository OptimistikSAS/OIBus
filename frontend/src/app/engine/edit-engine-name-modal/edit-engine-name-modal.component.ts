import { Component, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';

import { EngineSettingsDTO } from '@oibus/shared/api/engine.model';

import { EngineService } from '../../services/engine.service';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../shared/form/form-validation-directives';
import { NotificationService } from '../../shared/notification.service';

@Component({
  selector: 'oib-edit-engine-name-modal',
  templateUrl: './edit-engine-name-modal.component.html',
  styleUrl: './edit-engine-name-modal.component.scss',
  imports: [TranslateDirective, ReactiveFormsModule, OI_FORM_VALIDATION_DIRECTIVES]
})
export class EditEngineNameModalComponent {
  private modal = inject(NgbActiveModal);
  private engineService = inject(EngineService);
  private notificationService = inject(NotificationService);

  form = inject(NonNullableFormBuilder).group({
    name: ['', Validators.required]
  });

  initialize(settings: EngineSettingsDTO) {
    this.form.patchValue({ name: settings.general.name });
  }

  save() {
    if (!this.form.valid) {
      return;
    }
    const { name } = this.form.getRawValue();
    this.engineService.updateEngineName({ name }).subscribe(() => {
      this.notificationService.success('engine.updated');
      this.modal.close();
    });
  }

  cancel() {
    this.modal.dismiss();
  }
}
