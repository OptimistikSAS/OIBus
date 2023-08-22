import { EditCertificateModalComponent } from './edit-certificate-modal.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { DefaultValidationErrorsComponent } from '../../shared/default-validation-errors/default-validation-errors.component';
import { CertificateService } from '../../services/certificate.service';
import { CertificateCommandDTO, CertificateDTO } from '../../../../../shared/model/certificate.model';
import { provideI18nTesting } from '../../../i18n/mock-i18n';

class EditCertificateModalComponentTester extends ComponentTester<EditCertificateModalComponent> {
  constructor() {
    super(EditCertificateModalComponent);
  }

  get name() {
    return this.input('#name')!;
  }

  get description() {
    return this.textarea('#description')!;
  }

  get regenerateCertificate() {
    return this.input('#regenerate-certificate')!;
  }

  get commonName() {
    return this.input('#common-name')!;
  }

  get countryName() {
    return this.input('#country-name')!;
  }

  get localityName() {
    return this.input('#locality-name')!;
  }

  get stateOrProvinceName() {
    return this.input('#state-or-province-name')!;
  }

  get organizationName() {
    return this.input('#organization-name')!;
  }

  get keySize() {
    return this.input('#key-size')!;
  }

  get daysBeforeExpiry() {
    return this.input('#days-before-expiry')!;
  }

  get validationErrors() {
    return this.elements('val-errors div');
  }

  get save() {
    return this.button('#save-button')!;
  }

  get cancel() {
    return this.button('#cancel-button')!;
  }
}

describe('EditCertificateModalComponent', () => {
  let tester: EditCertificateModalComponentTester;
  let fakeActiveModal: NgbActiveModal;
  let certificateService: jasmine.SpyObj<CertificateService>;

  beforeEach(() => {
    fakeActiveModal = createMock(NgbActiveModal);
    certificateService = createMock(CertificateService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: NgbActiveModal, useValue: fakeActiveModal },
        { provide: CertificateService, useValue: certificateService }
      ]
    });

    TestBed.createComponent(DefaultValidationErrorsComponent).detectChanges();

    tester = new EditCertificateModalComponentTester();
  });

  describe('create mode', () => {
    beforeEach(() => {
      tester.componentInstance.prepareForCreation();
      tester.detectChanges();
    });

    it('should have an empty form with default and with regenerate not visible', () => {
      expect(tester.name).toHaveValue('');
      expect(tester.description).toHaveValue('');
      expect(tester.regenerateCertificate).toBeFalsy();
      expect(tester.countryName.visible).toBeTrue();
      expect(tester.keySize).toHaveValue('4096');
      expect(tester.daysBeforeExpiry).toHaveValue('3650');
    });

    it('should not save if invalid', () => {
      tester.save.click();

      // name + 5 certificate fields
      expect(tester.validationErrors.length).toBe(6);
      expect(fakeActiveModal.close).not.toHaveBeenCalled();
    });

    it('should save if valid', () => {
      tester.name.fillWith('cert1');
      tester.description.fillWith('desc');
      tester.countryName.fillWith('fr');
      tester.stateOrProvinceName.fillWith('sa');
      tester.localityName.fillWith('ch');
      tester.organizationName.fillWith('opt');
      tester.commonName.fillWith('oib');
      tester.keySize.fillWith('2048');
      tester.daysBeforeExpiry.fillWith('4');

      tester.detectChanges();

      const createdCertificate = {
        id: 'id1'
      } as CertificateDTO;
      certificateService.create.and.returnValue(of(createdCertificate));

      tester.save.click();

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
      expect(fakeActiveModal.close).toHaveBeenCalledWith(createdCertificate);
    });

    it('should cancel', () => {
      tester.cancel.click();
      expect(fakeActiveModal.dismiss).toHaveBeenCalled();
    });
  });

  describe('edit mode', () => {
    const certificateToUpdate: CertificateDTO = {
      id: 'id1',
      name: 'cert1',
      description: 'My IP Filter 1',
      publicKey: 'pp',
      certificate: 'cert',
      expiry: '2033-01-01T00:00:00Z'
    };

    beforeEach(() => {
      certificateService.findById.and.returnValue(of(certificateToUpdate));
      tester.componentInstance.prepareForEdition(certificateToUpdate);
      tester.detectChanges();
    });

    it('should have a populated form', () => {
      expect(tester.name).toHaveValue(certificateToUpdate.name);
      expect(tester.description).toHaveValue(certificateToUpdate.description);
      expect(tester.regenerateCertificate.checked).toBeFalse();
    });

    it('should not save if invalid', () => {
      tester.name.fillWith('');
      tester.save.click();
      expect(tester.validationErrors.length).toBe(1);
      expect(fakeActiveModal.close).not.toHaveBeenCalled();
    });

    it('should save if valid without regenerating certificate', () => {
      certificateService.update.and.returnValue(of(undefined));

      tester.name.fillWith('new-name');
      tester.description.fillWith('A longer and updated description of my certificate');

      tester.save.click();

      const expectedCommand: CertificateCommandDTO = {
        name: 'new-name',
        description: 'A longer and updated description of my certificate',
        regenerateCertificate: false,
        options: null
      };

      expect(certificateService.update).toHaveBeenCalledWith('id1', expectedCommand);
      expect(certificateService.findById).toHaveBeenCalledWith('id1');
      expect(fakeActiveModal.close).toHaveBeenCalledWith(certificateToUpdate);
    });

    it('should save if valid regenerating certificate', () => {
      certificateService.update.and.returnValue(of(undefined));

      tester.name.fillWith('new-name');
      tester.description.fillWith('A longer and updated description of my certificate');
      tester.regenerateCertificate.check();
      tester.countryName.fillWith('fr');
      tester.stateOrProvinceName.fillWith('sa');
      tester.localityName.fillWith('ch');
      tester.organizationName.fillWith('opt');
      tester.commonName.fillWith('oib');

      tester.save.click();

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
      expect(fakeActiveModal.close).toHaveBeenCalledWith(certificateToUpdate);
    });

    it('should cancel', () => {
      tester.cancel.click();
      expect(fakeActiveModal.dismiss).toHaveBeenCalled();
    });
  });
});
