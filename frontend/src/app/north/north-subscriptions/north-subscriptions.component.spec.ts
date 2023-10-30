import { TestBed } from '@angular/core/testing';

import { NorthSubscriptionsComponent } from './north-subscriptions.component';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { of } from 'rxjs';
import { NorthConnectorService } from '../../services/north-connector.service';
import { SouthConnectorService } from '../../services/south-connector.service';
import { SouthConnectorDTO } from '../../../../../shared/model/south-connector.model';
import { SubscriptionDTO } from '../../../../../shared/model/subscription.model';
import { Component } from '@angular/core';
import { NorthConnectorDTO } from '../../../../../shared/model/north-connector.model';
import { ExternalSourceService } from '../../services/external-source.service';

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
    return this.element('#title')!;
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
  let externalSourceService: jasmine.SpyObj<ExternalSourceService>;

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
    externalSourceService = createMock(ExternalSourceService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: NorthConnectorService, useValue: northService },
        { provide: SouthConnectorService, useValue: southService },
        { provide: ExternalSourceService, useValue: externalSourceService }
      ]
    });

    southService.list.and.returnValue(of(southConnectors));
    externalSourceService.list.and.returnValue(of([]));
    northService.getSubscriptions.and.returnValue(of(northSubscriptions));
    northService.getExternalSubscriptions.and.returnValue(of([]));

    tester = new NorthSubscriptionsComponentTester();
  });

  it('should display a list of subscriptions', () => {
    tester.detectChanges();

    expect(tester.title).toContainText('Subscriptions');
    expect(tester.subscriptions.length).toEqual(2);
    expect(tester.subscriptions[0].elements('td').length).toEqual(3);
    expect(tester.subscriptions[0].elements('td')[0]).toContainText('South connector');
    expect(tester.subscriptions[0].elements('td')[1]).toContainText('south1');
    expect(tester.subscriptions[1].elements('td')[0]).toContainText('South connector');
    expect(tester.subscriptions[1].elements('td')[1]).toContainText('south2');
  });

  it('should display an empty list', () => {
    northService.getSubscriptions.and.returnValue(of([]));
    tester.detectChanges();

    expect(tester.title).toContainText('Subscriptions');
    expect(tester.noSubscriptions).toContainText('No subscription set. The connector receives data from all data sources.');
  });
});
