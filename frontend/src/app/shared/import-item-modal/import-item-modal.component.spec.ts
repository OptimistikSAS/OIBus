import { ImportItemModalComponent } from './import-item-modal.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
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
    const file = new File([''], 'File2');
    const comp = tester.componentInstance;

    // Set both the selectedFile and the form control value
    comp.selectedFile = file;
    comp.importForm.get('file')?.setValue(file);

    // Make sure the form is valid and has no errors
    comp.importForm.get('file')?.setErrors(null);
    comp.importForm.get('file')?.markAsTouched();
    comp.importForm.get('file')?.updateValueAndValidity();

    tester.detectChanges();

    tester.saveButton.click();

    expect(fakeActiveModal.close).toHaveBeenCalledWith({
      delimiter: ',',
      file,
      validationError: null
    });
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

  it('should show file required error if no file is selected', () => {
    tester.detectChanges();
    const fileControl = tester.componentInstance.importForm.get('file');
    fileControl?.markAsTouched();
    fileControl?.setValue(tester.componentInstance.initializeFile);

    expect(tester.componentInstance.hasFileRequiredError).toBeTrue();
  });

  it('should set async validator when expectedHeaders are set and file is selected', fakeAsync(() => {
    tester.detectChanges();
    const comp = tester.componentInstance;
    comp.expectedHeaders = ['name', 'enabled'];
    const file = new File(['name,enabled\nfoo,true'], 'test.csv');
    comp.selectedFile = file;
    comp.importForm.get('file')?.setValue(file);

    // Simulate delimiter change to trigger validator
    comp.importForm.get('delimiter')?.setValue('COMMA');
    comp.onDelimiterChange();
    tick();

    // Should have async validator set
    expect(comp.importForm.get('file')?.asyncValidator).toBeDefined();
  }));

  it('should clear async validator if no file is selected', () => {
    tester.detectChanges();
    const comp = tester.componentInstance;
    comp.expectedHeaders = ['name', 'enabled'];
    comp.selectedFile = comp.initializeFile;
    comp.importForm.get('file')?.setValue(comp.initializeFile);

    comp.onDelimiterChange();

    // Should have no async validator
    expect(comp.importForm.get('file')?.asyncValidator).toBeNull();
  });
  it('should close modal with validationError if CSV format error is present', () => {
    tester.detectChanges();
    const comp = tester.componentInstance;
    const file = new File(['bad content'], 'bad.csv');
    comp.selectedFile = file;
    comp.importForm.get('file')?.setValue(file);

    // Simulate a CSV format error
    const error = {
      expectedHeaders: ['name'],
      actualHeaders: [],
      missingHeaders: ['name'],
      extraHeaders: []
    };
    comp.importForm.get('file')?.setErrors({ csvFormatError: error });
    comp.importForm.get('file')?.markAsTouched();

    comp.save();

    expect(fakeActiveModal.close).toHaveBeenCalledWith({
      validationError: error,
      delimiter: ',',
      file: file
    });
  });

  it('should update file and trigger validator on file drop', () => {
    tester.detectChanges();
    const comp = tester.componentInstance;
    const file = new File(['header1,header2'], 'dropped.csv');
    const event = {
      preventDefault: () => {},
      dataTransfer: { files: [file] }
    } as unknown as DragEvent;

    spyOn(comp.importForm.get('file')!, 'setValue');
    spyOn<any>(comp, 'updateFileValidator');

    comp.onImportDrop(event);

    expect(comp.importForm.get('file')!.setValue).toHaveBeenCalledWith(file);
    expect(comp['updateFileValidator']).toHaveBeenCalled();
  });

  it('should update file and trigger validator on file input change', () => {
    tester.detectChanges();
    const comp = tester.componentInstance;
    const file = new File(['header1,header2'], 'input.csv');
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', {
      value: [file]
    });

    spyOn(comp.importForm.get('file')!, 'setValue');
    spyOn<any>(comp, 'updateFileValidator');

    comp.onImportClick({ target: input } as any);

    expect(comp.importForm.get('file')!.setValue).toHaveBeenCalledWith(file);
    expect(comp['updateFileValidator']).toHaveBeenCalled();
  });

  it('should return correct delimiter for each CsvCharacter', () => {
    const comp = tester.componentInstance;
    expect(comp.findCorrespondingDelimiter('DOT')).toBe('.');
    expect(comp.findCorrespondingDelimiter('SEMI_COLON')).toBe(';');
    expect(comp.findCorrespondingDelimiter('COLON')).toBe(':');
    expect(comp.findCorrespondingDelimiter('COMMA')).toBe(',');
    expect(comp.findCorrespondingDelimiter('SLASH')).toBe('/');
    expect(comp.findCorrespondingDelimiter('TAB')).toBe('  ');
    expect(comp.findCorrespondingDelimiter('NON_BREAKING_SPACE')).toBe(' ');
    expect(comp.findCorrespondingDelimiter('PIPE')).toBe('|');
  });

  it('should detect validation error and file required error getters', () => {
    tester.detectChanges();
    const comp = tester.componentInstance;
    const fileControl = comp.importForm.get('file');

    // CSV format error
    fileControl?.setErrors({ csvFormatError: { expectedHeaders: [], actualHeaders: [], missingHeaders: [], extraHeaders: [] } });
    fileControl?.markAsTouched();
    expect(comp.hasValidationError).toBeTrue();

    // File required error
    fileControl?.setErrors({ fileRequired: true });
    expect(comp.hasFileRequiredError).toBeTrue();
  });

  it('should return validationError property', () => {
    tester.detectChanges();
    const comp = tester.componentInstance;
    const fileControl = comp.importForm.get('file');
    const error = { expectedHeaders: [], actualHeaders: [], missingHeaders: [], extraHeaders: [] };
    fileControl?.setErrors({ csvFormatError: error });
    expect(comp.validationError).toBe(error);
  });
});
