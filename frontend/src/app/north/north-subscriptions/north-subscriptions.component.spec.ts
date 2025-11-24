import { TestBed } from '@angular/core/testing';

import { NorthSubscriptionsComponent } from './north-subscriptions.component';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { NorthConnectorService } from '../../services/north-connector.service';
import { SouthConnectorService } from '../../services/south-connector.service';
import { Component } from '@angular/core';
import { NorthConnectorDTO } from '../../../../../backend/shared/model/north-connector.model';
import { of } from 'rxjs';
import { NotificationService } from '../../shared/notification.service';

@Component({
  selector: 'test-north-subscriptions-component',
  template: ` <oib-north-subscriptions [northConnector]="northConnector" />`,
  imports: [NorthSubscriptionsComponent]
})
class TestComponent {
  northConnector: NorthConnectorDTO = {
    id: 'northId',
    name: 'North Connector',
    subscriptions: [
      {
        id: 'southId1',
        type: 'folder-scanner',
        name: 'my South',
        enabled: true,
        description: ''
      },
      {
        id: 'southId2',
        type: 'folder-scanner',
        name: 'another South',
        enabled: true,
        description: ''
      }
    ]
  } as NorthConnectorDTO;
}

class NorthSubscriptionsComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get title() {
    return this.element('#title')!;
  }

  get subscriptions() {
    return this.elements('tbody tr');
  }
}

describe('NorthSubscriptionsComponent', () => {
  let tester: NorthSubscriptionsComponentTester;
  let northService: jasmine.SpyObj<NorthConnectorService>;
  let southService: jasmine.SpyObj<SouthConnectorService>;
  let notificationService: jasmine.SpyObj<NotificationService>;

  beforeEach(async () => {
    northService = createMock(NorthConnectorService);
    southService = createMock(SouthConnectorService);
    notificationService = createMock(NotificationService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: NorthConnectorService, useValue: northService },
        { provide: SouthConnectorService, useValue: southService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });

    southService.list.and.returnValue(of([]));

    tester = new NorthSubscriptionsComponentTester();
    await tester.change();
  });

  it('should display a list of subscriptions', () => {
    expect(tester.title).toContainText('Subscriptions');
    expect(tester.subscriptions.length).toEqual(2);
    expect(tester.subscriptions[0].elements('td').length).toEqual(2);
    expect(tester.subscriptions[0].elements('td')[0]).toContainText('my South');
    expect(tester.subscriptions[1].elements('td')[0]).toContainText('another South');
  });
});
