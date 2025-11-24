import { TestBed } from '@angular/core/testing';

import { IpFilterListComponent } from './ip-filter-list.component';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { ComponentTester, createMock, TestButton } from 'ngx-speculoos';
import { of } from 'rxjs';
import { IpFilterService } from '../../services/ip-filter.service';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';
import { provideModalTesting } from '../../shared/mock-modal.service.spec';
import testData from '../../../../../backend/src/tests/utils/test-data';
import { ModalService } from '../../shared/modal.service';

class IpFilterListComponentTester extends ComponentTester<IpFilterListComponent> {
  constructor() {
    super(IpFilterListComponent);
  }

  get title() {
    return this.element('#title')!;
  }

  get addIpFilter() {
    return this.button('#add-ip-filter')!;
  }

  get deleteButtons() {
    return this.elements('.delete-ip-filter') as Array<TestButton>;
  }

  get editButtons() {
    return this.elements('.edit-ip-filter') as Array<TestButton>;
  }

  get noIpFilter() {
    return this.element('#no-ip-filter');
  }

  get ipFilters() {
    return this.elements('tbody tr');
  }
}

describe('IpFilterListComponent', () => {
  let tester: IpFilterListComponentTester;
  let ipFilterService: jasmine.SpyObj<IpFilterService>;
  let confirmationService: jasmine.SpyObj<ConfirmationService>;
  let notificationService: jasmine.SpyObj<NotificationService>;
  let modalService: jasmine.SpyObj<ModalService>;

  const ipFilters = testData.ipFilters.list;

  beforeEach(() => {
    ipFilterService = createMock(IpFilterService);
    confirmationService = createMock(ConfirmationService);
    notificationService = createMock(NotificationService);
    modalService = createMock(ModalService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideModalTesting(),
        { provide: IpFilterService, useValue: ipFilterService },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: NotificationService, useValue: notificationService },
        { provide: ModalService, useValue: modalService }
      ]
    });

    tester = new IpFilterListComponentTester();

    modalService.open.and.returnValue({
      componentInstance: {
        prepareForCreation: jasmine.createSpy(),
        prepareForEdition: jasmine.createSpy(),
        canDismiss: jasmine.createSpy().and.returnValue(true)
      },
      result: of({ address: 'new-address' })
    } as any);
  });

  describe('with ip filter', () => {
    beforeEach(async () => {
      ipFilterService.list.and.returnValue(of(ipFilters));
      await tester.change();
    });

    it('should display a list of ip filters', () => {
      expect(tester.title).toContainText('IP filters');
      expect(tester.ipFilters.length).toEqual(2);
      expect(tester.ipFilters[0].elements('td').length).toEqual(3);
      expect(tester.ipFilters[1].elements('td')[0]).toContainText('*');
      expect(tester.ipFilters[1].elements('td')[1]).toContainText('All ips');
    });

    it('should delete an ip filter', () => {
      ipFilterService.list.calls.reset();

      confirmationService.confirm.and.returnValue(of(undefined));
      ipFilterService.delete.and.returnValue(of(undefined));
      tester.deleteButtons[0].click();

      // confirm, delete, notify and refresh
      expect(confirmationService.confirm).toHaveBeenCalled();
      expect(ipFilterService.delete).toHaveBeenCalledWith('ipFilterId1');
      expect(ipFilterService.list).toHaveBeenCalledTimes(1);
      expect(notificationService.success).toHaveBeenCalledWith('engine.ip-filter.deleted', { address: '192.168.1.1' });
    });

    it('should open edit modal with beforeDismiss configuration', () => {
      tester.editButtons[0].click();

      expect(modalService.open).toHaveBeenCalledWith(
        jasmine.any(Function),
        jasmine.objectContaining({
          beforeDismiss: jasmine.any(Function)
        })
      );
      expect(ipFilterService.list).toHaveBeenCalledTimes(2);
      expect(notificationService.success).toHaveBeenCalledWith('engine.ip-filter.updated', { address: 'new-address' });
    });

    it('should open add modal with beforeDismiss configuration', () => {
      tester.addIpFilter.click();
      expect(modalService.open).toHaveBeenCalledWith(
        jasmine.any(Function),
        jasmine.objectContaining({
          beforeDismiss: jasmine.any(Function)
        })
      );
      expect(ipFilterService.list).toHaveBeenCalledTimes(2);
      expect(notificationService.success).toHaveBeenCalledWith('engine.ip-filter.created', { address: 'new-address' });
    });
  });

  describe('with no ip filter', () => {
    it('should display an empty list', async () => {
      ipFilterService.list.and.returnValue(of([]));
      await tester.change();
      expect(tester.noIpFilter).toContainText('No IP filter');
    });
  });
});
