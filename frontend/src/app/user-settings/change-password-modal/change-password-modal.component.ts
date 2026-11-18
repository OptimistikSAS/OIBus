import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';

import { NgbActiveModal, NgbCollapse } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';
import { switchMap } from 'rxjs';

import { ChangePasswordCommand } from '@oibus/shared/api/user.model';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@oibus/shared/domain/user.model';

import { UserSettingsService } from '../../services/user-settings.service';
import { CurrentUserService } from '../../shared/current-user.service';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../shared/form/form-validation-directives';
import { NotificationService } from '../../shared/notification.service';

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
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateDirective, NgbCollapse, ReactiveFormsModule, OI_FORM_VALIDATION_DIRECTIVES]
})
export class ChangePasswordModalComponent {
  private modal = inject(NgbActiveModal);
  private notificationService = inject(NotificationService);
  private userSettingsService = inject(UserSettingsService);
  private currentUserService = inject(CurrentUserService);
  private fb = inject(NonNullableFormBuilder);

  readonly form = this.fb.group({
    currentPassword: ['', Validators.required],
    newPasswordForm: this.fb.group(
      {
        newPassword: ['', [Validators.required, Validators.minLength(PASSWORD_MIN_LENGTH), Validators.maxLength(PASSWORD_MAX_LENGTH)]],
        newPasswordConfirmation: ['', Validators.required]
      },
      { validators: samePasswordValidator }
    )
  });
  readonly error = signal(false);
  // Set when the user must change their password before doing anything else: the modal can then not be cancelled
  readonly forced = signal(false);

  forceChange() {
    this.forced.set(true);
  }

  save() {
    if (!this.form.valid) {
      return;
    }

    this.error.set(false);
    const formValue = this.form.value;
    const command: ChangePasswordCommand = {
      currentPassword: formValue.currentPassword!,
      newPassword: formValue.newPasswordForm!.newPassword!
    };
    this.userSettingsService
      .currentUser()
      .pipe(
        switchMap(user => {
          return this.userSettingsService.updatePassword(user.id, command);
        })
      )
      .subscribe({
        next: () => {
          this.notificationService.success('user-settings.change-password.password-changed');
          this.modal.close();
        },
        error: () => this.error.set(true)
      });
  }

  cancel() {
    this.modal.dismiss();
  }

  logout() {
    this.currentUserService.logout();
  }
}
