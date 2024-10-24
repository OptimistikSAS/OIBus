import { TestBed } from '@angular/core/testing';

import { ComponentTester } from 'ngx-speculoos';
import { SouthMetricsComponent } from './south-metrics.component';
import { Component } from '@angular/core';
import { SouthConnectorLightDTO, SouthConnectorManifest } from '../../../../../backend/shared/model/south-connector.model';
import { NotificationService } from '../../shared/notification.service';
import { SouthConnectorService } from '../../services/south-connector.service';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { SouthConnectorMetrics } from '../../../../../backend/shared/model/engine.model';
import { provideHttpClient } from '@angular/common/http';

@Component({
  template: `<oib-south-metrics [connectorMetrics]="metrics" [southConnector]="southConnector" [manifest]="manifest" />`,
  standalone: true,
  imports: [SouthMetricsComponent]
})
class TestComponent {
  metrics: SouthConnectorMetrics = {
    metricsStart: '2020-02-02T00:00:00.000Z',
    lastConnection: '2020-02-02T00:00:00.000Z',
    lastRunStart: '2020-02-02T00:00:00.000Z',
    lastRunDuration: 10,
    numberOfValuesRetrieved: 11,
    numberOfFilesRetrieved: 12,
    lastValueRetrieved: { pointId: 'pointId', timestamp: '2020-02-02T00:00:00.000Z', data: { value: '13' } },
    lastFileRetrieved: 'file'
  };
  southConnector: SouthConnectorLightDTO = {
    id: 'southId',
    name: 'South Connector'
  } as SouthConnectorLightDTO;

  manifest: SouthConnectorManifest = {
    id: 'mssql',
    category: 'database',
    name: 'SQL',
    description: 'SQL',
    settings: [],
    items: {
      scanMode: {
        acceptSubscription: false,
        subscriptionOnly: false
      },
      settings: [
        {
          label: 'query',
          key: 'query',
          displayInViewMode: true,
          type: 'OibText'
        }
      ]
    },
    modes: {
      subscription: false,
      history: true,
      lastFile: true,
      lastPoint: false
    }
  };
}

class SouthDataComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get title() {
    return this.element('#title')!;
  }
}

describe('SouthMetricsComponent', () => {
  let tester: SouthDataComponentTester;
  let southConnectorService: jasmine.SpyObj<SouthConnectorService>;
  let notificationService: jasmine.SpyObj<NotificationService>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideHttpClient(),
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });

    tester = new SouthDataComponentTester();
  });

  it('should have a title', () => {
    tester.detectChanges();
    expect(tester.title).toContainText('South Connector metrics');
  });
});
