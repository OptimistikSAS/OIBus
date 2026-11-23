import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import {
  AbstractControl,
  ControlContainer,
  FormControl,
  FormGroup,
  FormGroupDirective,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';

import { TranslateDirective } from '@ngx-translate/core';

import { ChangePasswordCommand } from '@oibus/shared/api/user.model';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@oibus/shared/domain/user.model';

import { OI_FORM_VALIDATION_DIRECTIVES } from '../../shared/form/form-validation-directives';

export type ChangePasswordForm = FormGroup<{
  currentPassword: FormControl<string>;
  newPasswordForm: FormGroup<{
    newPassword: FormControl<string>;
    newPasswordConfirmation: FormControl<string>;
  }>;
}>;

function samePasswordValidator(newPasswordForm: AbstractControl): ValidationErrors | null {
  const { newPassword, newPasswordConfirmation } = newPasswordForm.value;
  return newPassword && newPasswordConfirmation && newPassword !== newPasswordConfirmation ? { samePassword: true } : null;
}

/** The form of a password change: the current password, and the new one entered twice */
export function createChangePasswordForm(fb: NonNullableFormBuilder): ChangePasswordForm {
  return fb.group({
    currentPassword: ['', Validators.required],
    newPasswordForm: fb.group(
      {
        newPassword: ['', [Validators.required, Validators.minLength(PASSWORD_MIN_LENGTH), Validators.maxLength(PASSWORD_MAX_LENGTH)]],
        newPasswordConfirmation: ['', Validators.required]
      },
      { validators: samePasswordValidator }
    )
  });
}

export function toChangePasswordCommand(form: ChangePasswordForm): ChangePasswordCommand {
  const value = form.getRawValue();
  return { currentPassword: value.currentPassword, newPassword: value.newPasswordForm.newPassword };
}

/**
 * The fields of a password change, inside the `[formGroup]` of the page or modal that submits it (a form created by
 * `createChangePasswordForm`)
 */
@Component({
  selector: 'oib-change-password-fields',
  templateUrl: './change-password-fields.component.html',
  styleUrl: './change-password-fields.component.scss',
  viewProviders: [{ provide: ControlContainer, useExisting: FormGroupDirective }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateDirective, ReactiveFormsModule, OI_FORM_VALIDATION_DIRECTIVES]
})
export class ChangePasswordFieldsComponent {
  readonly form = input.required<ChangePasswordForm>();
}
