import { TestBed } from '@angular/core/testing';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { EMPTY, of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { ConfigImportPreviewDTO, ConfigImportResponseDTO } from '@oibus/shared/oia/config-transfer.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { ConfigImportFailure, ConfigTransferService } from '../../../services/config-transfer.service';
import { TransformerService } from '../../../services/transformer.service';
import { ConfirmationService } from '../../../shared/confirmation.service';
import { configImportPreview } from '../config-transfer-testing';
import { ImportConfigModalComponent } from './import-config-modal.component';

class ImportConfigModalComponentTester {
  readonly fixture = TestBed.createComponent(ImportConfigModalComponent);
  readonly componentInstance = this.fixture.componentInstance;
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly fileInput = this.root.getByCss('#import-file');
  readonly fileButton = this.root.getByCss('#import-file-button');
  readonly importButton = this.root.getByRole('button', { name: 'Import configuration' });
  readonly cancelButton = this.root.getByRole('button', { name: 'Cancel' });
  readonly closeButton = this.root.getByCss('#close-button');
  readonly error = this.root.getByCss('.alert-danger');
  readonly fileTooLarge = this.root.getByRole('alert');
  readonly validationErrorsList = this.root.getByCss('#validation-errors-list');
  readonly previewLoading = this.root.getByText('Analyzing the configuration file…');
  readonly importPreview = this.root.getByCss('#import-preview');
  readonly success = this.root.getByText('Configuration successfully imported.');

  /** Drops a file on the file button, as the user would by drag and drop */
  async dropFile(file: File) {
    await expect.element(this.fileButton).toBeInTheDocument();
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    this.fileButton.element().dispatchEvent(new DragEvent('drop', { dataTransfer, bubbles: true, cancelable: true }));
  }
}

const response: ConfigImportResponseDTO = {
  fromVersion: '3.10.0',
  toVersion: '3.10.0',
  appliedUpgrades: [],
  warnings: [],
  newPort: null
};

const validationFailure = new ConfigImportFailure('Imported configuration failed validation; nothing was imported', [
  { scope: 'south:sqlite:item', entityId: 'SC1', entityName: 'All logs', message: 'must be a string' },
  { scope: 'scanMode', message: 'invalid cron' }
]);

describe('ImportConfigModalComponent', () => {
  let tester: ImportConfigModalComponentTester;
  let activeModal: MockObject<NgbActiveModal>;
  let configTransferService: MockObject<ConfigTransferService>;
  let confirmationService: MockObject<ConfirmationService>;
  const file = new File(['{}'], 'export.json');

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);
    configTransferService = createMock(ConfigTransferService);
    confirmationService = createMock(ConfirmationService);
    const transformerService = createMock(TransformerService);
    transformerService.list.mockReturnValue(of([]));
    configTransferService.preview.mockReturnValue(of(configImportPreview));
    configTransferService.import.mockReturnValue(of(response));
    confirmationService.confirm.mockReturnValue(of(undefined));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: ConfigTransferService, useValue: configTransferService },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: TransformerService, useValue: transformerService }
      ]
    });

    tester = new ImportConfigModalComponentTester();
  });

  test('should not import when no file is selected', async () => {
    await expect.element(tester.fileButton).toHaveTextContent('Choose a file');
    await expect.element(tester.importButton).toBeDisabled();
    await expect.element(tester.importPreview).not.toBeInTheDocument();
  });

  test('should preview the selected file before allowing the import', async () => {
    const preview = new Subject<ConfigImportPreviewDTO>();
    configTransferService.preview.mockReturnValue(preview);

    await tester.fileInput.upload(file);

    await expect.element(tester.fileButton).toHaveTextContent('export.json');
    await expect.element(tester.previewLoading).toBeInTheDocument();
    await expect.element(tester.importButton).toBeDisabled();
    expect(configTransferService.preview).toHaveBeenCalledWith(expect.objectContaining({ name: 'export.json' }));

    preview.next(configImportPreview);
    preview.complete();

    await expect.element(tester.previewLoading).not.toBeInTheDocument();
    await expect.element(tester.importPreview).toMatchTextContent('Content to import');
    await expect.element(tester.importButton).toBeEnabled();
    expect(configTransferService.import).not.toHaveBeenCalled();
  });

  test('should preview a file dropped on the file button', async () => {
    await tester.dropFile(file);

    await expect.element(tester.fileButton).toHaveTextContent('export.json');
    await expect.element(tester.importPreview).toBeInTheDocument();
  });

  test('should let a file be dragged over the file button', async () => {
    const dragOver = new DragEvent('dragover', { bubbles: true, cancelable: true });
    await expect.element(tester.fileButton).toBeInTheDocument();

    tester.fileButton.element().dispatchEvent(dragOver);

    expect(dragOver.defaultPrevented).toBe(true);
  });

  test('should cancel the preview of the previous file when another one is selected', async () => {
    const firstPreview = new Subject<ConfigImportPreviewDTO>();
    configTransferService.preview.mockReturnValueOnce(firstPreview);

    await tester.fileInput.upload(new File(['{}'], 'first.json'));
    await expect.element(tester.previewLoading).toBeInTheDocument();
    expect(firstPreview.observed).toBe(true);

    await tester.fileInput.upload(new File(['{}'], 'second.json'));

    expect(firstPreview.observed).toBe(false);
    await expect.element(tester.fileButton).toHaveTextContent('second.json');
    await expect.element(tester.importPreview).toBeInTheDocument();
    await expect.element(tester.importButton).toBeEnabled();
  });

  test('should keep the import disabled and show the errors when the preview fails', async () => {
    configTransferService.preview.mockReturnValue(throwError(() => validationFailure));

    await tester.fileInput.upload(file);

    await expect.element(tester.error).toMatchTextContent('Imported configuration failed validation; nothing was imported');
    await expect.element(tester.validationErrorsList.getByRole('listitem')).toHaveLength(2);
    await expect
      .element(tester.validationErrorsList.getByRole('listitem').nth(0))
      .toHaveTextContent('All logs (south:sqlite:item): must be a string');
    await expect.element(tester.validationErrorsList.getByRole('listitem').nth(1)).toHaveTextContent('scanMode (scanMode): invalid cron');
    await expect.element(tester.importButton).toBeDisabled();
    await expect.element(tester.importPreview).not.toBeInTheDocument();
  });

  test('should preview again when another file is selected after a failure', async () => {
    configTransferService.preview.mockReturnValueOnce(throwError(() => 'boom'));
    await tester.fileInput.upload(new File(['{}'], 'broken.json'));
    await expect.element(tester.error).toHaveTextContent('boom');

    await tester.fileInput.upload(file);

    await expect.element(tester.error).not.toBeInTheDocument();
    await expect.element(tester.importPreview).toBeInTheDocument();
    await expect.element(tester.importButton).toBeEnabled();
  });

  test('should reject a file that is too large', async () => {
    const bigFile = new File(['{}'], 'big.json');
    Object.defineProperty(bigFile, 'size', { value: 100 * 1024 * 1024 + 1 });

    await tester.dropFile(bigFile);

    await expect.element(tester.fileTooLarge).toMatchTextContent('The selected file is too large');
    await expect.element(tester.fileButton).toHaveTextContent('Choose a file');
    expect(configTransferService.preview).not.toHaveBeenCalled();
  });

  test('should ask for confirmation before importing, and display the result', async () => {
    await tester.fileInput.upload(file);
    await tester.importButton.click();

    expect(confirmationService.confirm).toHaveBeenCalledWith({ messageKey: 'engine.config-transfer.import.confirm-message' });
    expect(configTransferService.import).toHaveBeenCalledWith(expect.objectContaining({ name: 'export.json' }));
    await expect.element(tester.success).toBeInTheDocument();
    await expect.element(tester.root.getByText('No configuration upgrade was necessary.')).toBeInTheDocument();
    await expect.element(tester.root.getByText('No warnings.')).toBeInTheDocument();
    await expect.element(tester.root.getByText('The page will reload', { exact: false })).toBeInTheDocument();
    await expect.element(tester.importButton).not.toBeInTheDocument();
    await expect.element(tester.closeButton).toHaveTextContent('Close and reload');
  });

  test('should not import when the user declines the confirmation', async () => {
    confirmationService.confirm.mockReturnValue(EMPTY);

    await tester.fileInput.upload(file);
    await tester.importButton.click();

    expect(configTransferService.import).not.toHaveBeenCalled();
    await expect.element(tester.importButton).toBeEnabled();
    await expect.element(tester.success).not.toBeInTheDocument();
  });

  test('should display the applied upgrades and warnings after a successful import', async () => {
    configTransferService.import.mockReturnValue(
      of({
        ...response,
        toVersion: '3.11.0',
        appliedUpgrades: [{ version: '3.11.0', description: 'Add a field' }],
        warnings: ['something to check', 'something else']
      })
    );

    await tester.fileInput.upload(file);
    await tester.importButton.click();

    await expect
      .element(tester.root.getByCss('#upgraded-versions'))
      .toHaveTextContent('The configuration was upgraded from OIBus 3.10.0 to 3.11.0.');
    await expect.element(tester.root.getByCss('#applied-upgrades-list')).toHaveTextContent('3.11.0: Add a field');
    await expect.element(tester.root.getByCss('#warnings-list').getByRole('listitem')).toHaveLength(2);
    await expect.element(tester.root.getByCss('#warnings-list')).toMatchTextContent('something to check');
  });

  test('should announce the redirect when the import changed the web server port', async () => {
    configTransferService.import.mockReturnValue(of({ ...response, newPort: 2224 }));

    await tester.fileInput.upload(file);
    await tester.importButton.click();

    await expect.element(tester.root.getByCss('#port-changed-hint')).toMatchTextContent('port 2224');
    await expect.element(tester.closeButton).toHaveTextContent('Close and redirect');
  });

  test('should show the backend error message when the import fails', async () => {
    configTransferService.import.mockReturnValue(throwError(() => 'boom'));

    await tester.fileInput.upload(file);
    await tester.importButton.click();

    await expect.element(tester.error).toHaveTextContent('boom');
    await expect.element(tester.validationErrorsList).not.toBeInTheDocument();
    await expect.element(tester.importButton).toBeEnabled();
  });

  test('should show the per-entity validation errors when the import fails validation', async () => {
    configTransferService.import.mockReturnValue(throwError(() => validationFailure));

    await tester.fileInput.upload(file);
    await tester.importButton.click();

    await expect.element(tester.validationErrorsList).toMatchTextContent('All logs');
    await expect.element(tester.validationErrorsList).toMatchTextContent('must be a string');
  });

  test('should close with the result once the import succeeded', async () => {
    await tester.fileInput.upload(file);
    await tester.importButton.click();

    await tester.closeButton.click();

    expect(activeModal.close).toHaveBeenCalledWith(response);
  });

  test('should cancel', async () => {
    await tester.cancelButton.click();

    expect(activeModal.dismiss).toHaveBeenCalled();
  });

  test('should always allow the modal to be dismissed', () => {
    expect(tester.componentInstance.canDismiss()).toBe(true);
  });
});
