import { TestBed } from '@angular/core/testing';

import { BehaviorSubject, EMPTY, of } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { ScanModeDTO } from '@oibus/shared/api/scan-mode.model';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import testData from '../../../test/test-data';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { ScanModeService } from '../../services/scan-mode.service';
import { AuditHistoryModalComponent } from '../../shared/audit-history-modal/audit-history-modal.component';
import { ConfirmationService } from '../../shared/confirmation.service';
import { MockModalService, provideModalTesting } from '../../shared/mock-modal.service.testing';
import { NotificationService } from '../../shared/notification.service';
import { EditScanModeModalComponent } from './edit-scan-mode-modal/edit-scan-mode-modal.component';
import { ScanModeListComponent } from './scan-mode-list.component';

class ScanModeListComponentTester {
  readonly fixture = TestBed.createComponent(ScanModeListComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly rows = this.root.getByCss('tbody tr');
  readonly addButton = this.root.getByRole('button', { name: 'Add a new scan mode' });
  readonly sortByName = this.root.getByRole('button', { name: 'Name' });
  readonly sortByUpdatedAt = this.root.getByRole('button', { name: 'Updated on' });
  readonly noScanMode = this.root.getByCss('#no-scan-mode');
  readonly pagination = this.root.getByCss('oib-pagination');

  row(index: number) {
    return this.rows.nth(index);
  }

  rowButton(index: number, name: string) {
    return this.row(index).getByRole('button', { name });
  }
}

function buildScanMode(index: number, name: string, overrides: Partial<ScanModeDTO> = {}): ScanModeDTO {
  return { ...testData.scanMode.list[0], id: `scanMode${index}`, name, ...overrides };
}

describe('ScanModeListComponent', () => {
  let scanModeService: MockObject<ScanModeService>;
  let confirmationService: MockObject<ConfirmationService>;
  let notificationService: MockObject<NotificationService>;
  let modalService: MockModalService<EditScanModeModalComponent | AuditHistoryModalComponent>;
  let scanModes: BehaviorSubject<Array<ScanModeDTO>>;
  const [scanMode1, scanMode2] = testData.scanMode.list;

  beforeEach(() => {
    scanModeService = createMock(ScanModeService);
    confirmationService = createMock(ConfirmationService);
    notificationService = createMock(NotificationService);
    // like the real service, the list is emitted again after each modification
    scanModes = new BehaviorSubject(testData.scanMode.list);
    scanModeService.list.mockReturnValue(scanModes);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideModalTesting(),
        { provide: ScanModeService, useValue: scanModeService },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });
    modalService = TestBed.inject(MockModalService);
  });

  describe('with scan modes', () => {
    let tester: ScanModeListComponentTester;

    beforeEach(async () => {
      tester = new ScanModeListComponentTester();
      await expect.element(tester.rows).toHaveLength(2);
    });

    test('should display a list of scan modes, excluding subscription', async () => {
      await expect.element(tester.root).toMatchTextContent('Scan mode(2)');
      await expect.element(tester.rows).toHaveLength(2);
      await expect.element(tester.row(0)).toMatchTextContent('scanMode1my first scanMode');
      await expect.element(tester.row(1)).toMatchTextContent('scanMode2my second scanMode');
      await expect.element(tester.root.getByRole('img', { name: 'This activation window can never fire again' })).not.toBeInTheDocument();
    });

    test('should display the scan modes emitted again by the service', async () => {
      scanModes.next([scanMode2]);

      await expect.element(tester.rows).toHaveLength(1);
      await expect.element(tester.row(0)).toMatchTextContent('scanMode2');
    });

    test('should delete a scan mode', async () => {
      confirmationService.confirm.mockReturnValue(of(undefined));
      scanModeService.delete.mockReturnValue(of(undefined));

      await tester.rowButton(0, 'Delete scan mode').click();

      expect(confirmationService.confirm).toHaveBeenCalledWith({
        messageKey: 'engine.scan-mode.confirm-deletion',
        interpolateParams: { name: 'scanMode1' }
      });
      expect(scanModeService.delete).toHaveBeenCalledWith('scanModeId1');
      expect(notificationService.success).toHaveBeenCalledWith('engine.scan-mode.deleted', { name: 'scanMode1' });
    });

    test('should not delete a scan mode if not confirmed', async () => {
      confirmationService.confirm.mockReturnValue(EMPTY);

      await tester.rowButton(0, 'Delete scan mode').click();

      expect(scanModeService.delete).not.toHaveBeenCalled();
    });

    test('should edit a scan mode', async () => {
      const fakeEditComponent = createMock(EditScanModeModalComponent);
      modalService.mockClosedModal(fakeEditComponent, { ...scanMode1, name: 'updated-scan-mode' });

      await tester.rowButton(0, 'Edit scan mode').click();

      expect(fakeEditComponent.prepareForEdition).toHaveBeenCalledWith(scanMode1);
      expect(notificationService.success).toHaveBeenCalledWith('engine.scan-mode.updated', { name: 'updated-scan-mode' });
    });

    test('should create a scan mode', async () => {
      const fakeEditComponent = createMock(EditScanModeModalComponent);
      modalService.mockClosedModal(fakeEditComponent, { ...scanMode1, name: 'new-scan-mode' });

      await tester.addButton.click();

      expect(fakeEditComponent.prepareForCreation).toHaveBeenCalled();
      expect(notificationService.success).toHaveBeenCalledWith('engine.scan-mode.created', { name: 'new-scan-mode' });
    });

    test('should not notify when the modal is dismissed', async () => {
      modalService.mockDismissedModal(createMock(EditScanModeModalComponent));

      await tester.addButton.click();

      expect(notificationService.success).not.toHaveBeenCalled();
    });

    test('should open the audit history modal with the scan mode entity type and id', async () => {
      const fakeAuditComponent = createMock(AuditHistoryModalComponent);
      modalService.mockClosedModal(fakeAuditComponent);

      await tester.rowButton(0, 'View scan mode audit history').click();

      expect(fakeAuditComponent.prepare).toHaveBeenCalledWith('scan_mode', 'scanModeId1');
    });
  });

