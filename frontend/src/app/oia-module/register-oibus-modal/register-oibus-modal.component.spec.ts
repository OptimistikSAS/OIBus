import { RegisterOibusModalComponent } from './register-oibus-modal.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { fakeAsync, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { DefaultValidationErrorsComponent } from '../../shared/default-validation-errors/default-validation-errors.component';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { EngineService } from '../../services/engine.service';
import { RegistrationSettingsCommandDTO, RegistrationSettingsDTO } from '../../../../../shared/model/engine.model';

class RegisterOibusModalComponentTester extends ComponentTester<RegisterOibusModalComponent> {
  constructor() {
    super(RegisterOibusModalComponent);
  }

  get host() {
    return this.input('#host')!;
  }

  get validationErrors() {
    return this.elements('val-errors div');
  }

  get save() {
    return this.button('#save-button')!;
  }

  get cancel() {
    return this.button('#cancel-button')!;
  }
}

describe('RegisterOibusModalComponent', () => {
  let tester: RegisterOibusModalComponentTester;
  let fakeActiveModal: NgbActiveModal;
  let engineService: jasmine.SpyObj<EngineService>;

  beforeEach(() => {
    fakeActiveModal = createMock(NgbActiveModal);
    engineService = createMock(EngineService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: NgbActiveModal, useValue: fakeActiveModal },
        { provide: EngineService, useValue: engineService }
      ]
    });

    engineService.updateRegistrationSettings.and.returnValue(of());
    TestBed.createComponent(DefaultValidationErrorsComponent).detectChanges();

    tester = new RegisterOibusModalComponentTester();
    tester.componentInstance.prepare({ host: '' } as RegistrationSettingsDTO);
    tester.detectChanges();
  });

  it('should have an empty form', () => {
    expect(tester.host).toHaveValue('');
  });

  it('should not register if invalid', () => {
    tester.save.click();

    // host
    expect(tester.validationErrors.length).toBe(1);
    expect(fakeActiveModal.close).not.toHaveBeenCalled();
  });

  it('should register if valid', fakeAsync(() => {
    tester.host.fillWith('http://localhost:4200');
    tester.detectChanges();
    tester.save.click();

    const expectedCommand: RegistrationSettingsCommandDTO = {
      host: 'http://localhost:4200'
    };

    expect(engineService.updateRegistrationSettings).toHaveBeenCalledWith(expectedCommand);
  }));

  it('should cancel', () => {
    tester.cancel.click();
    expect(fakeActiveModal.dismiss).toHaveBeenCalled();
  });
});
