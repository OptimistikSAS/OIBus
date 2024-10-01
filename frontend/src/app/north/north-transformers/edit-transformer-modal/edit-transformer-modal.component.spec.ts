import { TestBed } from '@angular/core/testing';

import { EditTransformerModalComponent } from './edit-transformer-modal.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { DefaultValidationErrorsComponent } from '../../../shared/default-validation-errors/default-validation-errors.component';

class EditTransformerModalComponentTester extends ComponentTester<EditTransformerModalComponent> {
  constructor() {
    super(EditTransformerModalComponent);
  }

  get name() {
    return this.input('#name');
  }

  get code() {
    return this.element('#name');
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

describe('EditTransformerModalComponent', () => {
  let tester: EditTransformerModalComponentTester;
  let fakeActiveModal: NgbActiveModal;

  beforeEach(async () => {
    fakeActiveModal = createMock(NgbActiveModal);

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: NgbActiveModal, useValue: fakeActiveModal }]
    });

    TestBed.createComponent(DefaultValidationErrorsComponent).detectChanges();

    tester = new EditTransformerModalComponentTester();
    tester.componentInstance.prepareForCreation('input', 'output');
    tester.detectChanges();
  });

  it('should create', () => {
    expect(tester).toBeTruthy();
  });

  it('should not save if invalid', () => {
    tester.save.click();

    // Name and code are not specified
    expect(tester.validationErrors.length).toBe(2);
    expect(fakeActiveModal.close).not.toHaveBeenCalled();
  });
});
