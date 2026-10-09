import { TestBed } from '@angular/core/testing';

import { firstValueFrom, Observable, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { UserCommandDTO, UserDTO } from '@oibus/shared/api/user.model';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import testData from '../../../test/test-data';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { UserSettingsService } from '../../services/user-settings.service';
import { provideCurrentUser } from '../../shared/current-user-testing';
import { DefaultValidationErrorsComponent } from '../../shared/default-validation-errors/default-validation-errors.component';
import { provideNgbConfigTesting } from '../../shared/form/oi-ngb-testing';
import { MockModalService, provideModalTesting } from '../../shared/mock-modal.service.testing';
import { NotificationService } from '../../shared/notification.service';
import { UnsavedChangesConfirmationService } from '../../shared/unsaved-changes-confirmation.service';
import { WindowService } from '../../shared/window.service';
import { ChangePasswordModalComponent } from '../change-password-modal/change-password-modal.component';
import { EditUserSettingsComponent } from './edit-user-settings.component';

class EditUserSettingsComponentTester {
  readonly fixture = TestBed.createComponent(EditUserSettingsComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly title = this.root.getByRole('heading', { level: 1 });
  readonly firstName = this.root.getByLabelText('First name');
  readonly lastName = this.root.getByLabelText('Last name');
  readonly timezone = this.root.getByLabelText('Timezone');
  readonly language = this.root.getByLabelText('Language');
  readonly saveButton = this.root.getByRole('button', { name: 'Save' });
  readonly changePasswordButton = this.root.getByRole('button', { name: 'Change password' });

  canDeactivate(): Promise<boolean> {
    const result = this.fixture.componentInstance.canDeactivate();
    return typeof result === 'boolean' ? Promise.resolve(result) : firstValueFrom(result);
  }
}

describe('EditUserSettingsComponent', () => {
  let tester: EditUserSettingsComponentTester;
  let userSettingsService: MockObject<UserSettingsService>;
  let windowService: MockObject<WindowService>;
  let notificationService: MockObject<NotificationService>;
  let unsavedChangesConfirmationService: MockObject<UnsavedChangesConfirmationService>;

  // language en and timezone Europe/Paris, the ones currently used
  const userSettings: UserDTO = { ...testData.users.list[0], firstName: 'Admin', lastName: 'Admin', email: 'email@mail.fr' };
  const expectedCommand: UserCommandDTO = {
    login: 'admin',
    firstName: 'Admin',
    lastName: 'Admin',
    language: 'en',
    timezone: 'Europe/Paris',
    email: 'email@mail.fr'
  };

  beforeEach(() => {
    userSettingsService = createMock(UserSettingsService);
    windowService = createMock(WindowService);
    notificationService = createMock(NotificationService);
    unsavedChangesConfirmationService = createMock(UnsavedChangesConfirmationService);

    userSettingsService.currentUser.mockReturnValue(of(userSettings));
    userSettingsService.update.mockReturnValue(of(undefined));
    unsavedChangesConfirmationService.confirmUnsavedChanges.mockReturnValue(of(false));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideNgbConfigTesting(),
        provideModalTesting(),
        provideCurrentUser(userSettings),
        { provide: UserSettingsService, useValue: userSettingsService },
        { provide: WindowService, useValue: windowService },
        { provide: NotificationService, useValue: notificationService },
        { provide: UnsavedChangesConfirmationService, useValue: unsavedChangesConfirmationService }
      ]
    });

    TestBed.createComponent(DefaultValidationErrorsComponent);
    tester = new EditUserSettingsComponentTester();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('should display a populated form', async () => {
    await expect.element(tester.title).toHaveTextContent('admin');
    await expect.element(tester.root.getByText('Login: admin')).toBeVisible();
    await expect.element(tester.firstName).toHaveValue('Admin');
    await expect.element(tester.lastName).toHaveValue('Admin');
    await expect.element(tester.timezone).toHaveValue('Europe/Paris');
    await expect.element(tester.language).toHaveDisplayValue('English');
  });

  test('should save without reloading if language and timezone are not changed', async () => {
    await tester.firstName.fill('another');
    await tester.lastName.fill('user');
    await expect(tester.canDeactivate()).resolves.toBe(false);

    await tester.saveButton.click();

    expect(userSettingsService.update).toHaveBeenCalledWith(userSettings.id, {
      ...expectedCommand,
      firstName: 'another',
      lastName: 'user'
    });
    expect(notificationService.success).toHaveBeenCalledWith('user-settings.edit-user-settings.saved');
    // the settings are reloaded from the server
    expect(userSettingsService.currentUser).toHaveBeenCalledTimes(2);
    await expect.element(tester.firstName).toHaveValue('Admin');
    await expect(tester.canDeactivate()).resolves.toBe(true);
    expect(windowService.reload).not.toHaveBeenCalled();
  });

  test('should save and reload if the timezone is changed', async () => {
    userSettingsService.currentUser.mockReturnValueOnce(of(userSettings)).mockReturnValue(of({ ...userSettings, timezone: 'Asia/Tokyo' }));
    tester = new EditUserSettingsComponentTester();
    await expect.element(tester.timezone).toHaveValue('Europe/Paris');

    await tester.timezone.fill('Tokyo');
    await page.getByRole('option', { name: 'Asia/Tokyo' }).click();
    await expect.element(tester.timezone).toHaveValue('Asia/Tokyo');

    vi.useFakeTimers();
    await tester.saveButton.click();

    expect(userSettingsService.update).toHaveBeenCalledWith(userSettings.id, { ...expectedCommand, timezone: 'Asia/Tokyo' });
    expect(windowService.reload).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(500);
    expect(windowService.storeLanguage).toHaveBeenCalledWith('en');
    expect(windowService.storeTimezone).toHaveBeenCalledWith('Asia/Tokyo');
    expect(windowService.reload).toHaveBeenCalledTimes(1);
  });

  test('should save and reload if the language is changed', async () => {
    userSettingsService.currentUser.mockReturnValueOnce(of(userSettings)).mockReturnValue(of({ ...userSettings, language: 'fr' }));
    tester = new EditUserSettingsComponentTester();
    await expect.element(tester.language).toHaveDisplayValue('English');

    await tester.language.selectOptions('Français');
    vi.useFakeTimers();
    await tester.saveButton.click();

    expect(userSettingsService.update).toHaveBeenCalledWith(userSettings.id, { ...expectedCommand, language: 'fr' });
    expect(windowService.reload).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(500);
    expect(windowService.storeLanguage).toHaveBeenCalledWith('fr');
    expect(windowService.storeTimezone).toHaveBeenCalledWith('Europe/Paris');
    expect(windowService.reload).toHaveBeenCalledTimes(1);
  });

  test.each([
    {
      field: 'first name',
      locator: (t: EditUserSettingsComponentTester) => t.firstName,
      error: 'This field must have at most 50 characters'
    },
    { field: 'last name', locator: (t: EditUserSettingsComponentTester) => t.lastName, error: 'This field must have at most 50 characters' }
  ])('should not save a $field longer than 50 characters', async ({ locator, error }) => {
    await locator(tester).fill('a'.repeat(51));
    await tester.saveButton.click();

    await expect.element(tester.root.getByText(error)).toBeVisible();
    expect(userSettingsService.update).not.toHaveBeenCalled();
  });

  test('should ask for confirmation before leaving with unsaved changes', async () => {
    await expect.element(tester.firstName).toHaveValue('Admin');
    await expect(tester.canDeactivate()).resolves.toBe(true);
    expect(unsavedChangesConfirmationService.confirmUnsavedChanges).not.toHaveBeenCalled();

    await tester.firstName.fill('another');
    const confirmation: Observable<boolean> = of(true);
    unsavedChangesConfirmationService.confirmUnsavedChanges.mockReturnValue(confirmation);

    expect(tester.fixture.componentInstance.canDeactivate()).toBe(confirmation);
  });

  test('should open the change password modal', async () => {
    const modalService = TestBed.inject(MockModalService<ChangePasswordModalComponent>);
    modalService.mockClosedModal(createMock(ChangePasswordModalComponent));
    const open = vi.spyOn(modalService, 'open');

    await tester.changePasswordButton.click();

    expect(open).toHaveBeenCalledWith(ChangePasswordModalComponent, { size: 'sm', backdrop: 'static' });
  });
});
