import { TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { beforeEach, describe, expect, test } from 'vitest';

import { EditHistoryQueryItemModalComponent } from './edit-history-query-item-modal.component';
import { DefaultValidationErrorsComponent } from '../../../shared/default-validation-errors/default-validation-errors.component';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';

describe('EditHistoryQueryItemModalComponent', () => {
  let activeModal: MockObject<NgbActiveModal>;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: UnsavedChangesConfirmationService, useValue: createMock(UnsavedChangesConfirmationService) }
      ]
    });

    TestBed.createComponent(DefaultValidationErrorsComponent).detectChanges();
  });

  test('should cancel', () => {
    const fixture = TestBed.createComponent(EditHistoryQueryItemModalComponent);
    fixture.detectChanges();

    fixture.componentInstance.cancel();

    expect(activeModal.dismiss).toHaveBeenCalled();
  });

  test('should create without error', () => {
    const fixture = TestBed.createComponent(EditHistoryQueryItemModalComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
