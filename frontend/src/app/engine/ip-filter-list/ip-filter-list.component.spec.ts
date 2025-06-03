import { TestBed } from '@angular/core/testing';

import { IpFilterListComponent } from './ip-filter-list.component';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { ComponentTester, createMock, TestButton } from 'ngx-speculoos';
import { of } from 'rxjs';
import { IpFilterService } from '../../services/ip-filter.service';
import { IPFilterDTO } from '../../../../../backend/shared/model/ip-filter.model';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';
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

  let ipFilters: Array<IPFilterDTO>;

  beforeEach(() => {
    ipFilterService = createMock(IpFilterService);
    confirmationService = createMock(ConfirmationService);
    notificationService = createMock(NotificationService);
    modalService = createMock(ModalService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: IpFilterService, useValue: ipFilterService },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: NotificationService, useValue: notificationService },
        { provide: ModalService, useValue: modalService }
      ]
    });

    ipFilters = [
      {
        id: 'id1',
        address: 'http://localhost',
        description: 'My IP filter 1'
      },
      {
        id: 'id2',
        address: 'http://localhost',
        description: 'My IP filter 2'
      }
    ];

    tester = new IpFilterListComponentTester();

    modalService.open.and.returnValue({
      componentInstance: {
        prepareForCreation: jasmine.createSpy(),
        prepareForEdition: jasmine.createSpy(),
        canDismiss: jasmine.createSpy().and.returnValue(true)
      },
      result: of({})
    } as any);
  });

  describe('with ip filter', () => {
    beforeEach(() => {
      ipFilterService.list.and.returnValue(of(ipFilters));
      tester.detectChanges();
    });

    it('should display a list of ip filters', () => {
      expect(tester.title).toContainText('IP filters');
      expect(tester.ipFilters.length).toEqual(2);
      expect(tester.ipFilters[0].elements('td').length).toEqual(3);
      expect(tester.ipFilters[1].elements('td')[0]).toContainText('http://localhost');
      expect(tester.ipFilters[1].elements('td')[1]).toContainText('My IP filter 2');
    });

    it('should open edit modal with beforeDismiss configuration', () => {
      tester.editButtons[0].click();

      expect(modalService.open).toHaveBeenCalledWith(
        jasmine.any(Function),
        jasmine.objectContaining({
          beforeDismiss: jasmine.any(Function)
        })
      );
    });

    it('should open add modal with beforeDismiss configuration', () => {
      const addButton = tester.element('#add-ip-filter');

      expect(addButton).toBeTruthy();

      (addButton as TestButton)!.click();
      expect(modalService.open).toHaveBeenCalledWith(
        jasmine.any(Function),
        jasmine.objectContaining({
          beforeDismiss: jasmine.any(Function)
        })
      );
    });
  });

  describe('with no ip filter', () => {
    it('should display an empty list', () => {
      ipFilterService.list.and.returnValue(of([]));
      tester.detectChanges();
      expect(tester.noIpFilter).toContainText('No IP filter');
    });
  });
});
