import { ComponentTester, createMock } from 'ngx-speculoos';
import { UnsavedChangesConfirmationModalComponent } from './unsaved-changes-confirmation-modal.component';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../../i18n/mock-i18n';

class UnsavedChangesConfirmationModalComponentTester extends ComponentTester<UnsavedChangesConfirmationModalComponent> {
  constructor() {
    super(UnsavedChangesConfirmationModalComponent);
  }

  get title() {
    return this.element('.modal-title');
  }

  get message() {
    return this.element('.modal-body p');
  }

  get continueEditingButton() {
    return this.button('.btn-secondary')!;
  }

  get leaveWithoutSavingButton() {
    return this.button('.btn-danger')!;
  }
}

describe('UnsavedChangesConfirmationModalComponent', () => {
  let tester: UnsavedChangesConfirmationModalComponentTester;
  let fakeActiveModal: jasmine.SpyObj<NgbActiveModal>;

  beforeEach(async () => {
    fakeActiveModal = createMock(NgbActiveModal);

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: NgbActiveModal, useValue: fakeActiveModal }]
    });

    tester = new UnsavedChangesConfirmationModalComponentTester();
    await tester.change();
  });

  it('should display the modal content', () => {
    expect(tester.title).toHaveText('Unsaved changes');
    expect(tester.message).toHaveText('You have unsaved changes. Are you sure you want to leave without saving?');
    expect(tester.continueEditingButton).toHaveText(' Continue editing ');
    expect(tester.leaveWithoutSavingButton).toHaveText(' Leave without saving ');
  });

  it('should close with true when leaving without saving', () => {
    tester.leaveWithoutSavingButton.click();

    expect(fakeActiveModal.close).toHaveBeenCalledWith(true);
  });

  it('should close with false when continuing editing', () => {
    tester.continueEditingButton.click();

    expect(fakeActiveModal.close).toHaveBeenCalledWith(false);
  });
});
