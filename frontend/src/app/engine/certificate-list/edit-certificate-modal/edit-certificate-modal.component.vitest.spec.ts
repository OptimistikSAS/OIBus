import { TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { firstValueFrom, of } from 'rxjs';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';

import { EditCertificateModalComponent } from './edit-certificate-modal.component';
import { DefaultValidationErrorsComponent } from '../../../shared/default-validation-errors/default-validation-errors.component';
import { CertificateService } from '../../../services/certificate.service';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { CertificateCommandDTO, CertificateDTO } from '../../../../../../backend/shared/model/certificate.model';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';

class EditCertificateModalComponentTester {
  readonly fixture = TestBed.createComponent(EditCertificateModalComponent);
  readonly componentInstance = this.fixture.componentInstance;
  readonly name = page.getByCss('#name');
  readonly description = page.getByCss('#description');
  readonly regenerateCertificate = page.getByCss('#regenerate-certificate');
  readonly commonName = page.getByCss('#common-name');
  readonly countryName = page.getByCss('#country-name');
  readonly localityName = page.getByCss('#locality-name');
  readonly stateOrProvinceName = page.getByCss('#state-or-province-name');
  readonly organizationName = page.getByCss('#organization-name');
  readonly keySize = page.getByCss('#key-size');
  readonly daysBeforeExpiry = page.getByCss('#days-before-expiry');
  readonly validationErrors = page.getByCss('val-errors div');
  readonly save = page.getByCss('#save-button');
  readonly cancel = page.getByCss('#cancel-button');
}

describe('EditCertificateModalComponent', () => {
  let tester: EditCertificateModalComponentTester;
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
    tester = new EditCertificateModalComponentTester();
  });

  describe('create mode', () => {
    beforeEach(() => {
      tester.componentInstance.prepareForCreation();
    });

    test('should have an empty form with default and with regenerate not visible', async () => {
      await expect.element(tester.name).toHaveValue('');
      await expect.element(tester.description).toHaveValue('');
      await expect.element(tester.regenerateCertificate).not.toBeInTheDocument();
      await expect.element(tester.countryName).toBeInTheDocument();
      await expect.element(tester.keySize).toHaveValue(4096);
      await expect.element(tester.daysBeforeExpiry).toHaveValue(3650);
    });

    test('should not save if invalid', async () => {
      await tester.save.click();

      // name + 5 certificate fields
      await expect.element(tester.validationErrors).toHaveLength(6);
      expect(activeModal.close).not.toHaveBeenCalled();
    });

    test('should save if valid', async () => {
      const createdCertificate = { id: 'id1' } as CertificateDTO;
      certificateService.create.mockReturnValue(of(createdCertificate));

      await tester.name.fill('cert1');
      await tester.description.fill('desc');
      await tester.countryName.fill('fr');
      await tester.stateOrProvinceName.fill('sa');
      await tester.localityName.fill('ch');
      await tester.organizationName.fill('opt');
      await tester.commonName.fill('oib');
      await tester.keySize.fill('2048');
      await tester.daysBeforeExpiry.fill('4');
      await tester.save.click();

      const expectedCommand: CertificateCommandDTO = {
        name: 'cert1',
        description: 'desc',
        regenerateCertificate: true,
        options: {
          commonName: 'oib',
          countryName: 'fr',
          stateOrProvinceName: 'sa',
          localityName: 'ch',
          organizationName: 'opt',
          daysBeforeExpiry: 4,
          keySize: 2048
        }
      };

      expect(certificateService.create).toHaveBeenCalledWith(expectedCommand);
      expect(activeModal.close).toHaveBeenCalledWith(createdCertificate);
    });

    test('should cancel', async () => {
      await tester.cancel.click();
      expect(activeModal.dismiss).toHaveBeenCalled();
    });
  });

  describe('edit mode', () => {
    const certificateToUpdate: CertificateDTO = {
      id: 'id1',
      name: 'cert1',
      description: 'My IP Filter 1',
      publicKey: 'pp',
      certificate: 'cert',
      expiry: '2033-01-01T00:00:00Z',
      createdBy: { id: '', friendlyName: '' },
      updatedBy: { id: '', friendlyName: '' },
      createdAt: '',
      updatedAt: ''
    };

    beforeEach(() => {
      certificateService.findById.mockReturnValue(of(certificateToUpdate));
      tester.componentInstance.prepareForEdition(certificateToUpdate);
    });

    test('should have a populated form', async () => {
      await expect.element(tester.name).toHaveValue(certificateToUpdate.name);
      await expect.element(tester.description).toHaveValue(certificateToUpdate.description);
      await expect.element(tester.regenerateCertificate).not.toBeChecked();
    });

    test('should not save if invalid', async () => {
      await tester.name.fill('');
      await tester.save.click();

      await expect.element(tester.validationErrors).toHaveLength(1);
      expect(activeModal.close).not.toHaveBeenCalled();
    });

    test('should save if valid without regenerating certificate', async () => {
      certificateService.update.mockReturnValue(of(undefined));

      await tester.name.fill('new-name');
      await tester.description.fill('A longer and updated description of my certificate');
      await tester.save.click();

      const expectedCommand: CertificateCommandDTO = {
        name: 'new-name',
        description: 'A longer and updated description of my certificate',
        regenerateCertificate: false,
        options: null
      };

      expect(certificateService.update).toHaveBeenCalledWith('id1', expectedCommand);
      expect(certificateService.findById).toHaveBeenCalledWith('id1');
      expect(activeModal.close).toHaveBeenCalledWith(certificateToUpdate);
    });

    test('should save if valid regenerating certificate', async () => {
      certificateService.update.mockReturnValue(of(undefined));

      await tester.name.fill('new-name');
      await tester.description.fill('A longer and updated description of my certificate');
      await tester.regenerateCertificate.click();
      await tester.countryName.fill('fr');
      await tester.stateOrProvinceName.fill('sa');
      await tester.localityName.fill('ch');
      await tester.organizationName.fill('opt');
      await tester.commonName.fill('oib');
      await tester.save.click();

      const expectedCommand: CertificateCommandDTO = {
        name: 'new-name',
        description: 'A longer and updated description of my certificate',
        regenerateCertificate: true,
        options: {
          commonName: 'oib',
          countryName: 'fr',
          stateOrProvinceName: 'sa',
          localityName: 'ch',
          organizationName: 'opt',
          daysBeforeExpiry: 3650,
          keySize: 4096
        }
      };

      expect(certificateService.update).toHaveBeenCalledWith('id1', expectedCommand);
      expect(certificateService.findById).toHaveBeenCalledWith('id1');
      expect(activeModal.close).toHaveBeenCalledWith(certificateToUpdate);
    });

    test('should cancel', async () => {
      await tester.cancel.click();
      expect(activeModal.dismiss).toHaveBeenCalled();
    });
  });

  describe('unsaved changes', () => {
    beforeEach(() => {
      tester.componentInstance.prepareForCreation();
    });

    test('should return true from canDismiss when form is pristine', () => {
      expect(tester.componentInstance.canDismiss()).toBe(true);
    });

    test('should return observable from canDismiss when form is dirty', async () => {
      await tester.name.fill('test name');
      unsavedChangesConfirmationService.confirmUnsavedChanges.mockReturnValue(of(true));

      const result = tester.componentInstance.canDismiss();

      expect(typeof result).not.toBe('boolean');
      expect(unsavedChangesConfirmationService.confirmUnsavedChanges).toHaveBeenCalled();
    });

    test('should allow dismissal when user confirms leaving', async () => {
      await tester.name.fill('test name');
      unsavedChangesConfirmationService.confirmUnsavedChanges.mockReturnValue(of(true));

      const result = tester.componentInstance.canDismiss();

      if (typeof result !== 'boolean') {
        await expect(firstValueFrom(result)).resolves.toBe(true);
      }
    });

    test('should prevent dismissal when user cancels leaving', async () => {
      await tester.name.fill('test name');
      unsavedChangesConfirmationService.confirmUnsavedChanges.mockReturnValue(of(false));

      const result = tester.componentInstance.canDismiss();

      if (typeof result !== 'boolean') {
        await expect(firstValueFrom(result)).resolves.toBe(false);
      }
    });
  });
});
