import { TestBed } from '@angular/core/testing';

import { ChangePasswordModalComponent } from './change-password-modal.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { of } from 'rxjs';
import { UserSettingsService } from '../../services/user-settings.service';
import { DefaultValidationErrorsComponent } from '../../shared/default-validation-errors/default-validation-errors.component';
import { formDirectives } from '../../shared/form-directives';
import { provideTestingI18n } from '../../../i18n/mock-i18n';

class ChangePasswordModalComponentTester extends ComponentTester<ChangePasswordModalComponent> {
  constructor() {
    super(ChangePasswordModalComponent);
  }

  get currentPassword() {
    return this.input('#current-password')!;
  }

  get newPassword() {
    return this.input('#new-password')!;
  }

  get newPasswordConfirmation() {
    return this.input('#new-password-confirmation')!;
  }

  get save() {
    return this.button('#change-password-button')!;
  }

  get cancel() {
    return this.button('#cancel-button')!;
  }

  get errors() {
    return this.elements('val-errors div');
  }
}

describe('ChangePasswordModalComponent', () => {
  let tester: ChangePasswordModalComponentTester;
  let activeModal: jasmine.SpyObj<NgbActiveModal>;
  let userSettingsService: jasmine.SpyObj<UserSettingsService>;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);
    userSettingsService = createMock(UserSettingsService);

    TestBed.configureTestingModule({
      imports: [...formDirectives, ChangePasswordModalComponent],
      providers: [
        provideTestingI18n(),
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: UserSettingsService, useValue: userSettingsService }
      ]
    });

    TestBed.createComponent(DefaultValidationErrorsComponent).detectChanges();

    tester = new ChangePasswordModalComponentTester();
    tester.detectChanges();
  });

  it('should display an empty form', () => {
    expect(tester.currentPassword).toHaveValue('');
    expect(tester.newPassword).toHaveValue('');
    expect(tester.newPasswordConfirmation).toHaveValue('');
  });

  it('should validate', () => {
    tester.save.click();

    expect(userSettingsService.changePassword).not.toHaveBeenCalled();

    // all 3 fields are required
    expect(tester.errors.length).toBe(3);
    expect(tester.testElement).not.toContainText('The new password and its confirmation must be identical');

    tester.newPassword.fillWith('ABCDef8!');
    tester.newPasswordConfirmation.fillWith('new2');
    expect(tester.errors.length).toBe(2);
    expect(tester.testElement).toContainText('The new password and its confirmation must be identical');

    tester.newPasswordConfirmation.fillWith('ABCDef8!');
    expect(tester.errors.length).toBe(1);
    expect(tester.testElement).not.toContainText('The new password and its confirmation must be identical');
  });

  it('should save the change', () => {
    tester.currentPassword.fillWith('current');
    tester.newPassword.fillWith('newABCD12!');
    tester.newPasswordConfirmation.fillWith('newABCD12!');

    userSettingsService.changePassword.and.returnValue(of(undefined));
    tester.save.click();

    expect(userSettingsService.changePassword).toHaveBeenCalledWith({
      currentPassword: 'current',
      newPassword: 'newABCD12!'
    });
    expect(activeModal.close).toHaveBeenCalled();
  });

  it('should close without saving', () => {
    tester.cancel.click();
    expect(userSettingsService.changePassword).not.toHaveBeenCalled();
    expect(activeModal.dismiss).toHaveBeenCalled();
  });
});
