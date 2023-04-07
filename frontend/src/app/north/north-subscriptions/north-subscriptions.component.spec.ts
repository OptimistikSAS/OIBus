import { TestBed } from '@angular/core/testing';

import { NorthSubscriptionsComponent } from './north-subscriptions.component';
import { provideTestingI18n } from '../../../i18n/mock-i18n';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { of } from 'rxjs';
import { NorthConnectorService } from '../../services/north-connector.service';
import { SouthConnectorService } from '../../services/south-connector.service';
import { SouthConnectorDTO } from '../../../../../shared/model/south-connector.model';
import { SubscriptionDTO } from '../../../../../shared/model/subscription.model';
import { Component } from '@angular/core';
import { NorthConnectorDTO } from '../../../../../shared/model/north-connector.model';

@Component({
  template: `<oib-north-subscriptions [northConnector]="northConnector"></oib-north-subscriptions>`,
  standalone: true,
  imports: [NorthSubscriptionsComponent]
})
class TestComponent {
  northConnector: NorthConnectorDTO = {
    id: 'northId',
    name: 'North Connector'
  } as NorthConnectorDTO;
}

class NorthSubscriptionsComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get title() {
    return this.element('h2')!;
  }

  get addSubscription() {
    return this.button('#add-subscription')!;
  }

  get noSubscriptions() {
    return this.element('#no-subscription');
  }
  get subscriptions() {
    return this.elements('tbody tr');
  }
}

describe('NorthSubscriptionsComponent', () => {
  let tester: NorthSubscriptionsComponentTester;
  let northService: jasmine.SpyObj<NorthConnectorService>;
  let southService: jasmine.SpyObj<SouthConnectorService>;

  const southConnectors: Array<SouthConnectorDTO> = [
    {
      id: 'id1',
      name: 'south1'
    } as SouthConnectorDTO,
    {
      id: 'id2',
      name: 'south2'
    } as SouthConnectorDTO
  ];

  const northSubscriptions: Array<SubscriptionDTO> = ['id1', 'id2'];

  beforeEach(() => {
    northService = createMock(NorthConnectorService);
    southService = createMock(SouthConnectorService);

    TestBed.configureTestingModule({
      imports: [TestComponent],
      providers: [
        provideTestingI18n(),
        { provide: NorthConnectorService, useValue: northService },
        { provide: SouthConnectorService, useValue: southService }
      ]
    });

    southService.getSouthConnectors.and.returnValue(of(southConnectors));
    northService.getNorthConnectorSubscriptions.and.returnValue(of(northSubscriptions));

    tester = new NorthSubscriptionsComponentTester();
  });

  it('should display a list of subscriptions', () => {
    tester.detectChanges();

    expect(tester.title).toContainText('Subscriptions');
    expect(tester.subscriptions.length).toEqual(2);
    expect(tester.subscriptions[0].elements('td').length).toEqual(2);
    expect(tester.subscriptions[0].elements('td')[0]).toContainText('south1');
    expect(tester.subscriptions[1].elements('td')[0]).toContainText('south2');
  });

  it('should display an empty list', () => {
    northService.getNorthConnectorSubscriptions.and.returnValue(of([]));
    tester.detectChanges();

    expect(tester.title).toContainText('Subscriptions');
    expect(tester.noSubscriptions).toContainText('No subscription set. The connector receives data from all south connectors.');
  });
});
