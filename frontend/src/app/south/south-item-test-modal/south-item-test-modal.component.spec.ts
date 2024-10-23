import { SouthItemTestModalComponent } from './south-item-test-modal.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { SouthConnectorItemDTO } from '../../../../../backend/shared/model/south-connector.model';
import { SouthItemSettings } from '../../../../../backend/shared/model/south-settings.model';

class TestSouthModalComponentTester extends ComponentTester<SouthItemTestModalComponent> {
  constructor() {
    super(SouthItemTestModalComponent);
  }

  get closeButton() {
    return this.button('#close-button')!;
  }
}

describe('SouthItemTestModalComponent', () => {
  let tester: TestSouthModalComponentTester;
  let fakeActiveModal: NgbActiveModal;

  beforeEach(() => {
    fakeActiveModal = createMock(NgbActiveModal);

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: NgbActiveModal, useValue: fakeActiveModal }]
    });
    tester = new TestSouthModalComponentTester();

    tester.componentInstance.prepare({ content: '1234', type: 'raw', filePath: 'filePath' }, {
      name: 'itemName'
    } as SouthConnectorItemDTO<SouthItemSettings>);
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
