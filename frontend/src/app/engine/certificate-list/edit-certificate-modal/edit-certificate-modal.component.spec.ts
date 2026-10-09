import { TestBed } from '@angular/core/testing';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { firstValueFrom, isObservable, Observable, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { CertificateCommandDTO, CertificateDTO } from '@oibus/shared/api/certificate.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import testData from '../../../../test/test-data';
import { catchUnhandledErrors } from '../../../../test/unhandled-errors';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { CertificateService } from '../../../services/certificate.service';
import { DefaultValidationErrorsComponent } from '../../../shared/default-validation-errors/default-validation-errors.component';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';
import { EditCertificateModalComponent } from './edit-certificate-modal.component';

class EditCertificateModalComponentTester {
  readonly fixture = TestBed.createComponent(EditCertificateModalComponent);
  readonly componentInstance = this.fixture.componentInstance;
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly title = this.root.getByRole('heading');
  readonly name = this.root.getByLabelText('Name', { exact: true });
  readonly description = this.root.getByLabelText('Description');
  readonly regenerateCertificate = this.root.getByLabelText('Regenerate certificate');
  readonly commonName = this.root.getByLabelText('Common name');
  readonly countryName = this.root.getByLabelText('Country name');
  readonly stateOrProvinceName = this.root.getByLabelText('State/Province name');
  readonly localityName = this.root.getByLabelText('Locality name');
  readonly organizationName = this.root.getByLabelText('Organization name');
  readonly keySize = this.root.getByLabelText('Key size');
  readonly daysBeforeExpiry = this.root.getByLabelText('Days before expiry');
  readonly validationErrors = this.root.getByCss('val-errors div');
  readonly saveButton = this.root.getByRole('button', { name: 'Save' });
  readonly cancelButton = this.root.getByRole('button', { name: 'Cancel' });

  async fillCertificateOptions() {
    await this.countryName.fill('fr');
    await this.stateOrProvinceName.fill('sa');
    await this.localityName.fill('ch');
    await this.organizationName.fill('opt');
    await this.commonName.fill('oib');
  }
}

/** Resolves the result of `canDismiss()`, be it a boolean or an observable */
function resolveCanDismiss(result: Observable<boolean> | boolean): Promise<boolean> {
  return typeof result === 'boolean' ? Promise.resolve(result) : firstValueFrom(result);
}

const certificateToUpdate: CertificateDTO = { ...testData.certificates.list[0], id: 'id1', name: 'cert1', description: 'My certificate' };

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

    test('should have an empty form with defaults, and no regenerate toggle', async () => {
      await expect.element(tester.title).toHaveTextContent('Create a certificate');
      await expect.element(tester.name).toHaveValue('');
      await expect.element(tester.description).toHaveValue('');
      await expect.element(tester.regenerateCertificate).not.toBeInTheDocument();
      await expect.element(tester.countryName).toBeInTheDocument();
      await expect.element(tester.keySize).toHaveValue(4096);
      await expect.element(tester.daysBeforeExpiry).toHaveValue(3650);
    });

    test('should not save if invalid', async () => {
      await tester.saveButton.click();

      // name + 5 certificate fields
      await expect.element(tester.validationErrors).toHaveLength(6);
      expect(certificateService.create).not.toHaveBeenCalled();
    });

    test('should save if valid', async () => {
      const createdCertificate: CertificateDTO = { ...certificateToUpdate, name: 'cert1' };
      certificateService.create.mockReturnValue(of(createdCertificate));

      await tester.name.fill('cert1');
      await tester.description.fill('desc');
      await tester.fillCertificateOptions();
      await tester.keySize.fill('2048');
      await tester.daysBeforeExpiry.fill('4');
      await tester.saveButton.click();

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

    test('should keep the modal open when the creation fails', async () => {
      const unhandledError = catchUnhandledErrors();
      certificateService.create.mockReturnValue(throwError(() => new Error('boom')));

      await tester.name.fill('cert1');
      await tester.fillCertificateOptions();
      await tester.saveButton.click();

      await vi.waitFor(() => expect(unhandledError).toHaveBeenCalledWith(new Error('boom')));
      expect(activeModal.close).not.toHaveBeenCalled();
      await expect.element(tester.saveButton).toBeEnabled();
    });

    test('should cancel', async () => {
      await tester.cancelButton.click();

      expect(activeModal.dismiss).toHaveBeenCalled();
    });
  });

  describe('edit mode', () => {
    beforeEach(() => {
      certificateService.findById.mockReturnValue(of(certificateToUpdate));
      certificateService.update.mockReturnValue(of(undefined));
      tester.componentInstance.prepareForEdition(certificateToUpdate);
    });

    test('should have a populated form', async () => {
      await expect.element(tester.title).toHaveTextContent('Edit certificate');
      await expect.element(tester.name).toHaveValue('cert1');
      await expect.element(tester.description).toHaveValue('My certificate');
      await expect.element(tester.regenerateCertificate).not.toBeChecked();
      await expect.element(tester.countryName).not.toBeInTheDocument();
    });

    test('should not save if invalid', async () => {
      await tester.name.fill('');
      await tester.saveButton.click();

      await expect.element(tester.validationErrors).toHaveLength(1);
      expect(certificateService.update).not.toHaveBeenCalled();
    });

    test('should save if valid without regenerating the certificate', async () => {
      await tester.name.fill('new-name');
      await tester.description.fill('A longer and updated description of my certificate');
      await tester.saveButton.click();

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

    test('should save if valid regenerating the certificate', async () => {
      await tester.name.fill('new-name');
      await tester.regenerateCertificate.click();
      await tester.fillCertificateOptions();
      await tester.saveButton.click();

      const expectedCommand: CertificateCommandDTO = {
        name: 'new-name',
        description: 'My certificate',
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
      expect(activeModal.close).toHaveBeenCalledWith(certificateToUpdate);
    });

    test('should keep the modal open when the update fails', async () => {
      const unhandledError = catchUnhandledErrors();
      certificateService.update.mockReturnValue(throwError(() => new Error('boom')));

      await tester.saveButton.click();

      await vi.waitFor(() => expect(unhandledError).toHaveBeenCalledWith(new Error('boom')));
      expect(certificateService.findById).not.toHaveBeenCalled();
      expect(activeModal.close).not.toHaveBeenCalled();
    });
  });

  describe('unsaved changes', () => {
    beforeEach(() => {
      tester.componentInstance.prepareForCreation();
    });

    test('should allow dismissal without confirmation when the form is pristine', () => {
      expect(tester.componentInstance.canDismiss()).toBe(true);
      expect(unsavedChangesConfirmationService.confirmUnsavedChanges).not.toHaveBeenCalled();
    });

    test.each([true, false])('should ask for a confirmation when the form is dirty, and follow the answer (%s)', async confirmed => {
      unsavedChangesConfirmationService.confirmUnsavedChanges.mockReturnValue(of(confirmed));
      await tester.name.fill('test name');

      const result = tester.componentInstance.canDismiss();

      expect(isObservable(result)).toBe(true);
      await expect(resolveCanDismiss(result)).resolves.toBe(confirmed);
      expect(unsavedChangesConfirmationService.confirmUnsavedChanges).toHaveBeenCalled();
    });
  });
});
