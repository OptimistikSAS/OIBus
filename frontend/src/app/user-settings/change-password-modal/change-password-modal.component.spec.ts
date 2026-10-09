import { TestBed } from '@angular/core/testing';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { UserDTO } from '@oibus/shared/api/user.model';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import testData from '../../../test/test-data';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { UserSettingsService } from '../../services/user-settings.service';
import { DefaultValidationErrorsComponent } from '../../shared/default-validation-errors/default-validation-errors.component';
import { provideNgbConfigTesting } from '../../shared/form/oi-ngb-testing';
import { NotificationService } from '../../shared/notification.service';
import { ChangePasswordModalComponent } from './change-password-modal.component';

class ChangePasswordModalComponentTester {
  readonly fixture = TestBed.createComponent(ChangePasswordModalComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly currentPassword = this.root.getByLabelText('Current password');
  readonly newPassword = this.root.getByLabelText('New password', { exact: true });
  readonly newPasswordConfirmation = this.root.getByLabelText('New password confirmation');
  readonly saveButton = this.root.getByRole('button', { name: 'Save' });
  readonly cancelButton = this.root.getByRole('button', { name: 'Cancel' });
  readonly alert = this.root.getByRole('alert');
  readonly notIdenticalError = this.root.getByText('The new password and its confirmation must be identical');

  async fillForm(currentPassword: string, newPassword: string, confirmation: string) {
    await this.currentPassword.fill(currentPassword);
    await this.newPassword.fill(newPassword);
    await this.newPasswordConfirmation.fill(confirmation);
  }
}

describe('ChangePasswordModalComponent', () => {
  let tester: ChangePasswordModalComponentTester;
  let activeModal: MockObject<NgbActiveModal>;
  let userSettingsService: MockObject<UserSettingsService>;
  let notificationService: MockObject<NotificationService>;
  const userSettings: UserDTO = testData.users.list[0];

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);
    userSettingsService = createMock(UserSettingsService);
    notificationService = createMock(NotificationService);
    userSettingsService.currentUser.mockReturnValue(of(userSettings));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideNgbConfigTesting(),
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: UserSettingsService, useValue: userSettingsService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });

    TestBed.createComponent(DefaultValidationErrorsComponent);
    tester = new ChangePasswordModalComponentTester();
  });

  test('should display an empty form without error', async () => {
    await expect.element(tester.currentPassword).toHaveValue('');
    await expect.element(tester.newPassword).toHaveValue('');
    await expect.element(tester.newPasswordConfirmation).toHaveValue('');
    await expect.element(tester.alert).not.toBeInTheDocument();
  });

  test('should not save when the form is invalid', async () => {
    await tester.saveButton.click();

    await expect.element(tester.root.getByText('This field is required')).toHaveLength(3);
    expect(userSettingsService.updatePassword).not.toHaveBeenCalled();
  });

  test('should not save when the new password and its confirmation are different', async () => {
    await tester.fillForm('current', 'newABCD12!', 'other');
    await tester.saveButton.click();

    await expect.element(tester.notIdenticalError).toBeVisible();
    expect(userSettingsService.updatePassword).not.toHaveBeenCalled();

    await tester.newPasswordConfirmation.fill('newABCD12!');
    await expect.element(tester.notIdenticalError).not.toBeInTheDocument();
  });

  test('should save the change', async () => {
    userSettingsService.updatePassword.mockReturnValue(of(undefined));

    await tester.fillForm('current', 'newABCD12!', 'newABCD12!');
    await tester.saveButton.click();

    expect(userSettingsService.updatePassword).toHaveBeenCalledWith(userSettings.id, {
      currentPassword: 'current',
      newPassword: 'newABCD12!'
    });
    expect(notificationService.success).toHaveBeenCalledWith('user-settings.change-password.password-changed');
    expect(activeModal.close).toHaveBeenCalled();
  });

  test('should show an error when the save fails', async () => {
    userSettingsService.updatePassword.mockReturnValue(throwError(() => new Error('fail')));

    await tester.fillForm('current', 'newABCD12!', 'newABCD12!');
    await tester.saveButton.click();

    await expect.element(tester.alert).toBeVisible();
    await expect
      .element(tester.alert)
      .toHaveTextContent('The password has not been changed. Make sure you enter the correct current password.');
    expect(activeModal.close).not.toHaveBeenCalled();
  });

  test('should dismiss without saving on cancel', async () => {
    await tester.cancelButton.click();

    expect(userSettingsService.updatePassword).not.toHaveBeenCalled();
    expect(activeModal.dismiss).toHaveBeenCalled();
  });
});
