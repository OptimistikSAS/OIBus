import { TestBed } from '@angular/core/testing';

import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { UserDTO } from '@oibus/shared/api/user.model';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import testData from '../../../test/test-data';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { UserSettingsService } from '../../services/user-settings.service';
import { CurrentUserService } from '../../shared/current-user.service';
import { DefaultValidationErrorsComponent } from '../../shared/default-validation-errors/default-validation-errors.component';
import { provideNgbConfigTesting } from '../../shared/form/oi-ngb-testing';
import { NotificationService } from '../../shared/notification.service';
import { ChangePasswordComponent } from './change-password.component';

class ChangePasswordComponentTester {
  readonly fixture = TestBed.createComponent(ChangePasswordComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly title = this.root.getByRole('heading', { name: 'Change password' });
  readonly changeRequired = this.root.getByText('This account still has the OIBus default password: change it before going on.');
  readonly currentPassword = this.root.getByLabelText('Current password');
  readonly newPassword = this.root.getByLabelText('New password', { exact: true });
  readonly newPasswordConfirmation = this.root.getByLabelText('New password confirmation');
  readonly saveButton = this.root.getByRole('button', { name: 'Save' });
  readonly logoutButton = this.root.getByRole('button', { name: 'Logout' });
  readonly alert = this.root.getByRole('alert');

  async fillForm(currentPassword: string, newPassword: string, confirmation: string) {
    await this.currentPassword.fill(currentPassword);
    await this.newPassword.fill(newPassword);
    await this.newPasswordConfirmation.fill(confirmation);
  }
}

describe('ChangePasswordComponent', () => {
  let tester: ChangePasswordComponentTester;
  let userSettingsService: MockObject<UserSettingsService>;
  let notificationService: MockObject<NotificationService>;
  let currentUserService: MockObject<CurrentUserService>;
  const user: UserDTO = { ...testData.users.list[0], mustChangePassword: true };

  beforeEach(() => {
    userSettingsService = createMock(UserSettingsService);
    notificationService = createMock(NotificationService);
    currentUserService = createMock(CurrentUserService);
    userSettingsService.currentUser.mockReturnValue(of(user));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideNgbConfigTesting(),
        { provide: UserSettingsService, useValue: userSettingsService },
        { provide: NotificationService, useValue: notificationService },
        { provide: CurrentUserService, useValue: currentUserService }
      ]
    });

    TestBed.createComponent(DefaultValidationErrorsComponent);
    tester = new ChangePasswordComponentTester();
  });

  test('should explain why the password must be changed, with an empty form', async () => {
    await expect.element(tester.title).toBeVisible();
    await expect.element(tester.changeRequired).toBeVisible();
    await expect.element(tester.currentPassword).toHaveValue('');
    await expect.element(tester.newPassword).toHaveValue('');
    await expect.element(tester.newPasswordConfirmation).toHaveValue('');
    await expect.element(tester.alert).not.toBeInTheDocument();
  });

  test('should not save when the form is invalid', async () => {
    await tester.fillForm('pass', 'new password', 'other');
    await tester.saveButton.click();

    await expect.element(tester.root.getByText('The new password and its confirmation must be identical')).toBeVisible();
    expect(userSettingsService.updatePassword).not.toHaveBeenCalled();
  });

  test('should change the password, then log out to log in with the new one', async () => {
    userSettingsService.updatePassword.mockReturnValue(of(undefined));

    await tester.fillForm('pass', 'new password', 'new password');
    await tester.saveButton.click();

    expect(userSettingsService.updatePassword).toHaveBeenCalledWith(user.id, { currentPassword: 'pass', newPassword: 'new password' });
    expect(notificationService.success).toHaveBeenCalledWith('user-settings.change-password.password-changed');
    expect(currentUserService.logout).toHaveBeenCalled();
  });

  test('should show an error and stay logged in when the change fails', async () => {
    userSettingsService.updatePassword.mockReturnValue(throwError(() => new Error('fail')));

    await tester.fillForm('wrong', 'new password', 'new password');
    await tester.saveButton.click();

    await expect
      .element(tester.alert)
      .toHaveTextContent('The password has not been changed. Make sure you enter the correct current password.');
    expect(currentUserService.logout).not.toHaveBeenCalled();
  });

  test('should log out without changing the password', async () => {
    await tester.logoutButton.click();

    expect(userSettingsService.updatePassword).not.toHaveBeenCalled();
    expect(currentUserService.logout).toHaveBeenCalled();
  });
});
