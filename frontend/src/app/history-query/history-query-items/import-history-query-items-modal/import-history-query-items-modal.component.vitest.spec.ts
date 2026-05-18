import { TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { beforeEach, describe, expect, test } from 'vitest';

import { ImportHistoryQueryItemsModalComponent } from './import-history-query-items-modal.component';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';

describe('ImportHistoryQueryItemsModalComponent', () => {
  let activeModal: MockObject<NgbActiveModal>;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: NgbActiveModal, useValue: activeModal }]
    });
  });

  test('should cancel', () => {
    const fixture = TestBed.createComponent(ImportHistoryQueryItemsModalComponent);
    fixture.detectChanges();

    fixture.componentInstance.cancel();

    expect(activeModal.dismiss).toHaveBeenCalled();
  });

  test('should create without error', () => {
    const fixture = TestBed.createComponent(ImportHistoryQueryItemsModalComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
