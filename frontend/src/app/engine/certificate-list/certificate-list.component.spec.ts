import { TestBed } from '@angular/core/testing';

import { CertificateListComponent } from './certificate-list.component';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { ComponentTester, createMock, TestButton } from 'ngx-speculoos';
import { of } from 'rxjs';
import { CertificateService } from '../../services/certificate.service';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';
import { provideHttpClient } from '@angular/common/http';
import { MockModalService, provideModalTesting } from '../../shared/mock-modal.service.spec';
import { EditCertificateModalComponent } from './edit-certificate-modal/edit-certificate-modal.component';
import testData from '../../../../../backend/src/tests/utils/test-data';

class CertificateListComponentTester extends ComponentTester<CertificateListComponent> {
  constructor() {
    super(CertificateListComponent);
  }

  get title() {
    return this.element('#title')!;
  }

  get addCertificate() {
    return this.button('#add-certificate')!;
  }

  get deleteButtons() {
    return this.elements('.delete-certificate') as Array<TestButton>;
  }

  get editButtons() {
    return this.elements('.edit-certificate') as Array<TestButton>;
  }

  get noCertificate() {
    return this.element('#no-certificate');
  }

  get certificates() {
    return this.elements('tbody tr');
  }
}

describe('CertificateListComponent', () => {
  let tester: CertificateListComponentTester;
  let certificateService: jasmine.SpyObj<CertificateService>;
  let confirmationService: jasmine.SpyObj<ConfirmationService>;
  let notificationService: jasmine.SpyObj<NotificationService>;

  const certificates = testData.certificates.list;

  beforeEach(() => {
    certificateService = createMock(CertificateService);
    confirmationService = createMock(ConfirmationService);
    notificationService = createMock(NotificationService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideHttpClient(),
        provideModalTesting(),
        { provide: CertificateService, useValue: certificateService },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });
  });

  describe('with certificate', () => {
    beforeEach(() => {
      certificateService.list.and.returnValue(of(certificates));
      tester = new CertificateListComponentTester();
      tester.detectChanges();
    });

    it('should display a list of certificates', () => {
      expect(tester.title).toContainText('Certificates');
      expect(tester.certificates.length).toEqual(2);
      expect(tester.certificates[0].elements('td').length).toEqual(8);
      expect(tester.certificates[1].elements('td')[0]).toContainText('Certificate 2');
      expect(tester.certificates[1].elements('td')[1]).toHaveText('');
      expect(tester.certificates[1].elements('td')[2]).toContainText('public key');
      expect(tester.certificates[1].elements('td')[4]).toContainText('certificate');
      expect(tester.certificates[1].elements('td')[6]).toContainText('20 Mar 2020');
      expect(tester.editButtons.length).toBe(2);
      expect(tester.deleteButtons.length).toBe(2);
    });

    it('should add a certificate', () => {
      certificateService.list.calls.reset();

      const modalService: MockModalService<EditCertificateModalComponent> = TestBed.inject(MockModalService);
      const fakeEditComponent = createMock(EditCertificateModalComponent);
      modalService.mockClosedModal(fakeEditComponent, { name: 'new-name' });

      tester.addCertificate.click();
      expect(fakeEditComponent.prepareForCreation).toHaveBeenCalled();
      expect(certificateService.list).toHaveBeenCalledTimes(1);
      expect(notificationService.success).toHaveBeenCalledWith('engine.certificate.created', { name: 'new-name' });
    });

    it('should edit a certificate', () => {
      certificateService.list.calls.reset();

      const modalService: MockModalService<EditCertificateModalComponent> = TestBed.inject(MockModalService);
      const fakeEditComponent = createMock(EditCertificateModalComponent);
      modalService.mockClosedModal(fakeEditComponent, { name: 'new-name' });

      tester.editButtons[1].click();
      expect(fakeEditComponent.prepareForEdition).toHaveBeenCalledWith(certificates[1]);
      expect(certificateService.list).toHaveBeenCalledTimes(1);
      expect(notificationService.success).toHaveBeenCalledWith('engine.certificate.updated', { name: 'new-name' });
    });

    it('should delete a certificate', () => {
      certificateService.list.calls.reset();

      confirmationService.confirm.and.returnValue(of(undefined));
      certificateService.delete.and.returnValue(of(undefined));
      tester.deleteButtons[0].click();

      // confirm, delete, notify and refresh
      expect(confirmationService.confirm).toHaveBeenCalled();
      expect(certificateService.delete).toHaveBeenCalledWith('certificate1');
      expect(certificateService.list).toHaveBeenCalledTimes(1);
      expect(notificationService.success).toHaveBeenCalledWith('engine.certificate.deleted', { name: 'Certificate 1' });
    });
  });

  describe('with no certificate', () => {
    it('should display an empty list', () => {
      certificateService.list.and.returnValue(of([]));
      tester = new CertificateListComponentTester();
      tester.detectChanges();
      expect(tester.noCertificate).toContainText('No certificate');
    });
  });
});
