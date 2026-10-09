import { TestBed } from '@angular/core/testing';

import { EMPTY, of } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { CertificateDTO } from '@oibus/shared/api/certificate.model';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import testData from '../../../test/test-data';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { CertificateService } from '../../services/certificate.service';
import { AuditHistoryModalComponent } from '../../shared/audit-history-modal/audit-history-modal.component';
import { ConfirmationService } from '../../shared/confirmation.service';
import { MockModalService, provideModalTesting } from '../../shared/mock-modal.service.testing';
import { NotificationService } from '../../shared/notification.service';
import { CertificateListComponent } from './certificate-list.component';
import { EditCertificateModalComponent } from './edit-certificate-modal/edit-certificate-modal.component';
import { ExportCertificateModalComponent } from './export-certificate-modal/export-certificate-modal.component';
import { ImportCertificateModalComponent } from './import-certificate-modal/import-certificate-modal.component';

class CertificateListComponentTester {
  readonly fixture = TestBed.createComponent(CertificateListComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly title = this.root.getByCss('#title');
  readonly addButton = this.root.getByRole('button', { name: 'Add a new certificate' });
  readonly importButton = this.root.getByRole('button', { name: 'Import' });
  readonly sortByUpdatedAt = this.root.getByRole('button', { name: 'Updated on' });
  readonly rows = this.root.getByCss('tbody tr');
  readonly noCertificate = this.root.getByCss('#no-certificate');
  readonly pagination = this.root.getByCss('oib-pagination');

  row(index: number) {
    return this.rows.nth(index);
  }

  rowButton(index: number, name: string) {
    return this.row(index).getByRole('button', { name });
  }
}

function buildCertificate(index: number, updatedAt: string): CertificateDTO {
  return { ...testData.certificates.list[0], id: `certificate${index}`, name: `Certificate ${index}`, updatedAt };
}

describe('CertificateListComponent', () => {
  let certificateService: MockObject<CertificateService>;
  let confirmationService: MockObject<ConfirmationService>;
  let notificationService: MockObject<NotificationService>;
  let modalService: MockModalService<
    EditCertificateModalComponent | ImportCertificateModalComponent | ExportCertificateModalComponent | AuditHistoryModalComponent
  >;

  beforeEach(() => {
    certificateService = createMock(CertificateService);
    confirmationService = createMock(ConfirmationService);
    notificationService = createMock(NotificationService);
    certificateService.list.mockReturnValue(of(testData.certificates.list));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideModalTesting(),
        { provide: CertificateService, useValue: certificateService },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });
    modalService = TestBed.inject(MockModalService);
  });

