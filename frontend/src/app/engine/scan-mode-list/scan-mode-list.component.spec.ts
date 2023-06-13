import { TestBed } from '@angular/core/testing';

import { ScanModeListComponent } from './scan-mode-list.component';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { ComponentTester, createMock, TestButton } from 'ngx-speculoos';
import { of } from 'rxjs';
import { ScanModeService } from '../../services/scan-mode.service';
import { ScanModeDTO } from '../../../../../shared/model/scan-mode.model';
import { MockModalService, provideModalTesting } from '../../shared/mock-modal.service.spec';
import { EditScanModeModalComponent } from '../edit-scan-mode-modal/edit-scan-mode-modal.component';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';

class ScanModeListComponentTester extends ComponentTester<ScanModeListComponent> {
  constructor() {
    super(ScanModeListComponent);
  }

  get title() {
    return this.element('#title')!;
  }

  get addScanMode() {
    return this.button('#add-scan-mode')!;
  }

  get deleteButtons() {
    return this.elements('.delete-scan-mode') as Array<TestButton>;
  }

  get editButtons() {
    return this.elements('.edit-scan-mode') as Array<TestButton>;
  }

  get noScanMode() {
    return this.element('#no-scan-mode');
  }

  get scanModes() {
    return this.elements('tbody tr');
  }
}

describe('ScanModeListComponent', () => {
  let tester: ScanModeListComponentTester;
  let scanModeService: jasmine.SpyObj<ScanModeService>;
  let confirmationService: jasmine.SpyObj<ConfirmationService>;
  let notificationService: jasmine.SpyObj<NotificationService>;

  let scanModes: Array<ScanModeDTO>;

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

    scanModes = [
      {
        id: 'id1',
        name: 'scanMode1',
        description: 'My Scan Mode 1',
        cron: '* * * * * *'
      },
      {
        id: 'id2',
        name: 'scanMode2',
        description: 'My Scan Mode 2',
        cron: '* * * * * *'
      }
    ];

    tester = new ScanModeListComponentTester();
  });

  describe('with scan mode', () => {
    beforeEach(() => {
      scanModeService.list.and.returnValue(of(scanModes));
      tester.detectChanges();
    });

    it('should display a list of scan modes', () => {
      expect(tester.title).toContainText('Scan mode');
      expect(tester.scanModes.length).toEqual(2);
      expect(tester.scanModes[0].elements('td').length).toEqual(4);
      expect(tester.scanModes[1].elements('td')[0]).toContainText('scanMode2');
      expect(tester.scanModes[1].elements('td')[1]).toContainText('My Scan Mode 2');
      expect(tester.scanModes[1].elements('td')[2]).toContainText('* * * * * *');
    });

    it('should add a scan mode', () => {
      scanModeService.list.calls.reset();

      const modalService: MockModalService<EditScanModeModalComponent> = TestBed.inject(MockModalService);
      const fakeEditComponent = createMock(EditScanModeModalComponent);
      modalService.mockClosedModal(fakeEditComponent, { name: 'new-name' });

      tester.addScanMode.click();
      expect(fakeEditComponent.prepareForCreation).toHaveBeenCalled();
      expect(scanModeService.list).toHaveBeenCalledTimes(1);
      expect(notificationService.success).toHaveBeenCalledWith('engine.scan-mode.created', { name: 'new-name' });
    });

    it('should edit a scan mode', () => {
      scanModeService.list.calls.reset();

      const modalService: MockModalService<EditScanModeModalComponent> = TestBed.inject(MockModalService);
      const fakeEditComponent = createMock(EditScanModeModalComponent);
      modalService.mockClosedModal(fakeEditComponent, { name: 'new-name' });

      tester.editButtons[1].click();
      expect(fakeEditComponent.prepareForEdition).toHaveBeenCalledWith(scanModes[1]);
      expect(scanModeService.list).toHaveBeenCalledTimes(1);
      expect(notificationService.success).toHaveBeenCalledWith('engine.scan-mode.updated', { name: 'new-name' });
    });

    it('should delete a scan mode', () => {
      scanModeService.list.calls.reset();

      confirmationService.confirm.and.returnValue(of(undefined));
      scanModeService.delete.and.returnValue(of(undefined));
      tester.deleteButtons[0].click();

      // confirm, delete, notify and refresh
      expect(confirmationService.confirm).toHaveBeenCalled();
      expect(scanModeService.delete).toHaveBeenCalledWith('id1');
      expect(scanModeService.list).toHaveBeenCalledTimes(1);
      expect(notificationService.success).toHaveBeenCalledWith('engine.scan-mode.deleted', { name: 'scanMode1' });
    });
  });

  describe('with no scan mode', () => {
    it('should display an empty list', () => {
      scanModeService.list.and.returnValue(of([]));
      tester.detectChanges();

      expect(tester.title).toContainText('Scan mode');
      expect(tester.noScanMode).toContainText('No scan mode');
    });
  });
});
