import { ImportItemModalComponent } from './import-item-modal.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../../i18n/mock-i18n';

class ImportSouthItemModalComponentTester extends ComponentTester<ImportItemModalComponent> {
  constructor() {
    super(ImportItemModalComponent);
  }

  get saveButton() {
    return this.button('#save-button')!;
  }

  get cancelButton() {
    return this.button('#cancel-button')!;
  }

  get importButton() {
    return this.button('#import-button')!;
  }

  get fileInput() {
    return this.input('#file')!;
  }
}

describe('ImportSouthItemModalComponent', () => {
  let tester: ImportSouthItemModalComponentTester;
  let fakeActiveModal: NgbActiveModal;

  beforeEach(() => {
    fakeActiveModal = createMock(NgbActiveModal);

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: NgbActiveModal, useValue: fakeActiveModal }]
    });
    tester = new ImportSouthItemModalComponentTester();
  });

  it('should send a delimiter', () => {
    tester.detectChanges();
    tester.componentInstance.selectedFile = new File([''], 'File2');

    tester.saveButton.click();
    expect(fakeActiveModal.close).toHaveBeenCalledWith({ delimiter: ',', file: new File([''], 'File2') });
  });

  it('should cancel', () => {
    tester.detectChanges();

    tester.cancelButton.click();
    expect(fakeActiveModal.close).toHaveBeenCalled();
  });

  it('should select a file', () => {
    spyOn(tester.fileInput.nativeElement, 'click');
    tester.importButton.click();
    expect(tester.fileInput.nativeElement.click).toHaveBeenCalled();
  });
});