  describe('with certificates', () => {
    let tester: CertificateListComponentTester;

    beforeEach(async () => {
      tester = new CertificateListComponentTester();
      await expect.element(tester.rows).toHaveLength(2);
    });

    test('should display a list of certificates', async () => {
      await expect.element(tester.title).toHaveTextContent('Certificates');
      await expect.element(tester.root).toMatchTextContent('Certificates(2)');
      await expect.element(tester.rows).toHaveLength(2);

      const secondCertificateCells = tester.row(1).getByCss('td');
      await expect.element(tester.row(0).getByCss('td')).toHaveLength(9);
      await expect.element(secondCertificateCells.nth(0)).toHaveTextContent('Certificate 2');
      await expect.element(secondCertificateCells.nth(1)).toHaveTextContent('');
      await expect.element(secondCertificateCells.nth(2)).toHaveTextContent('public key');
      await expect.element(secondCertificateCells.nth(4)).toHaveTextContent('certificate');
      await expect.element(secondCertificateCells.nth(6)).toMatchTextContent('20 Mar 2020');
      await expect.element(tester.rowButton(1, 'Edit certificate')).toBeInTheDocument();
      await expect.element(tester.rowButton(1, 'Delete certificate')).toBeInTheDocument();
    });

    test('should delete a certificate and refresh the list', async () => {
      confirmationService.confirm.mockReturnValue(of(undefined));
      certificateService.delete.mockReturnValue(of(undefined));
      certificateService.list.mockReturnValue(of([testData.certificates.list[1]]));

      await tester.rowButton(0, 'Delete certificate').click();

      expect(confirmationService.confirm).toHaveBeenCalledWith({
        messageKey: 'engine.certificate.confirm-deletion',
        interpolateParams: { name: 'Certificate 1' }
      });
      expect(certificateService.delete).toHaveBeenCalledWith('certificate1');
      expect(notificationService.success).toHaveBeenCalledWith('engine.certificate.deleted', { name: 'Certificate 1' });
      await expect.element(tester.rows).toHaveLength(1);
      expect(certificateService.list).toHaveBeenCalledTimes(2);
    });

    test('should not delete a certificate if not confirmed', async () => {
      confirmationService.confirm.mockReturnValue(EMPTY);

      await tester.rowButton(0, 'Delete certificate').click();

      expect(certificateService.delete).not.toHaveBeenCalled();
      expect(certificateService.list).toHaveBeenCalledTimes(1);
    });

    test('should edit a certificate and refresh the list', async () => {
      const fakeEditComponent = createMock(EditCertificateModalComponent);
      modalService.mockClosedModal(fakeEditComponent, { ...testData.certificates.list[0], name: 'new-name' });

      await tester.rowButton(0, 'Edit certificate').click();

      expect(fakeEditComponent.prepareForEdition).toHaveBeenCalledWith(testData.certificates.list[0]);
      expect(notificationService.success).toHaveBeenCalledWith('engine.certificate.updated', { name: 'new-name' });
      expect(certificateService.list).toHaveBeenCalledTimes(2);
    });

    test('should create a certificate and refresh the list', async () => {
      const fakeEditComponent = createMock(EditCertificateModalComponent);
      modalService.mockClosedModal(fakeEditComponent, { ...testData.certificates.list[0], name: 'new-name' });

      await tester.addButton.click();

      expect(fakeEditComponent.prepareForCreation).toHaveBeenCalled();
      expect(notificationService.success).toHaveBeenCalledWith('engine.certificate.created', { name: 'new-name' });
      expect(certificateService.list).toHaveBeenCalledTimes(2);
    });

    test('should import a certificate and refresh the list', async () => {
      modalService.mockClosedModal(createMock(ImportCertificateModalComponent), { ...testData.certificates.list[0], name: 'new-name' });

      await tester.importButton.click();

      expect(notificationService.success).toHaveBeenCalledWith('engine.certificate.imported', { name: 'new-name' });
      expect(certificateService.list).toHaveBeenCalledTimes(2);
    });

    test('should not refresh the list when a modal is dismissed', async () => {
      modalService.mockDismissedModal(createMock(EditCertificateModalComponent));

      await tester.addButton.click();

      expect(notificationService.success).not.toHaveBeenCalled();
      expect(certificateService.list).toHaveBeenCalledTimes(1);
    });

    test('should open the export modal and prepare it with the certificate', async () => {
      const fakeExportComponent = createMock(ExportCertificateModalComponent);
      modalService.mockClosedModal(fakeExportComponent);

      await tester.rowButton(0, 'Export certificate').click();

      expect(fakeExportComponent.prepare).toHaveBeenCalledWith(testData.certificates.list[0]);
      expect(certificateService.list).toHaveBeenCalledTimes(1);
    });

    test('should open the audit history modal with the certificate entity type and id', async () => {
      const fakeAuditComponent = createMock(AuditHistoryModalComponent);
      modalService.mockClosedModal(fakeAuditComponent);

      await tester.rowButton(0, 'View certificate audit history').click();

      expect(fakeAuditComponent.prepare).toHaveBeenCalledWith('certificate', testData.certificates.list[0].id);
    });
  });

  test('should sort the certificates by update date', async () => {
    certificateService.list.mockReturnValue(
      of([
        buildCertificate(1, '2024-01-02T00:00:00.000Z'),
        buildCertificate(2, '2024-01-03T00:00:00.000Z'),
        buildCertificate(3, '2024-01-01T00:00:00.000Z')
      ])
    );
    const tester = new CertificateListComponentTester();
    await expect.element(tester.row(0)).toMatchTextContent('Certificate 1');
    await expect.element(tester.sortByUpdatedAt.getByCss('.fa-sort')).toBeInTheDocument();

    await tester.sortByUpdatedAt.click();
    await expect.element(tester.row(0)).toMatchTextContent('Certificate 3');
    await expect.element(tester.row(2)).toMatchTextContent('Certificate 2');
    await expect.element(tester.sortByUpdatedAt.getByCss('.fa-sort-up')).toBeInTheDocument();

    await tester.sortByUpdatedAt.click();
    await expect.element(tester.row(0)).toMatchTextContent('Certificate 2');
    await expect.element(tester.row(2)).toMatchTextContent('Certificate 3');
    await expect.element(tester.sortByUpdatedAt.getByCss('.fa-sort-down')).toBeInTheDocument();
  });

  test('should paginate the certificates, and go back to the first page when sorting', async () => {
    certificateService.list.mockReturnValue(
      of(Array.from({ length: 25 }, (_, index) => buildCertificate(index + 1, `2024-01-${String(25 - index).padStart(2, '0')}`)))
    );
    const tester = new CertificateListComponentTester();
    await expect.element(tester.rows).toHaveLength(20);

    await tester.pagination.getByRole('link', { name: '2' }).click();
    await expect.element(tester.rows).toHaveLength(5);
    await expect.element(tester.row(0)).toMatchTextContent('Certificate 21');

    await tester.sortByUpdatedAt.click();
    await expect.element(tester.rows).toHaveLength(20);
    await expect.element(tester.row(0)).toMatchTextContent('Certificate 25');
  });

  test('should display an empty list', async () => {
    certificateService.list.mockReturnValue(of([]));
    const tester = new CertificateListComponentTester();

    await expect.element(tester.noCertificate).toMatchTextContent('No certificate');
    await expect.element(tester.pagination).not.toBeInTheDocument();
  });
});
