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

  get errorAlert() {
    return this.element('.alert-danger');
  }

  get delimiterSelect() {
    return this.select('#delimiter')!;
  }
}

describe('ImportSouthItemModalComponent', () => {
  let tester: ImportSouthItemModalComponentTester;
  let fakeActiveModal: NgbActiveModal;

  const createMockFile = (content: string, filename = 'test.csv'): File => {
    const blob = new Blob([content], { type: 'text/csv' });
    const file = new File([blob], filename, { type: 'text/csv' });

    Object.defineProperty(file, 'text', {
      value: jasmine.createSpy('text').and.returnValue(Promise.resolve(content)),
      writable: false,
      configurable: true
    });

    return file;
  };

  beforeEach(() => {
    fakeActiveModal = createMock(NgbActiveModal);

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: NgbActiveModal, useValue: fakeActiveModal }]
    });
    tester = new ImportSouthItemModalComponentTester();
  });

  it('should send a delimiter and file when save is clicked', () => {
    tester.detectChanges();
    const file = createMockFile('name,enabled\ntest,true');
    const comp = tester.componentInstance;

    comp.selectedFile = file;
    tester.detectChanges();

    tester.saveButton.click();

    expect(fakeActiveModal.close).toHaveBeenCalledWith({
      delimiter: ',',
      file
    });
  });

  it('should cancel', () => {
    tester.detectChanges();

    tester.cancelButton.click();
    expect(fakeActiveModal.close).toHaveBeenCalled();
  });

  it('should select a file', () => {
    spyOn(tester.fileInput.nativeElement, 'click');
    tester.detectChanges();
    tester.importButton.click();
    expect(tester.fileInput.nativeElement.click).toHaveBeenCalled();
  });

  it('should disable save button when no file is selected', () => {
    tester.detectChanges();
    expect(tester.saveButton.disabled).toBeTrue();
  });

  it('should enable save button when valid file is selected', async () => {
    tester.detectChanges();
    const comp = tester.componentInstance;
    const file = createMockFile('name,enabled\ntest,true');

    await comp.onFileSelected(file);
    tester.detectChanges();

    expect(tester.saveButton.disabled).toBeFalse();
  });

  it('should show validation error for CSV with missing headers', async () => {
    tester.detectChanges();
    const comp = tester.componentInstance;
    comp.expectedHeaders = ['name', 'enabled', 'settings_query'];

    const file = createMockFile('name,enabled\ntest,true');
    await comp.onFileSelected(file);
    tester.detectChanges();

    expect(comp.validationError).toBeTruthy();
    expect(comp.validationError?.missingHeaders).toContain('settings_query');
    expect(tester.errorAlert).toBeTruthy();
    expect(tester.saveButton.disabled).toBeTrue();
  });

  it('should show validation error for CSV with extra headers', async () => {
    tester.detectChanges();
    const comp = tester.componentInstance;
    comp.expectedHeaders = ['name', 'enabled'];

    const file = createMockFile('name,enabled,extra\ntest,true,value');
    await comp.onFileSelected(file);
    tester.detectChanges();

    expect(comp.validationError).toBeTruthy();
    expect(comp.validationError?.extraHeaders).toContain('extra');
    expect(tester.errorAlert).toBeTruthy();
    expect(tester.saveButton.disabled).toBeTrue();
  });

  it('should not show validation error for valid CSV', async () => {
    tester.detectChanges();
    const comp = tester.componentInstance;
    comp.expectedHeaders = ['name', 'enabled'];

    const file = createMockFile('name,enabled\ntest,true');
    await comp.onFileSelected(file);
    tester.detectChanges();

    expect(comp.validationError).toBeNull();
    expect(tester.errorAlert).toBeFalsy();
    expect(tester.saveButton.disabled).toBeFalse();
  });

  it('should revalidate when delimiter changes', async () => {
    tester.detectChanges();
    const comp = tester.componentInstance;
    comp.expectedHeaders = ['name', 'enabled'];

    const file = createMockFile('name;enabled\ntest;true');
    await comp.onFileSelected(file);
    tester.detectChanges();

    expect(comp.validationError).toBeTruthy();

    comp.importForm.get('delimiter')?.setValue('SEMI_COLON');
    await comp.onDelimiterChange();
    tester.detectChanges();

    expect(comp.validationError).toBeNull();
  });

  it('should handle file drop', async () => {
    tester.detectChanges();
    const comp = tester.componentInstance;
    const file = createMockFile('name,enabled\ntest,true');
    const event = {
      preventDefault: jasmine.createSpy('preventDefault'),
      dataTransfer: { files: [file] }
    } as unknown as DragEvent;

    spyOn(comp, 'onFileSelected').and.callThrough();

    await comp.onImportDrop(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(comp.onFileSelected).toHaveBeenCalledWith(file);
    expect(comp.selectedFile).toBe(file);
  });

  it('should handle file input change', async () => {
    tester.detectChanges();
    const comp = tester.componentInstance;
    const file = createMockFile('name,enabled\ntest,true');
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false
    });

    spyOn(comp, 'onFileSelected').and.callThrough();

    await comp.onImportClick({ target: input } as any);

    expect(comp.onFileSelected).toHaveBeenCalledWith(file);
    expect(comp.selectedFile).toBe(file);
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

  it('should handle empty file', async () => {
    tester.detectChanges();
    const comp = tester.componentInstance;
    comp.expectedHeaders = ['name', 'enabled'];

    const file = createMockFile('');
    await comp.onFileSelected(file);
    tester.detectChanges();

    expect(comp.validationError).toBeTruthy();
    expect(comp.validationError?.missingHeaders).toEqual(['name', 'enabled']);
  });

  it('should handle file with only header line', async () => {
    tester.detectChanges();
    const comp = tester.componentInstance;
    comp.expectedHeaders = ['name', 'enabled'];

    const file = createMockFile('name,enabled');
    await comp.onFileSelected(file);
    tester.detectChanges();

    expect(comp.validationError).toBeNull();
  });

  it('should not validate when no expected headers are set', async () => {
    tester.detectChanges();
    const comp = tester.componentInstance;
    comp.expectedHeaders = [];

    const file = createMockFile('anything,here\ndata,value');
    await comp.onFileSelected(file);
    tester.detectChanges();

    expect(comp.validationError).toBeNull();
  });

  it('should handle file with whitespace in headers', async () => {
    tester.detectChanges();
    const comp = tester.componentInstance;
    comp.expectedHeaders = ['name', 'enabled'];

    const file = createMockFile(' name , enabled \ntest,true');
    await comp.onFileSelected(file);
    tester.detectChanges();

    expect(comp.validationError).toBeNull();
  });

  it('should handle file reading error', async () => {
    tester.detectChanges();
    const comp = tester.componentInstance;
    comp.expectedHeaders = ['name', 'enabled'];

    const textSpy = jasmine.createSpy('text').and.returnValue(Promise.reject(new Error('File read error')));

    const errorFile = new File([new Blob(['content'])], 'error.csv', { type: 'text/csv' });
    Object.defineProperty(errorFile, 'text', {
      value: textSpy,
      writable: false,
      configurable: true
    });

    await comp.onFileSelected(errorFile);
    tester.detectChanges();

    expect(comp.validationError).toBeTruthy();
    expect(comp.validationError?.missingHeaders).toEqual(['name', 'enabled']);
  });

  describe('MQTT Topic Validation', () => {
    beforeEach(() => {
      tester.detectChanges();
    });

    it('should not show MQTT validation error when not an MQTT connector', async () => {
      const comp = tester.componentInstance;
      comp.expectedHeaders = ['name', 'enabled', 'settings_topic'];
      comp.isMqttConnector = false;
      comp.existingMqttTopics = ['/oibus/counter'];

      const file = createMockFile('name,enabled,settings_topic\ntest,true,/oibus/counter');
      await comp.onFileSelected(file);
      tester.detectChanges();

      expect(comp.mqttValidationError).toBeNull();
    });

    it('should show MQTT validation error for overlapping topics', async () => {
      const comp = tester.componentInstance;
      comp.expectedHeaders = ['name', 'enabled', 'settings_topic'];
      comp.isMqttConnector = true;
      comp.existingMqttTopics = ['/oibus/#'];

      const file = createMockFile('name,enabled,settings_topic\ntest,true,/oibus/counter');
      await comp.onFileSelected(file);
      tester.detectChanges();

      expect(comp.mqttValidationError).toBeTruthy();
      expect(comp.mqttValidationError?.topicErrors[0].conflictingTopics).toContain('/oibus/counter');
    });

    it('should not show MQTT validation error when no overlapping topics', async () => {
      const comp = tester.componentInstance;
      comp.expectedHeaders = ['name', 'enabled', 'settings_topic'];
      comp.isMqttConnector = true;
      comp.existingMqttTopics = ['/other/topic'];

      const file = createMockFile('name,enabled,settings_topic\ntest,true,/oibus/counter');
      await comp.onFileSelected(file);
      tester.detectChanges();

      expect(comp.mqttValidationError).toBeNull();
    });

    it('should detect overlapping topics within CSV file', async () => {
      const comp = tester.componentInstance;
      comp.expectedHeaders = ['name', 'enabled', 'settings_topic'];
      comp.isMqttConnector = true;
      comp.existingMqttTopics = [];

      const file = createMockFile('name,enabled,settings_topic\ntest1,true,/oibus/#\ntest2,true,/oibus/counter');
      await comp.onFileSelected(file);
      tester.detectChanges();

      expect(comp.mqttValidationError).toBeTruthy();
      expect(comp.mqttValidationError?.topicErrors[0].conflictingTopics).toContain('/oibus/#');
      expect(comp.mqttValidationError?.topicErrors[0].conflictingTopics).toContain('/oibus/counter');
    });

    it('should disable save button when MQTT validation error exists', async () => {
      const comp = tester.componentInstance;
      comp.expectedHeaders = ['name', 'enabled', 'settings_topic'];
      comp.isMqttConnector = true;
      comp.existingMqttTopics = ['/oibus/#'];

      const file = createMockFile('name,enabled,settings_topic\ntest,true,/oibus/counter');
      await comp.onFileSelected(file);
      tester.detectChanges();

      expect(tester.saveButton.disabled).toBeTrue();
    });

    it('should clear MQTT validation error when file changes', async () => {
      const comp = tester.componentInstance;
      comp.expectedHeaders = ['name', 'enabled', 'settings_topic'];
      comp.isMqttConnector = true;
      comp.existingMqttTopics = ['/oibus/#'];

      // First file with error
      const errorFile = createMockFile('name,enabled,settings_topic\ntest,true,/oibus/counter');
      await comp.onFileSelected(errorFile);
      tester.detectChanges();
      expect(comp.mqttValidationError).toBeTruthy();

      // Second file without error
      const validFile = createMockFile('name,enabled,settings_topic\ntest,true,/different/topic');
      await comp.onFileSelected(validFile);
      tester.detectChanges();
      expect(comp.mqttValidationError).toBeNull();
    });
  });
});
