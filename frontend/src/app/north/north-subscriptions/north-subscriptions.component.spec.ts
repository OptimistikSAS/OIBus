import { TestBed } from '@angular/core/testing';

import { NorthSubscriptionsComponent } from './north-subscriptions.component';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { of } from 'rxjs';
import { NorthConnectorService } from '../../services/north-connector.service';
import { SouthConnectorService } from '../../services/south-connector.service';
import { SouthConnectorLightDTO } from '../../../../../backend/shared/model/south-connector.model';
import { Component } from '@angular/core';
import { NorthConnectorDTO } from '../../../../../backend/shared/model/north-connector.model';
import { NorthSettings } from '../../../../../backend/shared/model/north-settings.model';

@Component({
  template: `<oib-north-subscriptions [northConnector]="northConnector" />`,
  standalone: true,
  imports: [NorthSubscriptionsComponent]
})
class TestComponent {
  northConnector: NorthConnectorDTO<NorthSettings> = {
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
  } as NorthConnectorDTO<NorthSettings>;
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

  const southConnectors: Array<SouthConnectorLightDTO> = [
    {
      id: 'id1',
      name: 'south1'
    } as SouthConnectorLightDTO,
    {
      id: 'id2',
      name: 'south2'
    } as SouthConnectorLightDTO
  ];

  beforeEach(() => {
    northService = createMock(NorthConnectorService);
    southService = createMock(SouthConnectorService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: NorthConnectorService, useValue: northService },
        { provide: SouthConnectorService, useValue: southService }
      ]
    });

    southService.list.and.returnValue(of(southConnectors));

    tester = new NorthSubscriptionsComponentTester();
  });

  it('should display a list of subscriptions', () => {
    tester.detectChanges();

    expect(tester.title).toContainText('Subscriptions');
    expect(tester.subscriptions.length).toEqual(2);
    expect(tester.subscriptions[0].elements('td').length).toEqual(2);
    expect(tester.subscriptions[0].elements('td')[0]).toContainText('my South');
    expect(tester.subscriptions[1].elements('td')[0]).toContainText('another South');
  });
});
