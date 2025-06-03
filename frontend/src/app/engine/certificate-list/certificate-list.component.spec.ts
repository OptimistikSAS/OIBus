import { TestBed } from '@angular/core/testing';

import { CertificateListComponent } from './certificate-list.component';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { ComponentTester, createMock, TestButton } from 'ngx-speculoos';
import { of } from 'rxjs';
import { CertificateService } from '../../services/certificate.service';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';
import { provideHttpClient } from '@angular/common/http';
import { ModalService } from '../../shared/modal.service';

class CertificateListComponentTester extends ComponentTester<CertificateListComponent> {
  constructor() {
    super(CertificateListComponent);
  }

  get title() {
    return this.element('#title')!;
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

  beforeEach(() => {
    certificateService = createMock(CertificateService);
    confirmationService = createMock(ConfirmationService);
    notificationService = createMock(NotificationService);
    modalService = createMock(ModalService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideHttpClient(),
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
      result: of({})
    } as any);
  });

  describe('with certificate', () => {
    beforeEach(() => {
      certificateService.list.and.returnValue(
        of([
          {
            id: 'id1',
            name: 'http://localhost',
            description: 'My certificate 1',
            publicKey: 'pub1',
            certificate: 'cert1',
            expiry: '2033-01-01T12:00:00Z'
          },
          {
            id: 'id2',
            name: 'Cert2',
            description: 'My certificate 2',
            publicKey: 'pub2',
            certificate: 'cert2',
            expiry: '2033-01-01T12:00:00Z'
          }
        ])
      );
      tester = new CertificateListComponentTester();
      tester.detectChanges();
    });

    it('should display a list of certificates', () => {
      expect(tester.title).toContainText('Certificates');
      expect(tester.certificates.length).toEqual(2);
      expect(tester.certificates[0].elements('td').length).toEqual(8);
      expect(tester.certificates[1].elements('td')[0]).toContainText('Cert2');
      expect(tester.certificates[1].elements('td')[1]).toContainText('My certificate 2');
      expect(tester.certificates[1].elements('td')[2]).toContainText('pub2');
      expect(tester.certificates[1].elements('td')[4]).toContainText('cert2');
      expect(tester.certificates[1].elements('td')[6]).toContainText('1 Jan 2033');
      expect(tester.editButtons.length).toBe(2);
      expect(tester.deleteButtons.length).toBe(2);
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
    });

    it('should open add modal with beforeDismiss configuration', () => {
      const addButton = tester.element('#add-certificate')!;
      (addButton as TestButton)!.click();

      expect(modalService.open).toHaveBeenCalledWith(
        jasmine.any(Function),
        jasmine.objectContaining({
          size: 'lg',
          beforeDismiss: jasmine.any(Function)
        })
      );
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
