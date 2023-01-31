import { TestBed } from '@angular/core/testing';

import { ProxyListComponent } from './proxy-list.component';
import { provideTestingI18n } from '../../../i18n/mock-i18n';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { ProxyService } from '../../services/proxy.service';
import { of } from 'rxjs';
import { ProxyDTO } from '../../../../../shared/model/proxy.model';

class ProxyListComponentTester extends ComponentTester<ProxyListComponent> {
  constructor() {
    super(ProxyListComponent);
  }

  get title() {
    return this.element('h2')!;
  }

  get addProxy() {
    return this.button('#add-proxy')!;
  }

  get noProxy() {
    return this.element('#no-proxy');
  }
  get proxies() {
    return this.elements('tbody tr');
  }
}

describe('ProxyListComponent', () => {
  let tester: ProxyListComponentTester;
  let proxyService: jasmine.SpyObj<ProxyService>;

  beforeEach(() => {
    proxyService = createMock(ProxyService);

    TestBed.configureTestingModule({
      imports: [ProxyListComponent],
      providers: [provideTestingI18n(), { provide: ProxyService, useValue: proxyService }]
    });

    tester = new ProxyListComponentTester();
  });

  it('should display a list of proxies', () => {
    const proxies: Array<ProxyDTO> = [
      {
        id: 'id1',
        name: 'proxy1',
        description: 'My Proxy 1',
        address: 'http://localhost',
        username: 'user',
        password: 'pass'
      },
      {
        id: 'id2',
        name: 'proxy2',
        description: 'My Proxy 2',
        address: 'http://localhost',
        username: 'user',
        password: 'pass'
      }
    ];

    proxyService.getProxies.and.returnValue(of(proxies));
    tester.detectChanges();

    expect(tester.title).toContainText('Proxy list');
    expect(tester.proxies.length).toEqual(2);
    expect(tester.proxies[0].elements('td').length).toEqual(4);
    expect(tester.proxies[1].elements('td')[0]).toContainText('proxy2');
    expect(tester.proxies[1].elements('td')[1]).toContainText('My Proxy 2');
    expect(tester.proxies[1].elements('td')[2]).toContainText('http://localhost');
  });

  it('should display an empty list', () => {
    const proxies: Array<ProxyDTO> = [];

    proxyService.getProxies.and.returnValue(of(proxies));
    tester.detectChanges();

    expect(tester.title).toContainText('Proxy list');
    expect(tester.noProxy).toContainText('No proxy');
  });
});
