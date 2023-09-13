import { TestBed } from '@angular/core/testing';

import { ComponentTester, createMock } from 'ngx-speculoos';
import { NorthMetricsComponent } from './north-metrics.component';
import { Component } from '@angular/core';
import { NorthConnectorDTO, NorthConnectorManifest } from '../../../../../shared/model/north-connector.model';
import { NorthConnectorService } from '../../services/north-connector.service';
import { NotificationService } from '../../shared/notification.service';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { NorthConnectorMetrics } from '../../../../../shared/model/engine.model';
import { provideHttpClient } from '@angular/common/http';

@Component({
  template: `<oib-north-metrics [connectorMetrics]="metrics" [northConnector]="northConnector" [manifest]="manifest"></oib-north-metrics>`,
  standalone: true,
  imports: [NorthMetricsComponent]
})
class TestComponent {
  metrics: NorthConnectorMetrics = {
    metricsStart: '2020-02-02T00:00:00.000Z',
    lastConnection: '2020-02-02T00:00:00.000Z',
    lastRunStart: '2020-02-02T00:00:00.000Z',
    lastRunDuration: 10,
    numberOfValuesSent: 11,
    numberOfFilesSent: 12,
    lastValueSent: { pointId: 'pointId', timestamp: '2020-02-02T00:00:00.000Z', data: { value: '13' } },
    lastFileSent: 'file',
    cacheSize: 14
  };
  northConnector: NorthConnectorDTO = {
    id: 'northId',
    name: 'North Connector'
  } as NorthConnectorDTO;
  manifest: NorthConnectorManifest = {
    id: 'oianalytics',
    name: 'OIAnalytics',
    category: 'api',
    description: 'OIAnalytics description',
    modes: {
      files: true,
      points: true
    },
    settings: [
      {
        key: 'host',
        type: 'OibText',
        label: 'Host',
        validators: [
          { key: 'required' },
          {
            key: 'pattern',
            params: { pattern: '^(http:\\/\\/|https:\\/\\/|HTTP:\\/\\/|HTTPS:\\/\\/).*' }
          }
        ],
        displayInViewMode: true
      }
    ]
  };
}

class NorthMetricsComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get title() {
    return this.element('#title')!;
  }
}

describe('NorthMetricsComponent', () => {
  let tester: NorthMetricsComponentTester;
  let northConnectorService: jasmine.SpyObj<NorthConnectorService>;
  let notificationService: jasmine.SpyObj<NotificationService>;

  beforeEach(async () => {
    northConnectorService = createMock(NorthConnectorService);
    notificationService = createMock(NotificationService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideHttpClient(),
        { provide: NorthConnectorService, useValue: northConnectorService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });

    tester = new NorthMetricsComponentTester();
  });

  it('should display a title', () => {
    tester.detectChanges();
    expect(tester.title).toContainText('North Connector metrics');
  });
});
