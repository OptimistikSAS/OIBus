import { UnsavedChangesConfirmationModalComponent } from './unsaved-changes-confirmation-modal.component';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { beforeEach, describe, expect, test } from 'vitest';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { page } from 'vitest/browser';

class UnsavedChangesConfirmationModalComponentTester {
  readonly fixture = TestBed.createComponent(UnsavedChangesConfirmationModalComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly title = this.root.getByRole('heading', { name: 'Unsaved changes' });
  readonly message = this.root.getByText('You have unsaved changes. Are you sure you want to leave without saving?');
  readonly continueEditingButton = this.root.getByRole('button', { name: 'Continue editing' });
  readonly leaveWithoutSavingButton = this.root.getByRole('button', { name: 'Leave without saving' });
}

describe('UnsavedChangesConfirmationModalComponent', () => {
  let tester: UnsavedChangesConfirmationModalComponentTester;
  let fakeActiveModal: MockObject<NgbActiveModal>;

  beforeEach(() => {
    fakeActiveModal = createMock(NgbActiveModal);

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: NgbActiveModal, useValue: fakeActiveModal }]
    });

    tester = new UnsavedChangesConfirmationModalComponentTester();
    tester.fixture.detectChanges();
  });

  test('should display the modal content', async () => {
    await expect.element(tester.title).toBeInTheDocument();
    await expect.element(tester.message).toBeInTheDocument();
    await expect.element(tester.continueEditingButton).toBeInTheDocument();
    await expect.element(tester.leaveWithoutSavingButton).toBeInTheDocument();
  });

  test('should close with true when leaving without saving', async () => {
    await tester.leaveWithoutSavingButton.click();

    expect(fakeActiveModal.close).toHaveBeenCalledWith(true);
  });

  test('should close with false when continuing editing', async () => {
    await tester.continueEditingButton.click();

    expect(fakeActiveModal.close).toHaveBeenCalledWith(false);
  });
});
