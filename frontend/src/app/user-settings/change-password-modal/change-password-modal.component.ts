import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';

import { NgbActiveModal, NgbCollapse } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';
import { switchMap } from 'rxjs';

import { UserSettingsService } from '../../services/user-settings.service';
import { NotificationService } from '../../shared/notification.service';
import {
  ChangePasswordFieldsComponent,
  createChangePasswordForm,
  toChangePasswordCommand
} from '../change-password-fields/change-password-fields.component';

/**
 * Changes the password of the current user from their settings. A user who must change it first does it on the password
 * change page instead, which can't be left without changing it.
 */
@Component({
  selector: 'oib-change-password-modal',
  templateUrl: './change-password-modal.component.html',
  styleUrl: './change-password-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateDirective, NgbCollapse, ReactiveFormsModule, ChangePasswordFieldsComponent]
})
export class ChangePasswordModalComponent {
  private modal = inject(NgbActiveModal);
  private notificationService = inject(NotificationService);
  private userSettingsService = inject(UserSettingsService);

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
}
