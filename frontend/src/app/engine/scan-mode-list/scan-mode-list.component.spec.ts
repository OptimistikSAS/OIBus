import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';

import { ScanModeListComponent } from './scan-mode-list.component';
import { EditScanModeModalComponent } from './edit-scan-mode-modal/edit-scan-mode-modal.component';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { ScanModeService } from '../../services/scan-mode.service';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';
import { MockModalService, provideModalTesting } from '../../shared/mock-modal.service.testing';
import testData from '../../../../../backend/src/tests/utils/test-data';
import { ScanModeDTO } from '../../../../../backend/shared/model/scan-mode.model';
import { createMock, MockObject } from '../../../test/vitest-create-mock';

class ScanModeListComponentTester {
  readonly fixture = TestBed.createComponent(ScanModeListComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly scanModes = this.root.getByCss('tbody tr');
  readonly deleteButtons = this.root.getByCss('.delete-scan-mode');
  readonly editButtons = this.root.getByCss('.edit-scan-mode');
  readonly addScanMode = this.root.getByCss('#add-scan-mode');
  readonly noScanMode = this.root.getByCss('#no-scan-mode');

  constructor() {
    this.fixture.detectChanges();
  }
}

describe('ScanModeListComponent', () => {
  let tester: ScanModeListComponentTester;
  let scanModeService: MockObject<ScanModeService>;
  let confirmationService: MockObject<ConfirmationService>;
  let notificationService: MockObject<NotificationService>;
  let modalService: MockModalService<EditScanModeModalComponent>;

  beforeEach(() => {
    scanModeService = createMock(ScanModeService);
    confirmationService = createMock(ConfirmationService);
    notificationService = createMock(NotificationService);

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
    beforeEach(() => {
      scanModeService.list.mockReturnValue(of(testData.scanMode.list as unknown as Array<ScanModeDTO>));
      tester = new ScanModeListComponentTester();
    });

    test('should display a list of scan modes (excluding subscription)', async () => {
      const nonSubscriptionCount = testData.scanMode.list.filter(s => s.id !== 'subscription').length;
      await expect.element(tester.scanModes).toHaveLength(nonSubscriptionCount);
    });

    test('should delete a scan mode', async () => {
      const nonSubscriptionScanModes = testData.scanMode.list.filter(s => s.id !== 'subscription');
      confirmationService.confirm.mockReturnValue(of(undefined));
      scanModeService.delete.mockReturnValue(of(undefined));

      await tester.deleteButtons.nth(0).click();

      expect(confirmationService.confirm).toHaveBeenCalled();
      expect(scanModeService.delete).toHaveBeenCalledWith(nonSubscriptionScanModes[0].id);
      expect(notificationService.success).toHaveBeenCalledWith('engine.scan-mode.deleted', {
        name: nonSubscriptionScanModes[0].name
      });
    });

    test('should open edit modal', async () => {
      const fakeEditComponent = createMock(EditScanModeModalComponent);
      modalService.mockClosedModal(fakeEditComponent, { name: 'updated-scan-mode' } as ScanModeDTO);

      await tester.editButtons.nth(0).click();

      expect(fakeEditComponent.prepareForEdition).toHaveBeenCalled();
      expect(notificationService.success).toHaveBeenCalledWith('engine.scan-mode.updated', { name: 'updated-scan-mode' });
    });

    test('should open add modal', async () => {
      const fakeEditComponent = createMock(EditScanModeModalComponent);
      modalService.mockClosedModal(fakeEditComponent, { name: 'new-scan-mode' } as ScanModeDTO);

      await tester.addScanMode.click();

      expect(fakeEditComponent.prepareForCreation).toHaveBeenCalled();
      expect(notificationService.success).toHaveBeenCalledWith('engine.scan-mode.created', { name: 'new-scan-mode' });
    });
  });

  describe('with no scan modes', () => {
    test('should display an empty list', async () => {
      scanModeService.list.mockReturnValue(of([]));
      tester = new ScanModeListComponentTester();

      await expect.element(tester.noScanMode).toBeInTheDocument();
    });
  });
});
