import { ComponentTester, createMock } from 'ngx-speculoos';
import { TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { ImportArrayModalComponent } from './import-array-modal.component';

class ImportArrayModalComponentTester extends ComponentTester<ImportArrayModalComponent> {
  constructor() {
    super(ImportArrayModalComponent);
  }

  get save() {
    return this.button('#save-button')!;
  }

  get cancel() {
    return this.button('#cancel-button')!;
  }
}

describe('ImportArrayModalComponent', () => {
  let tester: ImportArrayModalComponentTester;
  let fakeActiveModal: NgbActiveModal;

  beforeEach(() => {
    fakeActiveModal = createMock(NgbActiveModal);

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: NgbActiveModal, useValue: fakeActiveModal }]
    });

    tester = new ImportArrayModalComponentTester();
    tester.detectChanges();
  });

  it('should reject non-CSV files', async () => {
    const invalidFile = new File(['payload'], 'items.txt', { type: 'text/plain' });

    await tester.componentInstance.onFileSelected(invalidFile);

    expect(tester.componentInstance.validationError).toBe('Please select a CSV file');
    expect(tester.componentInstance.canSave).toBeFalse();
  });

  it('should accept CSV files and reset validation errors', async () => {
    const validFile = new File(['payload'], 'items.csv', { type: 'text/csv' });

    await tester.componentInstance.onFileSelected(validFile);

    expect(tester.componentInstance.selectedFile).toBe(validFile);
    expect(tester.componentInstance.validationError).toBeNull();
    expect(tester.componentInstance.canSave).toBeTrue();
  });

  it('should reset the validation error when delimiter changes', async () => {
    const validFile = new File(['payload'], 'items.csv', { type: 'text/csv' });
    await tester.componentInstance.onFileSelected(validFile);
    tester.componentInstance.validationError = 'Some error';

    await tester.componentInstance.onDelimiterChange();

    expect(tester.componentInstance.validationError).toBeNull();
  });

  it('should store validation errors', () => {
    const errors = [{ item: { name: '1' }, error: 'Invalid row' }];

    tester.componentInstance.setValidationErrors(errors);

    expect(tester.componentInstance.validationErrors).toEqual(errors);
    expect(tester.componentInstance.canSave).toBeFalse();
  });

  it('should handle drag-and-drop selection', async () => {
    const validFile = new File(['payload'], 'items.csv', { type: 'text/csv' });
    const preventDefault = jasmine.createSpy('preventDefault');

    const event = {
      preventDefault,
      dataTransfer: {
        files: [validFile]
      }
    } as unknown as DragEvent;

    await tester.componentInstance.onImportDrop(event);

    expect(preventDefault).toHaveBeenCalled();
    expect(tester.componentInstance.selectedFile).toBe(validFile);
  });

  it('should save when the form is valid', async () => {
    const validFile = new File(['payload'], 'items.csv', { type: 'text/csv' });
    await tester.componentInstance.onFileSelected(validFile);
    tester.componentInstance.importForm.get('delimiter')!.setValue('SEMI_COLON');
    tester.componentInstance.validationErrors = [];
    tester.detectChanges();

    await tester.save.click();

    expect(fakeActiveModal.close).toHaveBeenCalledWith({ delimiter: ';', file: validFile });
  });

  it('should close the modal when cancelling', () => {
    tester.cancel.click();

    expect(fakeActiveModal.close).toHaveBeenCalledWith();
  });
});
