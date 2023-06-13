import { TestBed } from '@angular/core/testing';

import { ProxyListComponent } from './proxy-list.component';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { ComponentTester, createMock, TestButton } from 'ngx-speculoos';
import { ProxyService } from '../../services/proxy.service';
import { of } from 'rxjs';
import { ProxyDTO } from '../../../../../shared/model/proxy.model';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';

class ProxyListComponentTester extends ComponentTester<ProxyListComponent> {
  constructor() {
    super(ProxyListComponent);
  }

  get title() {
    return this.element('#title')!;
  }

  get addProxy() {
    return this.button('#add-proxy')!;
  }

  get deleteButtons() {
    return this.elements('.delete-proxy') as Array<TestButton>;
  }

  get editButtons() {
    return this.elements('.edit-proxy') as Array<TestButton>;
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
  let confirmationService: jasmine.SpyObj<ConfirmationService>;
  let notificationService: jasmine.SpyObj<NotificationService>;

  let proxies: Array<ProxyDTO>;

  beforeEach(() => {
    proxyService = createMock(ProxyService);
    confirmationService = createMock(ConfirmationService);
    notificationService = createMock(NotificationService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: ProxyService, useValue: proxyService },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });

    proxies = [
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

    tester = new ProxyListComponentTester();
  });

  describe('with proxy', () => {
    beforeEach(() => {
      proxyService.list.and.returnValue(of(proxies));
      tester.detectChanges();
    });

    it('should display a list of proxies', () => {
      expect(tester.title).toContainText('Proxies');
      expect(tester.proxies.length).toEqual(2);
      expect(tester.proxies[0].elements('td').length).toEqual(4);
      expect(tester.proxies[1].elements('td')[0]).toContainText('proxy2');
      expect(tester.proxies[1].elements('td')[1]).toContainText('My Proxy 2');
      expect(tester.proxies[1].elements('td')[2]).toContainText('http://localhost');
    });
  });

  describe('with no proxy', () => {
    it('should display an empty list', () => {
      const proxies: Array<ProxyDTO> = [];
      proxyService.list.and.returnValue(of(proxies));
      tester.detectChanges();
      expect(tester.noProxy).toContainText('No proxy');
    });
  });
});
