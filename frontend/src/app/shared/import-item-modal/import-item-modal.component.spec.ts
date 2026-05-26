import { ImportItemModalComponent } from './import-item-modal.component';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { page } from 'vitest/browser';

class ImportSouthItemModalComponentTester {
  readonly fixture = TestBed.createComponent(ImportItemModalComponent);
  readonly component = this.fixture.componentInstance;
  readonly saveButton = page.getByCss('#save-button');
  readonly cancelButton = page.getByCss('#cancel-button');
  readonly importButton = page.getByCss('#import-button');
  readonly fileInput = page.getByCss('#file');
  readonly errorAlert = page.getByCss('.alert-danger');
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
    tester.fixture.detectChanges();
  };

  const changeDelimiter = async (comp: ImportItemModalComponent) => {
    await comp.onDelimiterChange();
    tester.fixture.detectChanges();
  };

  beforeEach(() => {
    fakeActiveModal = createMock(NgbActiveModal);

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: NgbActiveModal, useValue: fakeActiveModal }]
    });
    tester = new ImportSouthItemModalComponentTester();
  });

  test('should send a delimiter and file when save is clicked', async () => {
    tester.fixture.detectChanges();
    const file = createMockFile('name,enabled\ntest,true');
    const comp = tester.component;

    comp.selectedFile = file;
    tester.fixture.detectChanges();

    await tester.saveButton.click();

    expect(fakeActiveModal.close).toHaveBeenCalledWith({
      delimiter: ',',
      file,
      eraseExisting: false
    });
  });

  test('should cancel', async () => {
    tester.fixture.detectChanges();

    await tester.cancelButton.click();
    expect(fakeActiveModal.close).toHaveBeenCalled();
  });

  test('should select a file', async () => {
    tester.fixture.detectChanges();
    const fileInput = tester.fileInput.element() as HTMLInputElement;
    vi.spyOn(fileInput, 'click').mockImplementation(() => {});
    await tester.importButton.click();
    expect(fileInput.click).toHaveBeenCalled();
  });

  test('should disable save button when no file is selected', async () => {
    tester.fixture.detectChanges();
    await expect.element(tester.saveButton).toBeDisabled();
  });

  test('should enable save button when valid file is selected', async () => {
    tester.fixture.detectChanges();
    const comp = tester.component;
    const file = createZonedFile('name,enabled\ntest,true');

    await selectFile(comp, file);

    await expect.element(tester.saveButton).not.toBeDisabled();
  });

  test('should show validation error for CSV with missing headers', async () => {
    tester.fixture.detectChanges();
    const comp = tester.component;
    comp.expectedHeaders = ['name', 'enabled', 'settings_query'];

    const file = createZonedFile('name,enabled\ntest,true');
    await selectFile(comp, file);

    expect(comp.validationError).toBeTruthy();
    expect(comp.validationError?.missingHeaders).toContain('settings_query');
    await expect.element(tester.errorAlert).toBeInTheDocument();
    await expect.element(tester.saveButton).toBeDisabled();
  });

  test('should show validation error for CSV with extra headers', async () => {
    tester.fixture.detectChanges();
    const comp = tester.component;
    comp.expectedHeaders = ['name', 'enabled'];

    const file = createZonedFile('name,enabled,extra\ntest,true,value');
    await selectFile(comp, file);

    expect(comp.validationError).toBeTruthy();
    expect(comp.validationError?.extraHeaders).toContain('extra');
    await expect.element(tester.errorAlert).toBeInTheDocument();
    await expect.element(tester.saveButton).toBeDisabled();
  });

  test('should not show validation error for valid CSV', async () => {
    tester.fixture.detectChanges();
    const comp = tester.component;
    comp.expectedHeaders = ['name', 'enabled'];

    const file = createZonedFile('name,enabled\ntest,true');
    await selectFile(comp, file);

    expect(comp.validationError).toBeNull();
    await expect.element(tester.errorAlert).not.toBeInTheDocument();
    await expect.element(tester.saveButton).not.toBeDisabled();
  });

  test('should revalidate when delimiter changes', async () => {
    tester.fixture.detectChanges();
    const comp = tester.component;
    comp.expectedHeaders = ['name', 'enabled'];

    const file = createZonedFile('name;enabled\ntest;true');
    await selectFile(comp, file);

    expect(comp.validationError).toBeTruthy();

    comp.form.get('delimiter')?.setValue('SEMI_COLON');
    await changeDelimiter(comp);

    expect(comp.validationError).toBeNull();
  });

  test('should handle file drop', async () => {
    tester.fixture.detectChanges();
    const comp = tester.component;
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
    tester.fixture.detectChanges();
    const comp = tester.component;
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
    tester.fixture.detectChanges();
    const comp = tester.component;
    comp.expectedHeaders = ['name', 'enabled'];

    const file = createMockFile('');
    await comp.onFileSelected(file);

    expect(comp.validationError).toBeTruthy();
    expect(comp.validationError?.missingHeaders).toEqual(['name', 'enabled']);
  });

  test('should handle file with only header line', async () => {
    tester.fixture.detectChanges();
    const comp = tester.component;
    comp.expectedHeaders = ['name', 'enabled'];

    const file = createMockFile('name,enabled');
    await comp.onFileSelected(file);

    expect(comp.validationError).toBeNull();
  });

  test('should not validate when no expected headers are set', async () => {
    tester.fixture.detectChanges();
    const comp = tester.component;
    comp.expectedHeaders = [];

    const file = createMockFile('anything,here\ndata,value');
    await comp.onFileSelected(file);

    expect(comp.validationError).toBeNull();
  });

  test('should handle file with whitespace in headers', async () => {
    tester.fixture.detectChanges();
    const comp = tester.component;
    comp.expectedHeaders = ['name', 'enabled'];

    const file = createMockFile(' name , enabled \ntest,true');
    await comp.onFileSelected(file);

    expect(comp.validationError).toBeNull();
  });

  test('should handle file reading error', async () => {
    tester.fixture.detectChanges();
    const comp = tester.component;
    comp.expectedHeaders = ['name', 'enabled'];

    const errorFile = new File([new Blob(['content'])], 'error.csv', { type: 'text/csv' });
    vi.spyOn(errorFile, 'text').mockRejectedValue(new Error('File read error'));

    await comp.onFileSelected(errorFile);

    expect(comp.validationError).toBeTruthy();
    expect(comp.validationError?.missingHeaders).toEqual(['name', 'enabled']);
  });

  describe('MQTT Topic Validation', () => {
    beforeEach(() => {
      tester.fixture.detectChanges();
    });

    test('should not show MQTT validation error when not an MQTT connector', async () => {
      const comp = tester.component;
      comp.expectedHeaders = ['name', 'enabled', 'settings_topic'];
      comp.isMqttConnector = false;
      comp.existingMqttTopics = ['/oibus/counter'];

      const file = createZonedFile('name,enabled,settings_topic\ntest,true,/oibus/counter');
      await selectFile(comp, file);

      expect(comp.mqttValidationError).toBeNull();
    });

    test('should show MQTT validation error for overlapping topics', async () => {
      const comp = tester.component;
      comp.expectedHeaders = ['name', 'enabled', 'settings_topic'];
      comp.isMqttConnector = true;
      comp.existingMqttTopics = ['/oibus/#'];

      const file = createZonedFile('name,enabled,settings_topic\ntest,true,/oibus/counter');
      await selectFile(comp, file);

      expect(comp.mqttValidationError).toBeTruthy();
      expect(comp.mqttValidationError?.topicErrors[0].conflictingTopics).toContain('/oibus/counter');
    });

    test('should not show MQTT validation error when no overlapping topics', async () => {
      const comp = tester.component;
      comp.expectedHeaders = ['name', 'enabled', 'settings_topic'];
      comp.isMqttConnector = true;
      comp.existingMqttTopics = ['/other/topic'];

      const file = createZonedFile('name,enabled,settings_topic\ntest,true,/oibus/counter');
      await selectFile(comp, file);

      expect(comp.mqttValidationError).toBeNull();
    });

    test('should detect overlapping topics within CSV file', async () => {
      const comp = tester.component;
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
      const comp = tester.component;
      comp.expectedHeaders = ['name', 'enabled', 'settings_topic'];
      comp.isMqttConnector = true;
      comp.existingMqttTopics = ['/oibus/#'];

      const file = createZonedFile('name,enabled,settings_topic\ntest,true,/oibus/counter');
      await selectFile(comp, file);

      await expect.element(tester.saveButton).toBeDisabled();
    });

    test('should clear MQTT validation error when file changes', async () => {
      const comp = tester.component;
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
