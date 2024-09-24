import { Component, inject } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { ObservableState, SaveButtonComponent } from '../../../shared/save-button/save-button.component';
import { TranslateModule } from '@ngx-translate/core';
import { formDirectives } from '../../../shared/form-directives';
import { EngineService } from '../../../services/engine.service';
import { LOG_LEVELS, RegistrationSettingsCommandDTO, RegistrationSettingsDTO } from '../../../../../../shared/model/engine.model';

@Component({
  selector: 'oib-register-oibus-modal',
  templateUrl: './register-oibus-modal.component.html',
  styleUrl: './register-oibus-modal.component.scss',
  imports: [...formDirectives, TranslateModule, SaveButtonComponent],
  standalone: true
})
export class RegisterOibusModalComponent {
  state = new ObservableState();
  form = inject(NonNullableFormBuilder).group({
    host: ['', Validators.required],
    useProxy: [false as boolean, Validators.required],
    proxyUrl: '',
    proxyUsername: '',
    proxyPassword: '',
    acceptUnauthorized: [false, Validators.required]
  });
  mode: 'register' | 'edit' = 'register';
  host = '';

  constructor(
    private modal: NgbActiveModal,
    private oibusService: EngineService
  ) {}

  /**
   * Prepares the component for edition.
   */
  prepare(registration: RegistrationSettingsDTO, mode: 'edit' | 'register') {
    this.mode = mode;
    this.form.patchValue({
      host: registration.host,
      useProxy: registration.useProxy,
      proxyUrl: registration.proxyUrl || '',
      proxyUsername: registration.proxyUsername || '',
      proxyPassword: '',
      acceptUnauthorized: registration.acceptUnauthorized
    });
    if (this.mode === 'edit') {
      this.host = registration.host;
      this.form.controls.host.disable();
    }
  }

  cancel() {
    this.modal.dismiss();
  }

  save() {
    if (!this.form.valid) {
      return;
    }

    const formValue = this.form.value;

    if (this.mode === 'register') {
      const command: RegistrationSettingsCommandDTO = {
        host: formValue.host!,
        acceptUnauthorized: formValue.acceptUnauthorized!,
        useProxy: formValue.useProxy!,
        proxyUrl: formValue.proxyUrl!,
        proxyUsername: formValue.proxyUsername!,
        proxyPassword: formValue.proxyPassword!
      };
      this.oibusService
        .updateRegistrationSettings(command)
        .pipe(this.state.pendingUntilFinalization())
        .subscribe(() => {
          this.modal.close();
        });
    } else {
      const command: RegistrationSettingsCommandDTO = {
        host: this.host,
        acceptUnauthorized: formValue.acceptUnauthorized!,
        useProxy: formValue.useProxy!,
        proxyUrl: formValue.proxyUrl!,
        proxyUsername: formValue.proxyUsername!,
        proxyPassword: formValue.proxyPassword!
      };
      this.oibusService
        .editRegistrationSettings(command)
        .pipe(this.state.pendingUntilFinalization())
        .subscribe(() => {
          this.modal.close();
        });
    }
  }

  protected readonly logLevels = LOG_LEVELS;
}
