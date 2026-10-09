import { TestBed } from '@angular/core/testing';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { isObservable, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { CertificateDTO } from '@oibus/shared/api/certificate.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { CertificateService } from '../../../services/certificate.service';
import { DefaultValidationErrorsComponent } from '../../../shared/default-validation-errors/default-validation-errors.component';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';
import { ExportCertificateModalComponent } from './export-certificate-modal.component';

class ExportCertificateModalComponentTester {
  readonly fixture = TestBed.createComponent(ExportCertificateModalComponent);
  readonly componentInstance = this.fixture.componentInstance;
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly format = this.root.getByLabelText('Format');
  readonly includeChain = this.root.getByLabelText('Include CA chain');
  readonly derHint = this.root.getByText('The CA chain cannot be included when exporting in DER format');
  readonly includePrivateKey = this.root.getByLabelText('Include private key');
  readonly passphrase = this.root.getByLabelText('Passphrase', { exact: true });
  readonly passphraseConfirmation = this.root.getByLabelText('Confirm passphrase');
  readonly validationErrors = this.root.getByCss('val-errors div');
  readonly save = this.root.getByRole('button', { name: 'Save' });
  readonly cancel = this.root.getByRole('button', { name: 'Cancel' });
  readonly error = this.root.getByCss('.alert-danger');
}

describe('ExportCertificateModalComponent', () => {
  let tester: ExportCertificateModalComponentTester;
  let activeModal: MockObject<NgbActiveModal>;
  let certificateService: MockObject<CertificateService>;
  let unsavedChangesConfirmationService: MockObject<UnsavedChangesConfirmationService>;

  const certificate: CertificateDTO = {
    id: 'id1',
    name: 'Certificate 1',
    description: '',
    publicKey: 'pp',
    certificate: 'cert',
    certificateChain: '-----BEGIN CERTIFICATE-----chain',
    expiry: '2033-01-01T00:00:00Z',
    createdBy: { id: '', friendlyName: '' },
    updatedBy: { id: '', friendlyName: '' },
    createdAt: '',
    updatedAt: ''
  };

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
    tester = new ExportCertificateModalComponentTester();
    tester.componentInstance.prepare(certificate);
  });

  test('should export the certificate in PEM format without the private key by default', async () => {
    certificateService.exportCertificate.mockReturnValue(of(undefined));

    await tester.save.click();

    expect(certificateService.exportCertificate).toHaveBeenCalledWith('id1', 'PEM', false, 'Certificate_1.pem');
    expect(certificateService.exportPrivateKey).not.toHaveBeenCalled();
    expect(activeModal.close).toHaveBeenCalled();
  });

  test('should export in DER format with the .cer extension', async () => {
    certificateService.exportCertificate.mockReturnValue(of(undefined));

    await tester.format.selectOptions('DER (.cer)');
    await tester.save.click();

    expect(certificateService.exportCertificate).toHaveBeenCalledWith('id1', 'DER', false, 'Certificate_1.cer');
  });

  test('should disable and uncheck the include chain option when DER is selected', async () => {
    await tester.includeChain.click();
    await expect.element(tester.includeChain).toBeChecked();

    await tester.format.selectOptions('DER (.cer)');

    await expect.element(tester.includeChain).not.toBeChecked();
    await expect.element(tester.includeChain).toBeDisabled();
    await expect.element(tester.derHint).toBeInTheDocument();

    await tester.format.selectOptions('PEM (.pem)');
    await expect.element(tester.includeChain).toBeEnabled();
    await expect.element(tester.derHint).not.toBeInTheDocument();
  });

  test('should not offer to include the chain of a certificate without one', async () => {
    const tester = new ExportCertificateModalComponentTester();
    tester.componentInstance.prepare({ ...certificate, certificateChain: null });

    await expect.element(tester.format).toBeInTheDocument();
    await expect.element(tester.includeChain).not.toBeInTheDocument();
  });

  test('should export the chain when asked to', async () => {
    certificateService.exportCertificate.mockReturnValue(of(undefined));

    await tester.includeChain.click();
    await tester.save.click();

    expect(certificateService.exportCertificate).toHaveBeenCalledWith('id1', 'PEM', true, 'Certificate_1.pem');
  });

  test('should show a validation error and not export when passphrases do not match', async () => {
    await tester.includePrivateKey.click();
    await tester.passphrase.fill('password1');
    await tester.passphraseConfirmation.fill('password2');
    await tester.save.click();

    await expect.element(tester.root.getByText('The passphrases are not identical')).toBeInTheDocument();
    expect(certificateService.exportCertificate).not.toHaveBeenCalled();
    expect(certificateService.exportPrivateKey).not.toHaveBeenCalled();
  });

  test('should also export the private key when passphrases match', async () => {
    certificateService.exportCertificate.mockReturnValue(of(undefined));
    certificateService.exportPrivateKey.mockReturnValue(of(undefined));

    await tester.includePrivateKey.click();
    await tester.passphrase.fill('password1');
    await tester.passphraseConfirmation.fill('password1');
    await tester.save.click();

    expect(certificateService.exportCertificate).toHaveBeenCalledWith('id1', 'PEM', false, 'Certificate_1.pem');
    expect(certificateService.exportPrivateKey).toHaveBeenCalledWith('id1', 'password1', 'Certificate_1-private-key.pem');
    expect(activeModal.close).toHaveBeenCalled();
  });

  test('should show the backend error message when the export fails', async () => {
    certificateService.exportCertificate.mockReturnValue(throwError(() => 'boom'));

    await tester.save.click();

    await expect.element(tester.error).toMatchTextContent('boom');
    expect(activeModal.close).not.toHaveBeenCalled();
  });

  test('should cancel', async () => {
    await tester.cancel.click();
    expect(activeModal.dismiss).toHaveBeenCalled();
  });

  describe('unsaved changes', () => {
    test('should return true from canDismiss when nothing was touched', () => {
      expect(tester.componentInstance.canDismiss()).toBe(true);
    });

    test('should confirm unsaved changes when the form was touched', async () => {
      unsavedChangesConfirmationService.confirmUnsavedChanges.mockReturnValue(of(true));
      await tester.includePrivateKey.click();

      const result = tester.componentInstance.canDismiss();

      expect(isObservable(result)).toBe(true);
      expect(unsavedChangesConfirmationService.confirmUnsavedChanges).toHaveBeenCalled();
    });
  });
});
