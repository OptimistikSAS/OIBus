import { TestBed } from '@angular/core/testing';

import { IpFilterListComponent } from './ip-filter-list.component';
import { provideTestingI18n } from '../../../i18n/mock-i18n';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { of } from 'rxjs';
import { IpFilterService } from '../../services/ip-filter.service';
import { IpFilterDTO } from '../../model/ip-filter.model';

class IpFilterListComponentTester extends ComponentTester<IpFilterListComponent> {
  constructor() {
    super(IpFilterListComponent);
  }

  get title() {
    return this.element('h2')!;
  }

  get addIpFilter() {
    return this.button('#add-ip-filter')!;
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

  beforeEach(() => {
    ipFilterService = createMock(IpFilterService);

    TestBed.configureTestingModule({
      imports: [IpFilterListComponent],
      providers: [provideTestingI18n(), { provide: IpFilterService, useValue: ipFilterService }]
    });

    tester = new IpFilterListComponentTester();
  });

  it('should display a list of ip filters', () => {
    const ipFilters: Array<IpFilterDTO> = [
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

    ipFilterService.getIpFilters.and.returnValue(of(ipFilters));
    tester.detectChanges();

    expect(tester.title).toContainText('IP filter list');
    expect(tester.ipFilters.length).toEqual(2);
    expect(tester.ipFilters[0].elements('td').length).toEqual(3);
    expect(tester.ipFilters[1].elements('td')[0]).toContainText('http://localhost');
    expect(tester.ipFilters[1].elements('td')[1]).toContainText('My IP filter 2');
  });

  it('should display an empty list', () => {
    ipFilterService.getIpFilters.and.returnValue(of([]));
    tester.detectChanges();

    expect(tester.title).toContainText('IP filter list');
    expect(tester.noIpFilter).toContainText('No IP filter');
  });
});
