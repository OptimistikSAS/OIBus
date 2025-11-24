import { TestBed } from '@angular/core/testing';

import { CertificateListComponent } from './certificate-list.component';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { ComponentTester, createMock, TestButton } from 'ngx-speculoos';
import { of } from 'rxjs';
import { CertificateService } from '../../services/certificate.service';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';
import { provideModalTesting } from '../../shared/mock-modal.service.spec';
import testData from '../../../../../backend/src/tests/utils/test-data';
import { ModalService } from '../../shared/modal.service';
import { provideHttpClientTesting } from '@angular/common/http/testing';

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
  let modalService: jasmine.SpyObj<ModalService>;

  const certificates = testData.certificates.list;

  beforeEach(() => {
    certificateService = createMock(CertificateService);
    confirmationService = createMock(ConfirmationService);
    notificationService = createMock(NotificationService);
    modalService = createMock(ModalService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideHttpClientTesting(),
        provideModalTesting(),
        { provide: CertificateService, useValue: certificateService },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: NotificationService, useValue: notificationService },
        { provide: ModalService, useValue: modalService }
      ]
    });

    modalService.open.and.returnValue({
      componentInstance: {
        prepareForCreation: jasmine.createSpy(),
        prepareForEdition: jasmine.createSpy(),
        canDismiss: jasmine.createSpy().and.returnValue(true)
      },
      result: of({ name: 'new-name' })
    } as any);
  });

  describe('with certificate', () => {
    beforeEach(async () => {
      certificateService.list.and.returnValue(of(certificates));
      tester = new CertificateListComponentTester();
      await tester.change();
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

    it('should open edit modal with beforeDismiss configuration', () => {
      tester.editButtons[0].click();

      expect(modalService.open).toHaveBeenCalledWith(
        jasmine.any(Function),
        jasmine.objectContaining({
          size: 'lg',
          beforeDismiss: jasmine.any(Function)
        })
      );
      expect(certificateService.list).toHaveBeenCalledTimes(2);
      expect(notificationService.success).toHaveBeenCalledWith('engine.certificate.updated', { name: 'new-name' });
    });

    it('should open add modal with beforeDismiss configuration', () => {
      tester.addCertificate.click();
      expect(modalService.open).toHaveBeenCalledWith(
        jasmine.any(Function),
        jasmine.objectContaining({
          size: 'lg',
          beforeDismiss: jasmine.any(Function)
        })
      );
      expect(certificateService.list).toHaveBeenCalledTimes(2);
      expect(notificationService.success).toHaveBeenCalledWith('engine.certificate.created', { name: 'new-name' });
    });
  });

  describe('with no certificate', () => {
    it('should display an empty list', async () => {
      certificateService.list.and.returnValue(of([]));
      tester = new CertificateListComponentTester();
      await tester.change();
      expect(tester.noCertificate).toContainText('No certificate');
    });
  });
});
