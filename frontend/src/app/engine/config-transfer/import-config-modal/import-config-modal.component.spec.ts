import { TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { of, throwError } from 'rxjs';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';

import { ImportConfigModalComponent } from './import-config-modal.component';
import { ConfigImportFailure, ConfigTransferService } from '../../../services/config-transfer.service';
import { ConfirmationService } from '../../../shared/confirmation.service';
import { TransformerService } from '../../../services/transformer.service';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { ConfigImportPreviewDTO, ConfigImportResponseDTO } from '@oibus/shared/config-transfer.model';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';

class ImportConfigModalComponentTester {
  readonly fixture = TestBed.createComponent(ImportConfigModalComponent);
  readonly componentInstance = this.fixture.componentInstance;
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly importButton = this.root.getByCss('#import-button');
  readonly cancel = this.root.getByCss('#cancel-button');
  readonly error = this.root.getByCss('.alert-danger');
  readonly validationErrorsList = this.root.getByCss('#validation-errors-list');
  readonly closeButton = this.root.getByCss('#close-button');
  readonly importPreview = this.root.getByCss('#import-preview');

  constructor() {
    this.fixture.detectChanges();
  }
}

const preview = {
  fromVersion: '3.10.0',
  toVersion: '3.10.0',
  appliedUpgrades: [],
  config: {
    engine: { settings: {} },
    registration: {},
    scanModes: [],
    ipFilters: [],
    certificates: [],
    southConnectors: [],
    northConnectors: [],
    users: [],
    transformers: [],
    historyQueries: []
  }
} as unknown as ConfigImportPreviewDTO;

describe('ImportConfigModalComponent', () => {
  let tester: ImportConfigModalComponentTester;
  let activeModal: MockObject<NgbActiveModal>;
  let configTransferService: MockObject<ConfigTransferService>;
  let confirmationService: MockObject<ConfirmationService>;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);
    configTransferService = createMock(ConfigTransferService);
    confirmationService = createMock(ConfirmationService);
    const transformerService = createMock(TransformerService);
    transformerService.list.mockReturnValue(of([]));
    configTransferService.preview.mockReturnValue(of(preview));

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
    await expect.element(tester.importButton).toBeDisabled();
    expect(confirmationService.confirm).not.toHaveBeenCalled();
    expect(configTransferService.import).not.toHaveBeenCalled();
  });

  test('should preview the selected file before allowing the import', async () => {
    const file = new File(['{}'], 'export.json');
    tester.componentInstance.onFileSelected(file);
    tester.fixture.detectChanges();

    expect(configTransferService.preview).toHaveBeenCalledWith(file);
    expect(tester.componentInstance.preview()).toEqual(preview);
    await expect.element(tester.importPreview).toBeInTheDocument();
    await expect.element(tester.importButton).toBeEnabled();
    expect(configTransferService.import).not.toHaveBeenCalled();
  });

  test('should keep the import disabled and show the errors when the preview fails', async () => {
    configTransferService.preview.mockReturnValue(
      throwError(
        () =>
          new ConfigImportFailure('Imported configuration failed validation; nothing was imported', [
            { scope: 'scanMode', entityName: 'every second', message: 'invalid cron' }
          ])
      )
    );

    tester.componentInstance.onFileSelected(new File(['{}'], 'export.json'));
    tester.fixture.detectChanges();

    expect(tester.componentInstance.preview()).toBeNull();
    await expect.element(tester.importButton).toBeDisabled();
    await expect.element(tester.importPreview).not.toBeInTheDocument();
    await expect.element(tester.validationErrorsList).toMatchTextContent('every second');
    await expect.element(tester.validationErrorsList).toMatchTextContent('invalid cron');
  });

  test('should preview again when another file is selected', () => {
    configTransferService.preview.mockReturnValueOnce(throwError(() => 'boom'));
    tester.componentInstance.onFileSelected(new File(['{}'], 'broken.json'));
    expect(tester.componentInstance.error()).toBe('boom');

    const file = new File(['{}'], 'export.json');
    tester.componentInstance.onFileSelected(file);

    expect(configTransferService.preview).toHaveBeenLastCalledWith(file);
    expect(tester.componentInstance.error()).toBeNull();
    expect(tester.componentInstance.preview()).toEqual(preview);
  });

  test('should ask for confirmation before importing', async () => {
    confirmationService.confirm.mockReturnValue(of(undefined));
    const response: ConfigImportResponseDTO = {
      fromVersion: '3.10.0',
      toVersion: '3.10.0',
      appliedUpgrades: [],
      warnings: [],
      newPort: null
    };
    configTransferService.import.mockReturnValue(of(response));

    const file = new File(['{}'], 'export.json');
    tester.componentInstance.onFileSelected(file);
    tester.fixture.detectChanges();

    await tester.importButton.click();

    expect(confirmationService.confirm).toHaveBeenCalledWith({ messageKey: 'engine.config-transfer.import.confirm-message' });
    expect(configTransferService.import).toHaveBeenCalledWith(file);
  });

  test('should not import when the user declines the confirmation', async () => {
    confirmationService.confirm.mockReturnValue(throwError(() => 'not-confirmed'));

    const file = new File(['{}'], 'export.json');
    tester.componentInstance.onFileSelected(file);
    tester.fixture.detectChanges();

    await tester.importButton.click();

    expect(configTransferService.import).not.toHaveBeenCalled();
  });

  test('should display the applied upgrades and warnings after a successful import', async () => {
    confirmationService.confirm.mockReturnValue(of(undefined));
    const response: ConfigImportResponseDTO = {
      fromVersion: '3.10.0',
      toVersion: '3.11.0',
      appliedUpgrades: [{ version: '3.11.0', description: 'Add a field' }],
      warnings: ['something to check'],
      newPort: null
    };
    configTransferService.import.mockReturnValue(of(response));

    const file = new File(['{}'], 'export.json');
    tester.componentInstance.onFileSelected(file);
    tester.fixture.detectChanges();

    await tester.importButton.click();
    tester.fixture.detectChanges();

    expect(tester.componentInstance.result()).toEqual(response);
    await expect.element(tester.closeButton).toBeInTheDocument();
    const element = tester.fixture.nativeElement as HTMLElement;
    expect(element.querySelector('#upgraded-versions')?.textContent).toContain('3.10.0');
    expect(element.querySelector('#upgraded-versions')?.textContent).toContain('3.11.0');
    expect(element.querySelector('#applied-upgrades-list')?.textContent?.trim()).toBe('3.11.0: Add a field');
  });

  test('should announce the redirect when the import changed the web server port', async () => {
    confirmationService.confirm.mockReturnValue(of(undefined));
    const response: ConfigImportResponseDTO = {
      fromVersion: '3.10.0',
      toVersion: '3.10.0',
      appliedUpgrades: [],
      warnings: [],
      newPort: 2224
    };
    configTransferService.import.mockReturnValue(of(response));

    tester.componentInstance.onFileSelected(new File(['{}'], 'export.json'));
    tester.fixture.detectChanges();
    await tester.importButton.click();
    tester.fixture.detectChanges();

    await expect.element(tester.root.getByCss('#port-changed-hint')).toMatchTextContent('port 2224');
    await expect.element(tester.closeButton).toHaveTextContent('Close and redirect');
  });

  test('should show the backend error message when the import fails', async () => {
    confirmationService.confirm.mockReturnValue(of(undefined));
    configTransferService.import.mockReturnValue(throwError(() => 'boom'));

    const file = new File(['{}'], 'export.json');
    tester.componentInstance.onFileSelected(file);
    tester.fixture.detectChanges();

    await tester.importButton.click();
    tester.fixture.detectChanges();

    expect(tester.componentInstance.error()).toBe('boom');
    await expect.element(tester.error).toMatchTextContent('boom');
  });

  test('should show the per-entity validation errors when the import fails validation', async () => {
    confirmationService.confirm.mockReturnValue(of(undefined));
    configTransferService.import.mockReturnValue(
      throwError(
        () =>
          new ConfigImportFailure('Imported configuration failed validation after applying config upgrades; nothing was imported', [
            { scope: 'south:sqlite:item', entityId: 'SC1', entityName: 'All logs', message: 'must be a string' }
          ])
      )
    );

    const file = new File(['{}'], 'export.json');
    tester.componentInstance.onFileSelected(file);
    tester.fixture.detectChanges();

    await tester.importButton.click();
    tester.fixture.detectChanges();

    expect(tester.componentInstance.validationErrors()).toEqual([
      { scope: 'south:sqlite:item', entityId: 'SC1', entityName: 'All logs', message: 'must be a string' }
    ]);
    await expect.element(tester.validationErrorsList).toMatchTextContent('All logs');
    await expect.element(tester.validationErrorsList).toMatchTextContent('must be a string');
  });

  test('should reject a file that is too large', () => {
    const bigFile = new File([new Uint8Array(100 * 1024 * 1024 + 1)], 'big.json');

    tester.componentInstance.onFileSelected(bigFile);

    expect(tester.componentInstance.fileError()).toBe('file-too-large');
    expect(tester.componentInstance.file).not.toBe(bigFile);
  });

  test('should cancel', async () => {
    await tester.cancel.click();
    expect(activeModal.dismiss).toHaveBeenCalled();
  });

  test('should close with the result once import succeeded', async () => {
    confirmationService.confirm.mockReturnValue(of(undefined));
    const response: ConfigImportResponseDTO = {
      fromVersion: '3.10.0',
      toVersion: '3.10.0',
      appliedUpgrades: [],
      warnings: [],
      newPort: null
    };
    configTransferService.import.mockReturnValue(of(response));

    const file = new File(['{}'], 'export.json');
    tester.componentInstance.onFileSelected(file);
    tester.fixture.detectChanges();

    await tester.importButton.click();
    tester.fixture.detectChanges();

    await tester.closeButton.click();

    expect(activeModal.close).toHaveBeenCalledWith(response);
  });
});
