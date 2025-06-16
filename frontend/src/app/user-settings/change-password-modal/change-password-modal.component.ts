import { Component, inject } from '@angular/core';
import { NgbActiveModal, NgbCollapse } from '@ng-bootstrap/ng-bootstrap';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { NotificationService } from '../../shared/notification.service';
import { ChangePasswordCommand } from '../../../../../backend/shared/model/user.model';
import { UserSettingsService } from '../../services/user-settings.service';

import { TranslateDirective } from '@ngx-translate/core';
import { switchMap } from 'rxjs';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../shared/form/form-validation-directives';

interface NewPasswordFormValue {
  newPassword: string;
  newPasswordConfirmation: string;
}

function samePasswordValidator(newPasswordForm: AbstractControl): ValidationErrors | null {
  const value: NewPasswordFormValue = newPasswordForm.value;
  return value.newPassword && value.newPasswordConfirmation && value.newPassword !== value.newPasswordConfirmation
    ? { samePassword: true }
    : null;
}

@Component({
  selector: 'oib-change-password-modal',
  templateUrl: './change-password-modal.component.html',
  styleUrl: './change-password-modal.component.scss',
  imports: [TranslateDirective, NgbCollapse, ReactiveFormsModule, OI_FORM_VALIDATION_DIRECTIVES]
})
export class ChangePasswordModalComponent {
  private modal = inject(NgbActiveModal);
  private notificationService = inject(NotificationService);
  private userSettingsService = inject(UserSettingsService);

  form = inject(NonNullableFormBuilder).group({
    currentPassword: ['', Validators.required],
    newPasswordForm: inject(NonNullableFormBuilder).group(
      {
        newPassword: ['', Validators.required],
        newPasswordConfirmation: ['', Validators.required]
      },
      { validators: samePasswordValidator }
    )
  });
  error = false;

  save() {
    if (!this.form.valid) {
      return;
    }

    this.error = false;
    const formValue = this.form.value;
    const command: ChangePasswordCommand = {
      currentPassword: formValue.currentPassword!,
      newPassword: formValue.newPasswordForm!.newPassword!
    };
    this.userSettingsService
      .get()
      .pipe(
        switchMap(user => {
          return this.userSettingsService.changePassword(user.id, command);
        })
      )
      .subscribe({
        next: () => {
          this.notificationService.success('user-settings.change-password.password-changed');
          this.modal.close();
        },
        error: () => (this.error = true)
      });
  }

  cancel() {
    this.modal.dismiss();
  }
}
