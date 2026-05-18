import { TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { beforeEach, describe, expect, test } from 'vitest';

import { ResetCacheHistoryQueryModalComponent } from './reset-cache-history-query-modal.component';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../test/vitest-create-mock';

describe('ResetCacheHistoryQueryModalComponent', () => {
  let activeModal: MockObject<NgbActiveModal>;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: NgbActiveModal, useValue: activeModal }]
    });
  });

  test('should submit and close modal', () => {
    const fixture = TestBed.createComponent(ResetCacheHistoryQueryModalComponent);
    fixture.detectChanges();

    fixture.componentInstance.submit(true);

    expect(activeModal.close).toHaveBeenCalledWith(true);
  });

  test('should create without error', () => {
    const fixture = TestBed.createComponent(ResetCacheHistoryQueryModalComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
