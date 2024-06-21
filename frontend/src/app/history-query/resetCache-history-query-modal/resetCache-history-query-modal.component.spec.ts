import { resetCacheHistoryQueryModalComponent } from './resetCache-history-query-modal.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../../i18n/mock-i18n';

class ResetCacheModalComponentTester extends ComponentTester<resetCacheHistoryQueryModalComponent> {
  constructor() {
    super(resetCacheHistoryQueryModalComponent);
  }

  get yesButton() {
    return this.button('#yes-button')!;
  }

  get noButton() {
    return this.button('#no-button')!;
  }
}

describe('ResetCacheModalComponent', () => {
  let tester: ResetCacheModalComponentTester;
  let fakeActiveModal: NgbActiveModal;

  beforeEach(() => {
    fakeActiveModal = createMock(NgbActiveModal);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: NgbActiveModal, useValue: fakeActiveModal }
      ]
    });
    tester = new ResetCacheModalComponentTester();
  });

    it('should send yes', () => {
      tester.detectChanges();

      tester.yesButton.click();
      expect(fakeActiveModal.close).toHaveBeenCalledWith(true);
    });

    it('should send no', () => {
      tester.detectChanges();

      tester.noButton.click();
      expect(fakeActiveModal.close).toHaveBeenCalledWith(false);
    });
});