  test('should warn about an activation window that can never fire again, and show restricted windows', async () => {
    scanModes.next([
      buildScanMode(1, 'expired', {
        activationWindowExpired: true,
        activationWindow: { dateRange: { start: null, end: '2020-01-01T00:00:00.000Z' }, recurring: null }
      }),
      buildScanMode(2, 'not expired')
    ]);
    const tester = new ScanModeListComponentTester();

    await expect.element(tester.row(0).getByRole('img', { name: 'This activation window can never fire again' })).toBeInTheDocument();
    await expect.element(tester.row(0)).toMatchTextContent('Restricted activation window');
    await expect.element(tester.row(1).getByRole('img')).not.toBeInTheDocument();
  });

  test('should sort the scan modes by name and by update date', async () => {
    scanModes.next([
      buildScanMode(1, 'b', { updatedAt: '2024-01-01' }),
      buildScanMode(2, 'c', { updatedAt: '2024-01-03' }),
      buildScanMode(3, 'a', { updatedAt: '2024-01-02' })
    ]);
    const tester = new ScanModeListComponentTester();
    await expect.element(tester.row(0)).toMatchTextContent('b');
    await expect.element(tester.sortByName.getByCss('.fa-sort')).toBeInTheDocument();

    await tester.sortByName.click();
    await expect.element(tester.row(0).getByRole('cell').first()).toHaveTextContent('a');
    await expect.element(tester.row(2).getByRole('cell').first()).toHaveTextContent('c');
    await expect.element(tester.sortByName.getByCss('.fa-sort-up')).toBeInTheDocument();

    await tester.sortByName.click();
    await expect.element(tester.row(0).getByRole('cell').first()).toHaveTextContent('c');
    await expect.element(tester.sortByName.getByCss('.fa-sort-down')).toBeInTheDocument();

    await tester.sortByUpdatedAt.click();
    await expect.element(tester.row(0).getByRole('cell').first()).toHaveTextContent('b');
    await expect.element(tester.row(2).getByRole('cell').first()).toHaveTextContent('c');
    await expect.element(tester.sortByUpdatedAt.getByCss('.fa-sort-up')).toBeInTheDocument();
  });

  test('should paginate the scan modes', async () => {
    scanModes.next(Array.from({ length: 25 }, (_, index) => buildScanMode(index + 1, `Scan mode ${index + 1}`)));
    const tester = new ScanModeListComponentTester();
    await expect.element(tester.rows).toHaveLength(20);

    await tester.pagination.getByRole('link', { name: '2' }).click();

    await expect.element(tester.rows).toHaveLength(5);
    await expect.element(tester.row(0)).toMatchTextContent('Scan mode 21');
  });

  test('should display an empty list', async () => {
    scanModes.next([]);
    const tester = new ScanModeListComponentTester();

    await expect.element(tester.noScanMode).toBeInTheDocument();
  });
});
