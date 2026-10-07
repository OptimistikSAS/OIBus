import { TestBed } from '@angular/core/testing';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { ImportItemModalComponent } from './import-item-modal.component';

class ImportItemModalComponentTester {
  readonly fixture = TestBed.createComponent(ImportItemModalComponent);
  readonly componentInstance = this.fixture.componentInstance;
  readonly saveButton = page.getByRole('button', { name: 'Save' });
  readonly cancelButton = page.getByRole('button', { name: 'Cancel' });
  readonly importButton = page.getByCss('#import-button');
  readonly fileInput = page.getByCss('#file');
  readonly delimiter = page.getByLabelText('Delimiter');
  readonly eraseExisting = page.getByLabelText('Erase existing elements');
  readonly formatError = page.getByRole('alert').filter({ hasText: 'CSV Format Error' });
  readonly mqttError = page.getByRole('alert').filter({ hasText: 'MQTT Topic Overlap Error' });

  constructor(
    expectedHeaders: Array<string> = [],
    options: {
      optionalHeaders?: Array<string>;
      existingMqttTopics?: Array<string>;
      isMqttConnector?: boolean;
      showEraseOption?: boolean;
    } = {}
  ) {
    this.componentInstance.prepare(
      expectedHeaders,
      options.optionalHeaders ?? [],
      options.existingMqttTopics ?? [],
      options.isMqttConnector ?? false,
      options.showEraseOption ?? false
    );
  }
}

const csvFile = (content: string, filename = 'test.csv'): File => new File([content], filename, { type: 'text/csv' });

