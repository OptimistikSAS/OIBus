import { ExportItemModalComponent } from './export-item-modal.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../../i18n/mock-i18n';

class ExportSouthItemModalComponentTester extends ComponentTester<ExportItemModalComponent> {
  constructor() {
    super(ExportItemModalComponent);
  }

  get saveButton() {
    return this.button('#save-button')!;
  }

  get cancelButton() {
    return this.button('#cancel-button')!;
  }

  get delimiter() {
    return this.select('#delimiter')!;
  }

  get fileName() {
    return this.input('#fileName');
  }
}

describe('ExportSouthItemModalComponent', () => {
  let tester: ExportSouthItemModalComponentTester;
  let fakeActiveModal: NgbActiveModal;

  beforeEach(() => {
    fakeActiveModal = createMock(NgbActiveModal);

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: NgbActiveModal, useValue: fakeActiveModal }]
    });
    tester = new ExportSouthItemModalComponentTester();
  });

  it('should send a delimiter', () => {
    tester.detectChanges();
    tester.delimiter.selectLabel('Comma ,');
    tester.fileName!.fillWith('south-item');

    tester.saveButton.click();
    expect(fakeActiveModal.close).toHaveBeenCalledWith({ delimiter: ',', fileName: 'south-item' });
  });

  it('should cancel', () => {
    tester.detectChanges();

    tester.cancelButton.click();
    expect(fakeActiveModal.close).toHaveBeenCalled();
  });
});
