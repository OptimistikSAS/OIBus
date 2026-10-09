import { TestBed } from '@angular/core/testing';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Observable, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, Mock, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import testData from '../../../../test/test-data';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { ImportSouthItemsModalComponent, SouthItemsCheckResult } from './import-south-items-modal.component';

type CheckFn = (file: File, delimiter: string, deleteItemsNotPresent: boolean) => Observable<SouthItemsCheckResult>;

class ImportSouthItemsModalComponentTester {
  readonly fixture = TestBed.createComponent(ImportSouthItemsModalComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly importButton = this.root.getByRole('button', { name: 'Import' });
  readonly cancelButton = this.root.getByRole('button', { name: 'Cancel' });
  readonly fileInput = this.root.getByCss('#file');
  readonly delimiter = this.root.getByLabelText('Delimiter');
  readonly eraseExisting = this.root.getByLabelText('Erase existing elements');
  readonly formatError = this.root.getByRole('alert').filter({ hasText: 'CSV Format Error' });
  readonly checkError = this.root.getByRole('alert').filter({ hasText: 'Error checking file' });
  readonly validItems = this.root.getByCss('table').filter({ hasText: 'Group' }).getByCss('tbody tr');
  readonly invalidItems = this.root.getByCss('table').filter({ hasText: 'Error' }).getByCss('tbody tr');

  readonly mqttError = this.root.getByRole('alert').filter({ hasText: 'MQTT Topic Overlap Error' });
  readonly fileButton = this.root.getByRole('button', { name: 'test.csv' });

  constructor(
    checkFn: CheckFn,
    options: { expectedHeaders?: Array<string>; showEraseOption?: boolean; existingMqttTopics?: Array<string> } = {}
  ) {
    this.fixture.componentInstance.prepare(
      testData.south.manifest,
      options.expectedHeaders ?? [],
      options.existingMqttTopics ? ['settings_topic'] : [],
      options.existingMqttTopics ?? [],
      !!options.existingMqttTopics,
      options.showEraseOption ?? true,
      checkFn
    );
  }
}

const csvFile = (content: string): File => new File([content], 'test.csv', { type: 'text/csv' });
const validCsv = csvFile('name,enabled\ntest,true');

describe('ImportSouthItemsModalComponent', () => {
  let activeModal: MockObject<NgbActiveModal>;
  let checkFn: Mock<CheckFn>;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);
    checkFn = vi.fn<CheckFn>().mockReturnValue(of({ items: [testData.south.itemCommand], errors: [] }));

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: NgbActiveModal, useValue: activeModal }]
    });
  });

  test('should dismiss on cancel', async () => {
    const tester = new ImportSouthItemsModalComponentTester(checkFn);

    await tester.cancelButton.click();

    expect(activeModal.dismiss).toHaveBeenCalled();
  });

  test('should check the selected file and list the items to create', async () => {
    const tester = new ImportSouthItemsModalComponentTester(checkFn);
    await expect.element(tester.importButton).toBeDisabled();

    await tester.fileInput.upload(validCsv);

    await expect.element(tester.validItems).toHaveLength(1);
    await expect.element(tester.validItems.nth(0)).toMatchTextContent(testData.south.itemCommand.name);
    await expect.element(tester.importButton).toBeEnabled();
    expect(checkFn).toHaveBeenCalledWith(expect.objectContaining({ name: 'test.csv' }), ',', false);
  });

  test('should list the invalid items and disable import when no item is valid', async () => {
    checkFn.mockReturnValue(of({ items: [], errors: [{ item: { name: 'bad item' }, error: 'invalid scan mode' }] }));
    const tester = new ImportSouthItemsModalComponentTester(checkFn);

    await tester.fileInput.upload(validCsv);

    await expect.element(tester.invalidItems).toHaveLength(1);
    await expect.element(tester.invalidItems.nth(0)).toMatchTextContent('bad item invalid scan mode');
    await expect.element(tester.importButton).toBeDisabled();
  });

  test('should show an error from the backend check', async () => {
    checkFn.mockReturnValue(throwError(() => ({ error: { message: 'server error' } })));
    const tester = new ImportSouthItemsModalComponentTester(checkFn);

    await tester.fileInput.upload(validCsv);

    await expect.element(tester.checkError).toMatchTextContent('Error checking file: server error');
    await expect.element(tester.validItems).not.toBeInTheDocument();
    await expect.element(tester.importButton).toBeDisabled();
  });

  test('should not call the backend when the file headers are invalid', async () => {
    const tester = new ImportSouthItemsModalComponentTester(checkFn, { expectedHeaders: ['name', 'enabled', 'settings_regex'] });

    await tester.fileInput.upload(validCsv);

    await expect.element(tester.formatError).toBeInTheDocument();
    expect(checkFn).not.toHaveBeenCalled();
  });

  test('should check the file again with the selected delimiter', async () => {
    const tester = new ImportSouthItemsModalComponentTester(checkFn);
    await tester.fileInput.upload(validCsv);
    await expect.element(tester.validItems).toHaveLength(1);

    await tester.delimiter.selectOptions('Semi colon ;');

    await vi.waitFor(() => expect(checkFn).toHaveBeenLastCalledWith(expect.any(File), ';', false));
  });

  test('should check the file again when the erase existing toggle changes', async () => {
    const tester = new ImportSouthItemsModalComponentTester(checkFn);
    await tester.fileInput.upload(validCsv);
    await expect.element(tester.validItems).toHaveLength(1);

    await tester.eraseExisting.click();

    await vi.waitFor(() => expect(checkFn).toHaveBeenLastCalledWith(expect.any(File), ',', true));
  });

  test('should close with the checked items and the erase flag on import', async () => {
    const tester = new ImportSouthItemsModalComponentTester(checkFn);
    await tester.fileInput.upload(validCsv);
    await tester.eraseExisting.click();
    await expect.element(tester.importButton).toBeEnabled();

    await tester.importButton.click();

    expect(activeModal.close).toHaveBeenCalledWith({ items: [testData.south.itemCommand], eraseExisting: true });
  });

  test('should hide the erase existing toggle when the option is disabled', async () => {
    const tester = new ImportSouthItemsModalComponentTester(checkFn, { showEraseOption: false });

    await expect.element(tester.delimiter).toBeInTheDocument();
    await expect.element(tester.eraseExisting).not.toBeInTheDocument();
  });

  test('should not call the backend when the MQTT topics overlap existing subscriptions', async () => {
    const tester = new ImportSouthItemsModalComponentTester(checkFn, { expectedHeaders: ['name'], existingMqttTopics: ['factory/#'] });

    await tester.fileInput.upload(csvFile('name,settings_topic\nitem,factory/line1'));

    await expect.element(tester.mqttError).toMatchTextContent('Conflicting topics: factory/line1');
    await expect.element(tester.importButton).toBeDisabled();
    expect(checkFn).not.toHaveBeenCalled();
  });

  test('should check a file dropped on the file button', async () => {
    const tester = new ImportSouthItemsModalComponentTester(checkFn);
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(validCsv);

    tester.root
      .getByCss('#import-button')
      .element()
      .dispatchEvent(new DragEvent('drop', { dataTransfer, bubbles: true }));

    await expect.element(tester.validItems).toHaveLength(1);
    await expect.element(tester.fileButton).toBeInTheDocument();
  });
});