describe('ImportItemModalComponent', () => {
  let fakeActiveModal: MockObject<NgbActiveModal>;

  beforeEach(() => {
    fakeActiveModal = createMock(NgbActiveModal);

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: NgbActiveModal, useValue: fakeActiveModal }]
    });
  });

  test('should send the delimiter and the selected file on save', async () => {
    const tester = new ImportItemModalComponentTester(['name', 'enabled']);

    await tester.fileInput.upload(csvFile('name,enabled\ntest,true'));
    await expect.element(tester.importButton).toHaveTextContent('test.csv');
    await tester.saveButton.click();

    expect(fakeActiveModal.close).toHaveBeenCalledWith({
      delimiter: ',',
      file: tester.componentInstance.selectedFile(),
      eraseExisting: false
    });
    expect(tester.componentInstance.selectedFile().name).toBe('test.csv');
  });

  test('should send the erase flag when the option is shown and checked', async () => {
    const tester = new ImportItemModalComponentTester(['name'], { showEraseOption: true });

    await tester.fileInput.upload(csvFile('name\ntest'));
    await tester.eraseExisting.click();
    await tester.saveButton.click();

    expect(fakeActiveModal.close).toHaveBeenCalledWith(expect.objectContaining({ eraseExisting: true }));
  });

  test('should hide the erase option by default', async () => {
    const tester = new ImportItemModalComponentTester();

    await expect.element(tester.delimiter).toBeInTheDocument();
    await expect.element(tester.eraseExisting).not.toBeInTheDocument();
  });

  test('should cancel', async () => {
    const tester = new ImportItemModalComponentTester();

    await tester.cancelButton.click();

    expect(fakeActiveModal.close).toHaveBeenCalledWith();
  });

  test('should open the file chooser from the import button', async () => {
    const tester = new ImportItemModalComponentTester();
    const fileInput = tester.fileInput.element() as HTMLInputElement;
    vi.spyOn(fileInput, 'click').mockImplementation(() => undefined);

    await tester.importButton.click();

    expect(fileInput.click).toHaveBeenCalled();
  });

  test('should disable save until a file is selected', async () => {
    const tester = new ImportItemModalComponentTester(['name', 'enabled']);
    await expect.element(tester.saveButton).toBeDisabled();

    await tester.fileInput.upload(csvFile('name,enabled\ntest,true'));

    await expect.element(tester.saveButton).toBeEnabled();
  });

  test('should show the missing columns of an invalid file', async () => {
    const tester = new ImportItemModalComponentTester(['name', 'enabled', 'settings_query']);

    await tester.fileInput.upload(csvFile('name,enabled\ntest,true'));

    await expect.element(tester.formatError).toMatchTextContent(/Missing columns:\s*settings_query/);
    await expect.element(tester.saveButton).toBeDisabled();
  });

  test('should show the extra columns of an invalid file', async () => {
    const tester = new ImportItemModalComponentTester(['name', 'enabled']);

    await tester.fileInput.upload(csvFile('name,enabled,extra\ntest,true,value'));

    await expect.element(tester.formatError).toMatchTextContent(/Extra columns:\s*extra/);
    await expect.element(tester.saveButton).toBeDisabled();
  });

  test('should accept optional columns', async () => {
    const tester = new ImportItemModalComponentTester(['name'], { optionalHeaders: ['description'] });

    await tester.fileInput.upload(csvFile('name,description\ntest,desc'));

    await expect.element(tester.saveButton).toBeEnabled();
    await expect.element(tester.formatError).not.toBeInTheDocument();
  });

  test('should revalidate the selected file when the delimiter changes', async () => {
    const tester = new ImportItemModalComponentTester(['name', 'enabled']);

    await tester.fileInput.upload(csvFile('name;enabled\ntest;true'));
    await expect.element(tester.formatError).toBeInTheDocument();

    await tester.delimiter.selectOptions('Semi colon ;');

    await expect.element(tester.formatError).not.toBeInTheDocument();
    await expect.element(tester.saveButton).toBeEnabled();
  });

  test('should select a dropped file', async () => {
    const tester = new ImportItemModalComponentTester(['name', 'enabled']);
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(csvFile('name,enabled\ntest,true', 'dropped.csv'));

    tester.importButton.element().dispatchEvent(new DragEvent('drop', { dataTransfer, bubbles: true, cancelable: true }));

    await expect.element(tester.importButton).toHaveTextContent('dropped.csv');
    await expect.element(tester.saveButton).toBeEnabled();
  });

  describe('header validation', () => {
    test.each([
      { label: 'an empty file', content: '', missingHeaders: ['name', 'enabled'] },
      { label: 'a header-only file', content: 'name,enabled', missingHeaders: null },
      { label: 'headers surrounded by spaces', content: ' name , enabled \ntest,true', missingHeaders: null }
    ])('should validate $label', async ({ content, missingHeaders }) => {
      const tester = new ImportItemModalComponentTester(['name', 'enabled']);

      await tester.componentInstance.onFileSelected(csvFile(content));

      expect(tester.componentInstance.validationError()?.missingHeaders ?? null).toEqual(missingHeaders);
    });

    test('should not validate when no header is expected', async () => {
      const tester = new ImportItemModalComponentTester([]);

      await tester.componentInstance.onFileSelected(csvFile('anything,here\ndata,value'));

      expect(tester.componentInstance.validationError()).toBeNull();
    });

    test('should report all the expected headers as missing when the file cannot be read', async () => {
      const tester = new ImportItemModalComponentTester(['name', 'enabled']);
      const unreadableFile = csvFile('content', 'error.csv');
      vi.spyOn(unreadableFile, 'text').mockRejectedValue(new Error('File read error'));

      await tester.componentInstance.onFileSelected(unreadableFile);

      expect(tester.componentInstance.validationError()?.missingHeaders).toEqual(['name', 'enabled']);
    });
  });

  describe('MQTT topic validation', () => {
    const header = 'name,enabled,settings_topic';
    const expectedHeaders = ['name', 'enabled', 'settings_topic'];

    test('should not check topics when the connector is not MQTT', async () => {
      const tester = new ImportItemModalComponentTester(expectedHeaders, {
        isMqttConnector: false,
        existingMqttTopics: ['/oibus/counter']
      });

      await tester.fileInput.upload(csvFile(`${header}\ntest,true,/oibus/counter`));

      await expect.element(tester.saveButton).toBeEnabled();
      await expect.element(tester.mqttError).not.toBeInTheDocument();
    });

    test('should reject a topic overlapping an existing one', async () => {
      const tester = new ImportItemModalComponentTester(expectedHeaders, { isMqttConnector: true, existingMqttTopics: ['/oibus/#'] });

      await tester.fileInput.upload(csvFile(`${header}\ntest,true,/oibus/counter`));

      await expect.element(tester.mqttError).toMatchTextContent('/oibus/counter');
      await expect.element(tester.saveButton).toBeDisabled();
    });

    test('should accept topics that do not overlap', async () => {
      const tester = new ImportItemModalComponentTester(expectedHeaders, { isMqttConnector: true, existingMqttTopics: ['/other/topic'] });

      await tester.fileInput.upload(csvFile(`${header}\ntest,true,/oibus/counter`));

      await expect.element(tester.saveButton).toBeEnabled();
      await expect.element(tester.mqttError).not.toBeInTheDocument();
    });

    test('should reject overlapping topics within the file', async () => {
      const tester = new ImportItemModalComponentTester(expectedHeaders, { isMqttConnector: true });

      await tester.fileInput.upload(csvFile(`${header}\ntest1,true,/oibus/#\ntest2,true,/oibus/counter`));

      await expect.element(tester.mqttError).toMatchTextContent('/oibus/#');
      await expect.element(tester.mqttError).toMatchTextContent('/oibus/counter');
    });

    test('should clear the error when another file is selected', async () => {
      const tester = new ImportItemModalComponentTester(expectedHeaders, { isMqttConnector: true, existingMqttTopics: ['/oibus/#'] });

      await tester.fileInput.upload(csvFile(`${header}\ntest,true,/oibus/counter`));
      await expect.element(tester.mqttError).toBeInTheDocument();

      await tester.fileInput.upload(csvFile(`${header}\ntest,true,/different/topic`));

      await expect.element(tester.mqttError).not.toBeInTheDocument();
      await expect.element(tester.saveButton).toBeEnabled();
    });
  });
});
