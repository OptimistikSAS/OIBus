import { TestBed } from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';

import { CertificateListComponent } from './certificate-list.component';
import { EditCertificateModalComponent } from './edit-certificate-modal/edit-certificate-modal.component';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { CertificateService } from '../../services/certificate.service';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';
import { MockModalService, provideModalTesting } from '../../shared/mock-modal.service.spec';
import testData from '../../../../../backend/src/tests/utils/test-data';
import { CertificateDTO } from '../../../../../backend/shared/model/certificate.model';
import { createMock, MockObject } from '../../../test/vitest-create-mock';

class CertificateListComponentTester {
  readonly fixture = TestBed.createComponent(CertificateListComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly title = this.root.getByCss('#title');
  readonly addCertificate = this.root.getByCss('#add-certificate');
  readonly deleteButtons = this.root.getByCss('.delete-certificate');
  readonly editButtons = this.root.getByCss('.edit-certificate');
  readonly noCertificate = this.root.getByCss('#no-certificate');
  readonly certificates = this.root.getByCss('tbody tr');
}

describe('CertificateListComponent', () => {
  let tester: CertificateListComponentTester;
  let certificateService: MockObject<CertificateService>;
  let confirmationService: MockObject<ConfirmationService>;
  let notificationService: MockObject<NotificationService>;
  let modalService: MockModalService<EditCertificateModalComponent>;

  beforeEach(() => {
    certificateService = createMock(CertificateService);
    confirmationService = createMock(ConfirmationService);
    notificationService = createMock(NotificationService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideHttpClientTesting(),
        provideModalTesting(),
        { provide: CertificateService, useValue: certificateService },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });
    modalService = TestBed.inject(MockModalService);
  });

  describe('with certificate', () => {
    beforeEach(() => {
      certificateService.list.mockReturnValue(of(testData.certificates.list as unknown as Array<CertificateDTO>));
      tester = new CertificateListComponentTester();
    });

    test('should display a list of certificates', async () => {
      await expect.element(tester.title).toHaveTextContent('Certificates');
      await expect.element(tester.certificates).toHaveLength(2);

      const secondCertificateCells = tester.certificates.nth(1).getByCss('td');
      await expect.element(tester.certificates.nth(0).getByCss('td')).toHaveLength(11);
      await expect.element(secondCertificateCells.nth(0)).toHaveTextContent('Certificate 2');
      await expect.element(secondCertificateCells.nth(1)).toHaveTextContent('');
      await expect.element(secondCertificateCells.nth(2)).toHaveTextContent('public key');
      await expect.element(secondCertificateCells.nth(4)).toHaveTextContent('certificate');
      await expect.element(secondCertificateCells.nth(6)).toHaveTextContent('20 Mar 2020');
      await expect.element(tester.editButtons).toHaveLength(2);
      await expect.element(tester.deleteButtons).toHaveLength(2);
    });

    test('should delete a certificate', async () => {
      certificateService.list.mockClear();
      confirmationService.confirm.mockReturnValue(of(undefined));
      certificateService.delete.mockReturnValue(of(undefined));

      await tester.deleteButtons.nth(0).click();

      // confirm, delete, notify and refresh
      expect(confirmationService.confirm).toHaveBeenCalled();
      expect(certificateService.delete).toHaveBeenCalledWith('certificate1');
      expect(certificateService.list).toHaveBeenCalledTimes(1);
      expect(notificationService.success).toHaveBeenCalledWith('engine.certificate.deleted', { name: 'Certificate 1' });
    });

    test('should open edit modal with beforeDismiss configuration', async () => {
      const fakeEditComponent = createMock(EditCertificateModalComponent);
      modalService.mockClosedModal(fakeEditComponent, { name: 'new-name' });

      await tester.editButtons.nth(0).click();

      expect(fakeEditComponent.prepareForEdition).toHaveBeenCalled();
      expect(certificateService.list).toHaveBeenCalledTimes(2);
      expect(notificationService.success).toHaveBeenCalledWith('engine.certificate.updated', { name: 'new-name' });
    });

    test('should open add modal with beforeDismiss configuration', async () => {
      const fakeEditComponent = createMock(EditCertificateModalComponent);
      modalService.mockClosedModal(fakeEditComponent, { name: 'new-name' });

      await tester.addCertificate.click();

      expect(fakeEditComponent.prepareForCreation).toHaveBeenCalled();
      expect(certificateService.list).toHaveBeenCalledTimes(2);
      expect(notificationService.success).toHaveBeenCalledWith('engine.certificate.created', { name: 'new-name' });
    });
  });

  describe('with no certificate', () => {
    test('should display an empty list', async () => {
      certificateService.list.mockReturnValue(of([]));
      tester = new CertificateListComponentTester();

      await expect.element(tester.noCertificate).toHaveTextContent('No certificate');
    });
  });
});
