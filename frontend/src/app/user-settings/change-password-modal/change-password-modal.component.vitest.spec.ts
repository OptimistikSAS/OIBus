import { TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { of, throwError } from 'rxjs';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { UserSettingsService } from '../../services/user-settings.service';
import { DefaultValidationErrorsComponent } from '../../shared/default-validation-errors/default-validation-errors.component';
import { ChangePasswordModalComponent } from './change-password-modal.component';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { UserDTO } from '../../../../../backend/shared/model/user.model';
import testData from '../../../../../backend/src/tests/utils/test-data';

class ChangePasswordModalComponentTester {
  readonly fixture = TestBed.createComponent(ChangePasswordModalComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly currentPassword = this.root.getByCss('#current-password');
  readonly newPassword = this.root.getByCss('#new-password');
  readonly newPasswordConfirmation = this.root.getByCss('#new-password-confirmation');
  readonly saveButton = this.root.getByCss('#change-password-button');
  readonly cancelButton = this.root.getByCss('#cancel-button');
}

describe('ChangePasswordModalComponent', () => {
  let activeModal: MockObject<NgbActiveModal>;
  let userSettingsService: MockObject<UserSettingsService>;
  let userSettings: UserDTO;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);
    userSettingsService = createMock(UserSettingsService);

    userSettings = {
      ...testData.users.list[0],
      friendlyName: `${testData.users.list[0].firstName} ${testData.users.list[0].lastName}`,
      createdBy: { id: 'admin', friendlyName: 'admin' },
      updatedBy: { id: 'admin', friendlyName: 'admin' }
    } as UserDTO;
    userSettingsService.currentUser.mockReturnValue(of(userSettings));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: UserSettingsService, useValue: userSettingsService }
      ]
    });

    TestBed.createComponent(DefaultValidationErrorsComponent).detectChanges();
  });

  test('should display an empty form', async () => {
    const tester = new ChangePasswordModalComponentTester();
    tester.fixture.detectChanges();
    await expect.element(tester.currentPassword).toHaveValue('');
    await expect.element(tester.newPassword).toHaveValue('');
    await expect.element(tester.newPasswordConfirmation).toHaveValue('');
  });

  test('should not save when form is invalid', async () => {
    const tester = new ChangePasswordModalComponentTester();
    tester.fixture.detectChanges();
    await tester.saveButton.click();
    expect(userSettingsService.updatePassword).not.toHaveBeenCalled();
  });

  test('should save the change', async () => {
    userSettingsService.updatePassword.mockReturnValue(of(undefined));
    const tester = new ChangePasswordModalComponentTester();
    tester.fixture.detectChanges();
    await tester.currentPassword.fill('current');
    await tester.newPassword.fill('newABCD12!');
    await tester.newPasswordConfirmation.fill('newABCD12!');
    await tester.saveButton.click();
    expect(userSettingsService.updatePassword).toHaveBeenCalledWith(userSettings.id, {
      currentPassword: 'current',
      newPassword: 'newABCD12!'
    });
    expect(activeModal.close).toHaveBeenCalled();
  });

  test('should show error when save fails', async () => {
    userSettingsService.updatePassword.mockReturnValue(throwError(() => new Error('fail')));
    const tester = new ChangePasswordModalComponentTester();
    tester.fixture.detectChanges();
    await tester.currentPassword.fill('current');
    await tester.newPassword.fill('newABCD12!');
    await tester.newPasswordConfirmation.fill('newABCD12!');
    await tester.saveButton.click();
    expect(tester.fixture.componentInstance.error()).toBe(true);
    expect(activeModal.close).not.toHaveBeenCalled();
  });

  test('should close without saving on cancel', async () => {
    const tester = new ChangePasswordModalComponentTester();
    tester.fixture.detectChanges();
    await tester.cancelButton.click();
    expect(userSettingsService.updatePassword).not.toHaveBeenCalled();
    expect(activeModal.dismiss).toHaveBeenCalled();
  });
});
