import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';

import { NgbCollapse } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';
import { switchMap } from 'rxjs';

import { UserSettingsService } from '../../services/user-settings.service';
import { CurrentUserService } from '../../shared/current-user.service';
import {
  ChangePasswordFieldsComponent,
  createChangePasswordForm,
  toChangePasswordCommand
} from '../../user-settings/change-password-fields/change-password-fields.component';
import { PASSWORD_CHANGED_PARAM } from '../authentication.guard';

/**
 * The page a user who must change their password (the default account still having the default password) is sent to,
 * whatever page they ask for: they can only change it or log out. Once changed, they are logged out, to log in with the
 * new password on a login page telling them it has been changed (a notification would not survive the reload).
 */
@Component({
  selector: 'oib-change-password',
  templateUrl: './change-password.component.html',
  styleUrl: './change-password.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslateDirective, NgbCollapse, ChangePasswordFieldsComponent]
})
export class ChangePasswordComponent {
  private userSettingsService = inject(UserSettingsService);
  private currentUserService = inject(CurrentUserService);

  readonly form = createChangePasswordForm(inject(NonNullableFormBuilder));
  readonly error = signal(false);

  save() {
    if (!this.form.valid) {
      return;
    }

    this.error.set(false);
    const command = toChangePasswordCommand(this.form);
    this.userSettingsService
      .currentUser()
      .pipe(switchMap(user => this.userSettingsService.updatePassword(user.id, command)))
      .subscribe({
        next: () => this.currentUserService.logout(`/login?${PASSWORD_CHANGED_PARAM}=true`),
        error: () => this.error.set(true)
      });
  }

  logout() {
    this.currentUserService.logout();
  }
}
