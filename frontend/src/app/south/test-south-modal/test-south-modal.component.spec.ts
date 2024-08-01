import { TestSouthModalComponent } from './test-south-modal.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../../i18n/mock-i18n';

class TestSouthModalComponentTester extends ComponentTester<TestSouthModalComponent> {
  constructor() {
    super(TestSouthModalComponent);
  }

  get closeButton() {
    return this.button('#close-button')!;
  }
}

describe('TestSouthModalComponent', () => {
  let tester: TestSouthModalComponentTester;
  let fakeActiveModal: NgbActiveModal;

  beforeEach(() => {
    fakeActiveModal = createMock(NgbActiveModal);

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: NgbActiveModal, useValue: fakeActiveModal }]
    });
    tester = new TestSouthModalComponentTester();

    tester.componentInstance.prepare({ content: '1234' });
  });

  it('should close', () => {
    tester.detectChanges();
    spyOn(tester.componentInstance, 'ngAfterViewInit').and.callFake(function () {
      return;
    });
    tester.closeButton.click();
    expect(fakeActiveModal.close).toHaveBeenCalled();
  });
});
