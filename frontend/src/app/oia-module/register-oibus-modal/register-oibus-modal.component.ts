import { Component } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormBuilder, Validators } from '@angular/forms';
import { ObservableState, SaveButtonComponent } from '../../shared/save-button/save-button.component';
import { TranslateModule } from '@ngx-translate/core';
import { formDirectives } from '../../shared/form-directives';
import { EngineService } from '../../services/engine.service';
import { RegistrationSettingsCommandDTO, RegistrationSettingsDTO } from '../../../../../shared/model/engine.model';

@Component({
  selector: 'oib-register-oibus-modal',
  templateUrl: './register-oibus-modal.component.html',
  styleUrl: './register-oibus-modal.component.scss',
  imports: [...formDirectives, TranslateModule, SaveButtonComponent],
  standalone: true
})
export class RegisterOibusModalComponent {
  state = new ObservableState();
  form = this.fb.group({
    host: ['', Validators.required]
  });

  constructor(
    private modal: NgbActiveModal,
    private fb: FormBuilder,
    private oibusService: EngineService
  ) {}

  /**
   * Prepares the component for edition.
   */
  prepare(registration: RegistrationSettingsDTO) {
    this.form.patchValue({
      host: registration.host
    });
  }

  cancel() {
    this.modal.dismiss();
  }

  save() {
    if (!this.form.valid) {
      return;
    }

    const formValue = this.form.value;

    const command: RegistrationSettingsCommandDTO = {
      host: formValue.host!
    };

    this.oibusService
      .updateRegistrationSettings(command)
      .pipe(this.state.pendingUntilFinalization())
      .subscribe(() => {
        this.modal.close();
      });
  }
}
