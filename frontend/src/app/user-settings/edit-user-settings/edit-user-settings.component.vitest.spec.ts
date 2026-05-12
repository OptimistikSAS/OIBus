import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { UserSettingsService } from '../../services/user-settings.service';
import { WindowService } from '../../shared/window.service';
import { CurrentUserService } from '../../shared/current-user.service';
import { ModalService } from '../../shared/modal.service';
import { DefaultValidationErrorsComponent } from '../../shared/default-validation-errors/default-validation-errors.component';
import { EditUserSettingsComponent } from './edit-user-settings.component';
import { ChangePasswordModalComponent } from '../change-password-modal/change-password-modal.component';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { UserCommandDTO, UserDTO } from '../../../../../backend/shared/model/user.model';

class EditUserSettingsComponentTester {
  readonly fixture = TestBed.createComponent(EditUserSettingsComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly title = this.root.getByCss('h1');
  readonly firstName = this.root.getByCss('#first-name');
  readonly lastName = this.root.getByCss('#last-name');
  readonly timezone = this.root.getByCss('#timezone');
  readonly saveButton = this.root.getByCss('#save-button');
  readonly changePasswordButton = this.root.getByCss('#open-change-password-modal-button');
}

describe('EditUserSettingsComponent', () => {
  let userSettingsService: MockObject<UserSettingsService>;
  let windowService: MockObject<WindowService>;
  let currentUserService: MockObject<CurrentUserService>;
  let modalService: MockObject<ModalService>;
  let userSettings: UserDTO;

  beforeEach(() => {
    userSettingsService = createMock(UserSettingsService);
    windowService = createMock(WindowService);
    currentUserService = createMock(CurrentUserService);
    modalService = createMock(ModalService);

    userSettings = {
      id: 'id1',
      firstName: 'Admin',
      email: 'email@mail.fr',
      login: 'admin',
      lastName: 'Admin',
      language: 'en',
      timezone: 'Europe/Paris'
    } as UserDTO;

    userSettingsService.currentUser.mockReturnValue(of(userSettings));
    currentUserService.getTimezone.mockReturnValue('Europe/Paris');

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: UserSettingsService, useValue: userSettingsService },
        { provide: WindowService, useValue: windowService },
        { provide: CurrentUserService, useValue: currentUserService },
        { provide: ModalService, useValue: modalService }
      ]
    });

    TestBed.createComponent(DefaultValidationErrorsComponent).detectChanges();
  });

  test('should display a populated form', async () => {
    const tester = new EditUserSettingsComponentTester();
    tester.fixture.detectChanges();
    await expect.element(tester.title).toHaveTextContent('admin');
    await expect.element(tester.firstName).toHaveValue('Admin');
    await expect.element(tester.lastName).toHaveValue('Admin');
    await expect.element(tester.timezone).toHaveValue('Europe/Paris');
  });

  test('should save without reloading if language and timezone are not changed', () => {
    userSettingsService.update.mockReturnValue(of(undefined));
    const tester = new EditUserSettingsComponentTester();
    tester.fixture.detectChanges();

    tester.fixture.componentInstance.form.controls.firstName.setValue('another');
    tester.fixture.componentInstance.form.controls.lastName.setValue('user');
    tester.fixture.detectChanges();

    tester.fixture.componentInstance.save();

    const expectedCommand: UserCommandDTO = {
      login: 'admin',
      firstName: 'another',
      lastName: 'user',
      language: 'en',
      timezone: 'Europe/Paris',
      email: 'email@mail.fr'
    };
    expect(userSettingsService.update).toHaveBeenCalledWith(userSettings.id, expectedCommand);
    expect(windowService.reload).not.toHaveBeenCalled();
  });

  test('should save and reload if timezone is changed', () => {
    vi.useFakeTimers();
    try {
      userSettingsService.update.mockReturnValue(of(undefined));
      userSettingsService.currentUser.mockReturnValue(of({ ...userSettings, timezone: 'Asia/Tokyo' }));
      const tester = new EditUserSettingsComponentTester();
      tester.fixture.detectChanges();

      tester.fixture.componentInstance.form.controls.timezone.setValue('Asia/Tokyo');
      tester.fixture.detectChanges();

      tester.fixture.componentInstance.save();

      vi.advanceTimersByTime(500);

      const expectedCommand: UserCommandDTO = {
        login: 'admin',
        firstName: 'Admin',
        lastName: 'Admin',
        language: 'en',
        timezone: 'Asia/Tokyo',
        email: 'email@mail.fr'
      };
      expect(userSettingsService.update).toHaveBeenCalledWith(userSettings.id, expectedCommand);
      expect(windowService.storeTimezone).toHaveBeenCalledWith('Asia/Tokyo');
      expect(windowService.reload).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  test('should open the change password modal', async () => {
    const tester = new EditUserSettingsComponentTester();
    tester.fixture.detectChanges();
    await tester.changePasswordButton.click();
    expect(modalService.open).toHaveBeenCalledWith(ChangePasswordModalComponent, expect.anything());
  });
});
