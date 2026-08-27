import { TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { of, throwError } from 'rxjs';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';

import { ImportConfigModalComponent } from './import-config-modal.component';
import { ConfigImportFailure, ConfigTransferService } from '../../../services/config-transfer.service';
import { ConfirmationService } from '../../../shared/confirmation.service';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { ConfigImportResponseDTO } from '../../../../../../backend/shared/model/config-transfer.model';
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

  constructor() {
    this.fixture.detectChanges();
  }
}

describe('ImportConfigModalComponent', () => {
  let tester: ImportConfigModalComponentTester;
  let activeModal: MockObject<NgbActiveModal>;
  let configTransferService: MockObject<ConfigTransferService>;
  let confirmationService: MockObject<ConfirmationService>;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);
    configTransferService = createMock(ConfigTransferService);
    confirmationService = createMock(ConfirmationService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: ConfigTransferService, useValue: configTransferService },
        { provide: ConfirmationService, useValue: confirmationService }
      ]
    });

    tester = new ImportConfigModalComponentTester();
  });

  test('should not import when no file is selected', async () => {
    await expect.element(tester.importButton).toBeDisabled();
    expect(confirmationService.confirm).not.toHaveBeenCalled();
    expect(configTransferService.import).not.toHaveBeenCalled();
  });

  test('should ask for confirmation before importing', async () => {
    confirmationService.confirm.mockReturnValue(of(undefined));
    const response: ConfigImportResponseDTO = { appliedUpgrades: [], warnings: [] };
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
      appliedUpgrades: [{ scope: 'south:opcua', version: '3.9.0', entityId: 'south1' }],
      warnings: ['something to check']
    };
    configTransferService.import.mockReturnValue(of(response));

    const file = new File(['{}'], 'export.json');
    tester.componentInstance.onFileSelected(file);
    tester.fixture.detectChanges();

    await tester.importButton.click();
    tester.fixture.detectChanges();

    expect(tester.componentInstance.result()).toEqual(response);
    await expect.element(tester.closeButton).toBeInTheDocument();
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
    await expect.element(tester.error).toHaveTextContent('boom');
  });

  test('should show the per-entity validation errors when the import fails validation', async () => {
    confirmationService.confirm.mockReturnValue(of(undefined));
    configTransferService.import.mockReturnValue(
      throwError(
        () =>
          new ConfigImportFailure('Imported configuration failed validation after applying settings upgrades; nothing was imported', [
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
    await expect.element(tester.validationErrorsList).toHaveTextContent('All logs');
    await expect.element(tester.validationErrorsList).toHaveTextContent('must be a string');
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
    const response: ConfigImportResponseDTO = { appliedUpgrades: [], warnings: [] };
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
