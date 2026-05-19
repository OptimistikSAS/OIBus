import { ImportItemModalComponent } from './import-item-modal.component';
import { ComponentTester } from 'ngx-speculoos';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createMock, MockObject } from '../../../test/vitest-create-mock';

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
}

describe('ImportSouthItemModalComponent', () => {
  let tester: ImportSouthItemModalComponentTester;
  let fakeActiveModal: MockObject<NgbActiveModal>;

  // Creates a real File blob (native Blob.text() - for component state tests only)
  const createMockFile = (content: string, filename = 'test.csv'): File => {
    const blob = new Blob([content], { type: 'text/csv' });
    return new File([blob], filename, { type: 'text/csv' });
  };

  // Creates a File with mocked text() so the Promise is zone-tracked (for DOM update tests)
  const createZonedFile = (content: string, filename = 'test.csv'): File => {
    const blob = new Blob([content], { type: 'text/csv' });
    const file = new File([blob], filename, { type: 'text/csv' });
    vi.spyOn(file, 'text').mockResolvedValue(content);
    return file;
  };

  const selectFile = async (comp: ImportItemModalComponent, file: File) => {
    await comp.onFileSelected(file);
    await tester.change();
  };

  const changeDelimiter = async (comp: ImportItemModalComponent) => {
    await comp.onDelimiterChange();
    await tester.change();
  };

  beforeEach(() => {
    fakeActiveModal = createMock(NgbActiveModal);

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: NgbActiveModal, useValue: fakeActiveModal }]
    });
    tester = new ImportSouthItemModalComponentTester();
  });

  test('should send a delimiter and file when save is clicked', async () => {
    await tester.change();
    const file = createMockFile('name,enabled\ntest,true');
    const comp = tester.componentInstance;

    comp.selectedFile = file;
    await tester.change();

    await tester.saveButton.click();

    expect(fakeActiveModal.close).toHaveBeenCalledWith({
      delimiter: ',',
      file,
      eraseExisting: false
    });
  });

  test('should cancel', async () => {
    await tester.change();

    tester.cancelButton.click();
    expect(fakeActiveModal.close).toHaveBeenCalled();
  });

  test('should select a file', async () => {
    await tester.change();
    vi.spyOn(tester.fileInput.nativeElement, 'click').mockImplementation(() => {});
    tester.importButton.click();
    expect(tester.fileInput.nativeElement.click).toHaveBeenCalled();
  });

  test('should disable save button when no file is selected', async () => {
    await tester.change();
    expect(tester.saveButton.disabled).toBe(true);
  });

  test('should enable save button when valid file is selected', async () => {
    await tester.change();
    const comp = tester.componentInstance;
    const file = createZonedFile('name,enabled\ntest,true');

    await selectFile(comp, file);

    expect(tester.saveButton.disabled).toBe(false);
  });

  test('should show validation error for CSV with missing headers', async () => {
    await tester.change();
    const comp = tester.componentInstance;
    comp.expectedHeaders = ['name', 'enabled', 'settings_query'];

    const file = createZonedFile('name,enabled\ntest,true');
    await selectFile(comp, file);

    expect(comp.validationError).toBeTruthy();
    expect(comp.validationError?.missingHeaders).toContain('settings_query');
    expect(tester.errorAlert).toBeTruthy();
    expect(tester.saveButton.disabled).toBe(true);
  });

  test('should show validation error for CSV with extra headers', async () => {
    await tester.change();
    const comp = tester.componentInstance;
    comp.expectedHeaders = ['name', 'enabled'];

    const file = createZonedFile('name,enabled,extra\ntest,true,value');
    await selectFile(comp, file);

    expect(comp.validationError).toBeTruthy();
    expect(comp.validationError?.extraHeaders).toContain('extra');
    expect(tester.errorAlert).toBeTruthy();
    expect(tester.saveButton.disabled).toBe(true);
  });

  test('should not show validation error for valid CSV', async () => {
    await tester.change();
    const comp = tester.componentInstance;
    comp.expectedHeaders = ['name', 'enabled'];

    const file = createZonedFile('name,enabled\ntest,true');
    await selectFile(comp, file);

    expect(comp.validationError).toBeNull();
    expect(tester.errorAlert).toBeFalsy();
    expect(tester.saveButton.disabled).toBe(false);
  });

  test('should revalidate when delimiter changes', async () => {
    await tester.change();
    const comp = tester.componentInstance;
    comp.expectedHeaders = ['name', 'enabled'];

    const file = createZonedFile('name;enabled\ntest;true');
    await selectFile(comp, file);

    expect(comp.validationError).toBeTruthy();

    comp.form.get('delimiter')?.setValue('SEMI_COLON');
    await changeDelimiter(comp);

    expect(comp.validationError).toBeNull();
  });

  test('should handle file drop', async () => {
    await tester.change();
    const comp = tester.componentInstance;
    const file = createMockFile('name,enabled\ntest,true');
    const event = {
      preventDefault: vi.fn(),
      dataTransfer: { files: [file] }
    } as unknown as DragEvent;

    const spy = vi.spyOn(comp, 'onFileSelected');

    await comp.onImportDrop(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith(file);
    expect(comp.selectedFile).toBe(file);
  });

  test('should handle file input change', async () => {
    await tester.change();
    const comp = tester.componentInstance;
    const file = createMockFile('name,enabled\ntest,true');
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false
    });

    const spy = vi.spyOn(comp, 'onFileSelected');

    await comp.onImportClick({ target: input } as any);

    expect(spy).toHaveBeenCalledWith(file);
    expect(comp.selectedFile).toBe(file);
  });

  test('should handle empty file', async () => {
    await tester.change();
    const comp = tester.componentInstance;
    comp.expectedHeaders = ['name', 'enabled'];

    const file = createMockFile('');
    await comp.onFileSelected(file);

    expect(comp.validationError).toBeTruthy();
    expect(comp.validationError?.missingHeaders).toEqual(['name', 'enabled']);
  });

  test('should handle file with only header line', async () => {
    await tester.change();
    const comp = tester.componentInstance;
    comp.expectedHeaders = ['name', 'enabled'];

    const file = createMockFile('name,enabled');
    await comp.onFileSelected(file);

    expect(comp.validationError).toBeNull();
  });

  test('should not validate when no expected headers are set', async () => {
    await tester.change();
    const comp = tester.componentInstance;
    comp.expectedHeaders = [];

    const file = createMockFile('anything,here\ndata,value');
    await comp.onFileSelected(file);

    expect(comp.validationError).toBeNull();
  });

  test('should handle file with whitespace in headers', async () => {
    await tester.change();
    const comp = tester.componentInstance;
    comp.expectedHeaders = ['name', 'enabled'];

    const file = createMockFile(' name , enabled \ntest,true');
    await comp.onFileSelected(file);

    expect(comp.validationError).toBeNull();
  });

  test('should handle file reading error', async () => {
    await tester.change();
    const comp = tester.componentInstance;
    comp.expectedHeaders = ['name', 'enabled'];

    const errorFile = new File([new Blob(['content'])], 'error.csv', { type: 'text/csv' });
    vi.spyOn(errorFile, 'text').mockRejectedValue(new Error('File read error'));

    await comp.onFileSelected(errorFile);

    expect(comp.validationError).toBeTruthy();
    expect(comp.validationError?.missingHeaders).toEqual(['name', 'enabled']);
  });

  describe('MQTT Topic Validation', () => {
    beforeEach(async () => {
      await tester.change();
    });

    test('should not show MQTT validation error when not an MQTT connector', async () => {
      const comp = tester.componentInstance;
      comp.expectedHeaders = ['name', 'enabled', 'settings_topic'];
      comp.isMqttConnector = false;
      comp.existingMqttTopics = ['/oibus/counter'];

      const file = createZonedFile('name,enabled,settings_topic\ntest,true,/oibus/counter');
      await selectFile(comp, file);

      expect(comp.mqttValidationError).toBeNull();
    });

    test('should show MQTT validation error for overlapping topics', async () => {
      const comp = tester.componentInstance;
      comp.expectedHeaders = ['name', 'enabled', 'settings_topic'];
      comp.isMqttConnector = true;
      comp.existingMqttTopics = ['/oibus/#'];

      const file = createZonedFile('name,enabled,settings_topic\ntest,true,/oibus/counter');
      await selectFile(comp, file);

      expect(comp.mqttValidationError).toBeTruthy();
      expect(comp.mqttValidationError?.topicErrors[0].conflictingTopics).toContain('/oibus/counter');
    });

    test('should not show MQTT validation error when no overlapping topics', async () => {
      const comp = tester.componentInstance;
      comp.expectedHeaders = ['name', 'enabled', 'settings_topic'];
      comp.isMqttConnector = true;
      comp.existingMqttTopics = ['/other/topic'];

      const file = createZonedFile('name,enabled,settings_topic\ntest,true,/oibus/counter');
      await selectFile(comp, file);

      expect(comp.mqttValidationError).toBeNull();
    });

    test('should detect overlapping topics within CSV file', async () => {
      const comp = tester.componentInstance;
      comp.expectedHeaders = ['name', 'enabled', 'settings_topic'];
      comp.isMqttConnector = true;
      comp.existingMqttTopics = [];

      const file = createZonedFile('name,enabled,settings_topic\ntest1,true,/oibus/#\ntest2,true,/oibus/counter');
      await selectFile(comp, file);

      expect(comp.mqttValidationError).toBeTruthy();
      expect(comp.mqttValidationError?.topicErrors[0].conflictingTopics).toContain('/oibus/#');
      expect(comp.mqttValidationError?.topicErrors[0].conflictingTopics).toContain('/oibus/counter');
    });

    test('should disable save button when MQTT validation error exists', async () => {
      const comp = tester.componentInstance;
      comp.expectedHeaders = ['name', 'enabled', 'settings_topic'];
      comp.isMqttConnector = true;
      comp.existingMqttTopics = ['/oibus/#'];

      const file = createZonedFile('name,enabled,settings_topic\ntest,true,/oibus/counter');
      await selectFile(comp, file);

      expect(tester.saveButton.disabled).toBe(true);
    });

    test('should clear MQTT validation error when file changes', async () => {
      const comp = tester.componentInstance;
      comp.expectedHeaders = ['name', 'enabled', 'settings_topic'];
      comp.isMqttConnector = true;
      comp.existingMqttTopics = ['/oibus/#'];

      const errorFile = createZonedFile('name,enabled,settings_topic\ntest,true,/oibus/counter');
      await selectFile(comp, errorFile);
      expect(comp.mqttValidationError).toBeTruthy();

      const validFile = createZonedFile('name,enabled,settings_topic\ntest,true,/different/topic');
      await selectFile(comp, validFile);
      expect(comp.mqttValidationError).toBeNull();
    });
  });
});
