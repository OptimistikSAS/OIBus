import { fakeAsync, TestBed, tick } from '@angular/core/testing';

import { EditUserSettingsComponent } from './edit-user-settings.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { of } from 'rxjs';
import { MockModalService, provideModalTesting } from '../../shared/mock-modal.service.spec';
import { ChangePasswordModalComponent } from '../change-password-modal/change-password-modal.component';
import { User, UserCommandDTO } from '../../../../../shared/model/user.model';
import { TestTypeahead } from '../../shared/typeahead.test-utils';
import { UserSettingsService } from '../../services/user-settings.service';
import { WindowService } from '../../shared/window.service';
import { CurrentUserService } from '../../shared/current-user.service';
import { DefaultValidationErrorsComponent } from '../../shared/default-validation-errors/default-validation-errors.component';
import { TYPEAHEAD_DEBOUNCE_TIME } from '../../shared/typeahead';
import { provideI18nTesting } from '../../../i18n/mock-i18n';

class EditUserSettingsComponentTester extends ComponentTester<EditUserSettingsComponent> {
  constructor() {
    super(EditUserSettingsComponent);
  }

  get title() {
    return this.element('h1')!;
  }

  get changePassword() {
    return this.button('#open-change-password-modal-button')!;
  }

  get firstName() {
    return this.input('#first-name')!;
  }

  get lastName() {
    return this.input('#last-name')!;
  }

  get timezone() {
    return this.custom('#timezone', TestTypeahead)!;
  }
  get save() {
    return this.button('#save-button')!;
  }
}

describe('EditUserSettingsComponent', () => {
  let tester: EditUserSettingsComponentTester;

  let userSettingsService: jasmine.SpyObj<UserSettingsService>;
  let windowService: jasmine.SpyObj<WindowService>;
  let currentUserService: jasmine.SpyObj<CurrentUserService>;

  let userSettings: User;

  beforeEach(() => {
    userSettingsService = createMock(UserSettingsService);
    windowService = createMock(WindowService);
    currentUserService = createMock(CurrentUserService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideModalTesting(),
        { provide: UserSettingsService, useValue: userSettingsService },
        { provide: WindowService, useValue: windowService },
        { provide: CurrentUserService, useValue: currentUserService }
      ]
    });

    TestBed.createComponent(DefaultValidationErrorsComponent).detectChanges();

    userSettings = {
      id: 'id1',
      firstName: 'Admin',
      email: 'email@mail.fr',
      login: 'admin',
      lastName: 'Admin',
      language: 'en', // current language of the mock i18n translate service
      timezone: 'Europe/Paris' // current language of the mock i18n translate service
    } as User;
    userSettingsService.get.and.returnValue(of(userSettings));

    currentUserService.getTimezone.and.returnValue('Europe/Paris');

    tester = new EditUserSettingsComponentTester();
  });

  it('should display a populated form', () => {
    tester.detectChanges();

    expect(tester.title).toContainText('admin');
    expect(tester.firstName).toHaveValue('Admin');
    expect(tester.lastName).toHaveValue('Admin');
    expect(tester.timezone).toHaveValue('Europe/Paris');
  });

  it('should save without reloading if language and timezone are not changed', fakeAsync(() => {
    tester.detectChanges();

    tester.firstName.fillWith('another');
    tester.lastName.fillWith('user');
    tick(TYPEAHEAD_DEBOUNCE_TIME);

    userSettingsService.update.and.returnValue(of(undefined));

    tester.save.click();

    const expectedCommand: UserCommandDTO = {
      login: 'admin',
      firstName: 'another',
      lastName: 'user',
      language: 'en',
      timezone: 'Europe/Paris',
      email: 'email@mail.fr'
    };
    expect(userSettingsService.update).toHaveBeenCalledWith(userSettings.id, expectedCommand);

    tick(3000);

    expect(windowService.storeLanguage).not.toHaveBeenCalled();
    expect(windowService.storeTimezone).not.toHaveBeenCalled();
    expect(windowService.reload).not.toHaveBeenCalled();
  }));

  it('should save and reload if timezone is changed', fakeAsync(() => {
    tester.detectChanges();

    tester.timezone.fillWith('Asia/T').selectLabel('Asia/Tokyo');

    userSettingsService.update.and.returnValue(of(undefined));
    userSettingsService.get.and.returnValue(of({ ...userSettings, timezone: 'Asia/Tokyo' }));

    tester.save.click();

    const expectedCommand: UserCommandDTO = {
      login: 'admin',
      firstName: 'Admin',
      lastName: 'Admin',
      language: 'en',
      timezone: 'Asia/Tokyo',
      email: 'email@mail.fr'
    };
    expect(userSettingsService.update).toHaveBeenCalledWith(userSettings.id, expectedCommand);

    tick(3000);

    expect(windowService.storeTimezone).toHaveBeenCalledWith('Asia/Tokyo');
    expect(windowService.reload).toHaveBeenCalled();
  }));

  it('should open the change password modal', () => {
    const mockModalService = TestBed.inject(MockModalService);
    spyOn(mockModalService, 'open').and.callThrough();
    tester.detectChanges();
    mockModalService.mockClosedModal(ChangePasswordModalComponent);

    tester.changePassword.click();
    expect(mockModalService.open).toHaveBeenCalledWith(ChangePasswordModalComponent, jasmine.anything());
  });
});
