import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';

import { EngineSettingsDTO } from '@oibus/shared/api/engine.model';

import { EngineService } from '../../services/engine.service';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../shared/form/form-validation-directives';
import { NotificationService } from '../../shared/notification.service';

@Component({
  selector: 'oib-edit-engine-general-modal',
  templateUrl: './edit-engine-general-modal.component.html',
  styleUrl: './edit-engine-general-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateDirective, ReactiveFormsModule, OI_FORM_VALIDATION_DIRECTIVES]
})
export class EditEngineGeneralModalComponent {
  private readonly modal = inject(NgbActiveModal);
  private readonly engineService = inject(EngineService);
  private readonly notificationService = inject(NotificationService);

  readonly form = inject(NonNullableFormBuilder).group({
    name: ['', Validators.required],
    description: ['']
  });

  initialize(settings: EngineSettingsDTO) {
    this.form.patchValue({ name: settings.general.name, description: settings.general.description ?? '' });
  }

  save() {
    if (!this.form.valid) {
      return;
    }
    const { name, description } = this.form.getRawValue();
    this.engineService.updateEngineGeneral({ name, description: description.trim() || null }).subscribe(() => {
      this.notificationService.success('engine.updated');
      this.modal.close();
    });
  }

  cancel() {
    this.modal.dismiss();
  }
}
