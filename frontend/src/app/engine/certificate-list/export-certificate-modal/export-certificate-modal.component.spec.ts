import { TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { of } from 'rxjs';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';

import { ExportCertificateModalComponent } from './export-certificate-modal.component';
import { DefaultValidationErrorsComponent } from '../../../shared/default-validation-errors/default-validation-errors.component';
import { CertificateService } from '../../../services/certificate.service';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { CertificateDTO } from '../../../../../../backend/shared/model/certificate.model';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';

class ExportCertificateModalComponentTester {
  readonly fixture = TestBed.createComponent(ExportCertificateModalComponent);
  readonly componentInstance = this.fixture.componentInstance;
  readonly formatPem = page.getByCss('#format-pem');
  readonly formatDer = page.getByCss('#format-der');
  readonly includeChain = page.getByCss('#include-chain');
  readonly includePrivateKey = page.getByCss('#include-private-key');
  readonly passphrase = page.getByCss('#passphrase');
  readonly passphraseConfirmation = page.getByCss('#passphrase-confirmation');
  readonly validationErrors = page.getByCss('val-errors div');
  readonly save = page.getByCss('#export-button');
  readonly cancel = page.getByCss('#cancel-button');

  constructor() {
    this.fixture.detectChanges();
  }
}

describe('ExportCertificateModalComponent', () => {
  let tester: ExportCertificateModalComponentTester;
  let activeModal: MockObject<NgbActiveModal>;
  let certificateService: MockObject<CertificateService>;

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

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: CertificateService, useValue: certificateService }
      ]
    });

    TestBed.createComponent(DefaultValidationErrorsComponent).detectChanges();
    tester = new ExportCertificateModalComponentTester();
    tester.componentInstance.prepare(certificate);
    tester.fixture.detectChanges();
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

    await tester.formatDer.click();
    await tester.save.click();

    expect(certificateService.exportCertificate).toHaveBeenCalledWith('id1', 'DER', false, 'Certificate_1.cer');
  });

  test('should disable and uncheck the include chain option when DER is selected', async () => {
    await tester.includeChain.click();
    await expect.element(tester.includeChain).toBeChecked();

    await tester.formatDer.click();

    await expect.element(tester.includeChain).not.toBeChecked();
    await expect.element(tester.includeChain).toBeDisabled();
  });

  test('should show a validation error and not export when passphrases do not match', async () => {
    await tester.includePrivateKey.click();
    tester.fixture.detectChanges();
    await tester.passphrase.fill('password1');
    await tester.passphraseConfirmation.fill('password2');
    await tester.save.click();
    tester.fixture.detectChanges();

    await expect.element(tester.validationErrors).toBeInTheDocument();
    expect(certificateService.exportCertificate).not.toHaveBeenCalled();
    expect(certificateService.exportPrivateKey).not.toHaveBeenCalled();
  });

  test('should also export the private key when passphrases match', async () => {
    certificateService.exportCertificate.mockReturnValue(of(undefined));
    certificateService.exportPrivateKey.mockReturnValue(of(undefined));

    await tester.includePrivateKey.click();
    tester.fixture.detectChanges();
    await tester.passphrase.fill('password1');
    await tester.passphraseConfirmation.fill('password1');
    await tester.save.click();

    expect(certificateService.exportCertificate).toHaveBeenCalledWith('id1', 'PEM', false, 'Certificate_1.pem');
    expect(certificateService.exportPrivateKey).toHaveBeenCalledWith('id1', 'password1', 'Certificate_1-private-key.pem');
    expect(activeModal.close).toHaveBeenCalled();
  });

  test('should cancel', async () => {
    await tester.cancel.click();
    expect(activeModal.dismiss).toHaveBeenCalled();
  });
});
