import { TestBed } from '@angular/core/testing';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { CertificateDTO } from '@oibus/shared/api/certificate.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { CertificateService } from '../../../services/certificate.service';
import { DefaultValidationErrorsComponent } from '../../../shared/default-validation-errors/default-validation-errors.component';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';
import { ImportCertificateModalComponent } from './import-certificate-modal.component';

class ImportCertificateModalComponentTester {
  readonly fixture = TestBed.createComponent(ImportCertificateModalComponent);
  readonly componentInstance = this.fixture.componentInstance;
  readonly name = page.getByLabelText('Name');
  readonly description = page.getByLabelText('Description');
  readonly privateKeyPassphrase = page.getByLabelText('Private key passphrase');
  readonly certificateFile = page.getByCss('#certificate-file');
  readonly certificateFileButton = page.getByCss('#certificate-file-button');
  readonly privateKeyFile = page.getByCss('#private-key-file');
  readonly certificateChainFile = page.getByCss('#certificate-chain-file');
  readonly save = page.getByCss('#save-button');
  readonly cancel = page.getByRole('button', { name: 'Cancel' });
  readonly error = page.getByCss('.alert-danger');
}

const certificateFile = new File(['cert'], 'cert.pem');
const privateKeyFile = new File(['key'], 'key.pem');

describe('ImportCertificateModalComponent', () => {
  let tester: ImportCertificateModalComponentTester;
  let activeModal: MockObject<NgbActiveModal>;
  let certificateService: MockObject<CertificateService>;
  let unsavedChangesConfirmationService: MockObject<UnsavedChangesConfirmationService>;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);
    certificateService = createMock(CertificateService);
    unsavedChangesConfirmationService = createMock(UnsavedChangesConfirmationService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: CertificateService, useValue: certificateService },
        { provide: UnsavedChangesConfirmationService, useValue: unsavedChangesConfirmationService }
      ]
    });

    TestBed.createComponent(DefaultValidationErrorsComponent).detectChanges();
    tester = new ImportCertificateModalComponentTester();
  });

  test('should not save when files are missing', async () => {
    await tester.name.fill('my cert');

    // the save button is force-disabled until both required files are chosen, so it cannot be clicked at all
    await expect.element(tester.save).toBeDisabled();

    await tester.certificateFile.upload(certificateFile);
    await expect.element(tester.save).toBeDisabled();

    await tester.privateKeyFile.upload(privateKeyFile);
    await expect.element(tester.save).toBeEnabled();
  });

  test('should save with the right command and files', async () => {
    const importedCertificate = { id: 'id1', name: 'my cert' } as CertificateDTO;
    certificateService.importCertificate.mockReturnValue(of(importedCertificate));

    await tester.name.fill('my cert');
    await tester.description.fill('my desc');
    await tester.certificateFile.upload(certificateFile);
    await tester.privateKeyFile.upload(privateKeyFile);
    await tester.save.click();

    expect(certificateService.importCertificate).toHaveBeenCalledWith(
      { name: 'my cert', description: 'my desc', privateKeyPassphrase: null },
      {
        certificate: expect.objectContaining({ name: 'cert.pem' }),
        privateKey: expect.objectContaining({ name: 'key.pem' }),
        certificateChain: null
      }
    );
    expect(activeModal.close).toHaveBeenCalledWith(importedCertificate);
  });

  test('should include the certificate chain and passphrase when provided', async () => {
    certificateService.importCertificate.mockReturnValue(of({ id: 'id1', name: 'my cert' } as CertificateDTO));

    await tester.name.fill('my cert');
    await tester.certificateFile.upload(certificateFile);
    await tester.privateKeyFile.upload(privateKeyFile);
    await tester.certificateChainFile.upload(new File(['chain'], 'chain.pem'));
    await tester.privateKeyPassphrase.fill('secret');
    await tester.save.click();

    expect(certificateService.importCertificate).toHaveBeenCalledWith(
      { name: 'my cert', description: '', privateKeyPassphrase: 'secret' },
      {
        certificate: expect.objectContaining({ name: 'cert.pem' }),
        privateKey: expect.objectContaining({ name: 'key.pem' }),
        certificateChain: expect.objectContaining({ name: 'chain.pem' })
      }
    );
  });

  test('should show the backend error message when the import fails', async () => {
    certificateService.importCertificate.mockReturnValue(throwError(() => 'boom'));

    await tester.name.fill('my cert');
    await tester.certificateFile.upload(certificateFile);
    await tester.privateKeyFile.upload(privateKeyFile);
    await tester.save.click();

    await expect.element(tester.error).toMatchTextContent('boom');
    expect(activeModal.close).not.toHaveBeenCalled();
  });

  test('should reject a file that is too large', async () => {
    await tester.certificateFile.upload(new File([new Uint8Array(1024 * 1024 + 1)], 'big.pem'));

    await expect.element(page.getByRole('alert')).toHaveTextContent('The selected file is too large. Maximum size is 1 MB');
    await expect.element(tester.certificateFileButton).toHaveTextContent('Choose a file');
  });

  test('should cancel', async () => {
    await tester.cancel.click();
    expect(activeModal.dismiss).toHaveBeenCalled();
  });

  describe('unsaved changes', () => {
    test('should return true from canDismiss when nothing was touched', () => {
      expect(tester.componentInstance.canDismiss()).toBe(true);
    });

    test('should confirm unsaved changes when a file was selected', async () => {
      unsavedChangesConfirmationService.confirmUnsavedChanges.mockReturnValue(of(true));
      await tester.certificateFile.upload(certificateFile);

      const result = tester.componentInstance.canDismiss();

      expect(typeof result).not.toBe('boolean');
      expect(unsavedChangesConfirmationService.confirmUnsavedChanges).toHaveBeenCalled();
    });
  });
});
