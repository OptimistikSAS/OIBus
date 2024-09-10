import { TestBed } from '@angular/core/testing';

import { IpFilterListComponent } from './ip-filter-list.component';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { ComponentTester, createMock, TestButton } from 'ngx-speculoos';
import { of } from 'rxjs';
import { IpFilterService } from '../../services/ip-filter.service';
import { IPFilterDTO } from '../../../../../shared/model/ip-filter.model';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';

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

  let ipFilters: Array<IPFilterDTO>;

  beforeEach(() => {
    ipFilterService = createMock(IpFilterService);
    confirmationService = createMock(ConfirmationService);
    notificationService = createMock(NotificationService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: IpFilterService, useValue: ipFilterService },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: NotificationService, useValue: notificationService }
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
  });

  describe('with no ip filter', () => {
    it('should display an empty list', () => {
      ipFilterService.list.and.returnValue(of([]));
      tester.detectChanges();
      expect(tester.noIpFilter).toContainText('No IP filter');
    });
  });
});
