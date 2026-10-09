import { TestBed } from '@angular/core/testing';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { ResetCacheHistoryQueryModalComponent } from './reset-cache-history-query-modal.component';

class ResetCacheHistoryQueryModalComponentTester {
  readonly fixture = TestBed.createComponent(ResetCacheHistoryQueryModalComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly message = this.root.getByText('Do you want to reset the history query cache ?');
  readonly yesButton = this.root.getByRole('button', { name: 'Yes' });
  readonly noButton = this.root.getByRole('button', { name: 'No' });
}

describe('ResetCacheHistoryQueryModalComponent', () => {
  let activeModal: MockObject<NgbActiveModal>;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: NgbActiveModal, useValue: activeModal }]
    });
  });

  test('should close with true to reset the cache', async () => {
    const tester = new ResetCacheHistoryQueryModalComponentTester();
    await expect.element(tester.message).toBeInTheDocument();

    await tester.yesButton.click();

    expect(activeModal.close).toHaveBeenCalledWith(true);
  });

  test('should close with false to keep the cache', async () => {
    const tester = new ResetCacheHistoryQueryModalComponentTester();

    await tester.noButton.click();

    expect(activeModal.close).toHaveBeenCalledWith(false);
  });
});
