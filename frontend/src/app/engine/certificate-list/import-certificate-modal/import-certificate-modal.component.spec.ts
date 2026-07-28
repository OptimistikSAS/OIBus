import { TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { of, throwError } from 'rxjs';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';

import { ImportCertificateModalComponent } from './import-certificate-modal.component';
import { DefaultValidationErrorsComponent } from '../../../shared/default-validation-errors/default-validation-errors.component';
import { CertificateService } from '../../../services/certificate.service';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { CertificateDTO } from '../../../../../../backend/shared/model/certificate.model';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';

class ImportCertificateModalComponentTester {
  readonly fixture = TestBed.createComponent(ImportCertificateModalComponent);
  readonly componentInstance = this.fixture.componentInstance;
  readonly name = page.getByCss('#name');
  readonly description = page.getByCss('#description');
  readonly privateKeyPassphrase = page.getByCss('#private-key-passphrase');
  readonly save = page.getByCss('#save-button');
  readonly cancel = page.getByCss('#cancel-button');
  readonly error = page.getByCss('.alert-danger');

  constructor() {
    this.fixture.detectChanges();
  }
}

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
    tester.fixture.detectChanges();

    // the save button is force-disabled until both required files are chosen, so it cannot be clicked at all
    await expect.element(tester.save).toBeDisabled();
    expect(certificateService.importCertificate).not.toHaveBeenCalled();
    expect(activeModal.close).not.toHaveBeenCalled();
  });

  test('should save with the right command and files', async () => {
    const importedCertificate = { id: 'id1', name: 'my cert' } as CertificateDTO;
    certificateService.importCertificate.mockReturnValue(of(importedCertificate));

    const certificateFile = new File(['cert'], 'cert.pem');
    const privateKeyFile = new File(['key'], 'key.pem');

    await tester.name.fill('my cert');
    await tester.description.fill('my desc');
    tester.componentInstance.onFileSelected('certificateFile', certificateFile);
    tester.componentInstance.onFileSelected('privateKeyFile', privateKeyFile);
    tester.fixture.detectChanges();

    await tester.save.click();

    expect(certificateService.importCertificate).toHaveBeenCalledWith(
      { name: 'my cert', description: 'my desc', privateKeyPassphrase: null },
      { certificate: certificateFile, privateKey: privateKeyFile, certificateChain: null }
    );
    expect(activeModal.close).toHaveBeenCalledWith(importedCertificate);
  });

  test('should include the certificate chain and passphrase when provided', async () => {
    const importedCertificate = { id: 'id1', name: 'my cert' } as CertificateDTO;
    certificateService.importCertificate.mockReturnValue(of(importedCertificate));

    const certificateFile = new File(['cert'], 'cert.pem');
    const privateKeyFile = new File(['key'], 'key.pem');
    const certificateChainFile = new File(['chain'], 'chain.pem');

    await tester.name.fill('my cert');
    tester.componentInstance.onFileSelected('certificateFile', certificateFile);
    tester.componentInstance.onFileSelected('privateKeyFile', privateKeyFile);
    tester.componentInstance.onFileSelected('certificateChainFile', certificateChainFile);
    await tester.privateKeyPassphrase.fill('secret');
    tester.fixture.detectChanges();

    await tester.save.click();

    expect(certificateService.importCertificate).toHaveBeenCalledWith(
      { name: 'my cert', description: '', privateKeyPassphrase: 'secret' },
      { certificate: certificateFile, privateKey: privateKeyFile, certificateChain: certificateChainFile }
    );
  });

  test('should show the backend error message when the import fails', async () => {
    certificateService.importCertificate.mockReturnValue(throwError(() => 'boom'));

    const certificateFile = new File(['cert'], 'cert.pem');
    const privateKeyFile = new File(['key'], 'key.pem');

    await tester.name.fill('my cert');
    tester.componentInstance.onFileSelected('certificateFile', certificateFile);
    tester.componentInstance.onFileSelected('privateKeyFile', privateKeyFile);
    tester.fixture.detectChanges();

    await tester.save.click();
    tester.fixture.detectChanges();

    expect(tester.componentInstance.error()).toBe('boom');
    await expect.element(tester.error).toHaveTextContent('boom');
    expect(activeModal.close).not.toHaveBeenCalled();
  });

  test('should reject a file that is too large', () => {
    const bigFile = new File([new Uint8Array(1024 * 1024 + 1)], 'big.pem');

    tester.componentInstance.onFileSelected('certificateFile', bigFile);

    expect(tester.componentInstance.fileError()).toBe('file-too-large');
    expect(tester.componentInstance.certificateFile).not.toBe(bigFile);
  });

  test('should cancel', async () => {
    await tester.cancel.click();
    expect(activeModal.dismiss).toHaveBeenCalled();
  });

  describe('unsaved changes', () => {
    test('should return true from canDismiss when nothing was touched', () => {
      expect(tester.componentInstance.canDismiss()).toBe(true);
    });

    test('should confirm unsaved changes when a file was selected', () => {
      unsavedChangesConfirmationService.confirmUnsavedChanges.mockReturnValue(of(true));
      tester.componentInstance.onFileSelected('certificateFile', new File(['cert'], 'cert.pem'));

      const result = tester.componentInstance.canDismiss();

      expect(typeof result).not.toBe('boolean');
      expect(unsavedChangesConfirmationService.confirmUnsavedChanges).toHaveBeenCalled();
    });
  });
});
