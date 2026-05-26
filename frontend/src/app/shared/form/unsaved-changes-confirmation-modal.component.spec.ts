import { ComponentTester } from 'ngx-speculoos';
import { UnsavedChangesConfirmationModalComponent } from './unsaved-changes-confirmation-modal.component';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { beforeEach, describe, expect, test } from 'vitest';
import { createMock, MockObject } from '../../../test/vitest-create-mock';

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
  let fakeActiveModal: MockObject<NgbActiveModal>;

  beforeEach(async () => {
    fakeActiveModal = createMock(NgbActiveModal);

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: NgbActiveModal, useValue: fakeActiveModal }]
    });

    tester = new UnsavedChangesConfirmationModalComponentTester();
    await tester.change();
  });

  test('should display the modal content', () => {
    expect(tester.title!.nativeElement.textContent).toContain('Unsaved changes');
    expect(tester.message!.nativeElement.textContent).toContain('You have unsaved changes. Are you sure you want to leave without saving?');
    expect(tester.continueEditingButton.nativeElement.textContent).toContain('Continue editing');
    expect(tester.leaveWithoutSavingButton.nativeElement.textContent).toContain('Leave without saving');
  });

  test('should close with true when leaving without saving', () => {
    tester.leaveWithoutSavingButton.click();

    expect(fakeActiveModal.close).toHaveBeenCalledWith(true);
  });

  test('should close with false when continuing editing', () => {
    tester.continueEditingButton.click();

    expect(fakeActiveModal.close).toHaveBeenCalledWith(false);
  });
});
