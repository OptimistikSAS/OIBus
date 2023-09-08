import { TestBed } from '@angular/core/testing';

import { ComponentTester } from 'ngx-speculoos';
import { HistoryMetricsComponent } from './history-metrics.component';
import { Component } from '@angular/core';
import { NorthConnectorManifest } from '../../../../../../shared/model/north-connector.model';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { SouthConnectorManifest } from '../../../../../../shared/model/south-connector.model';
import { HistoryQueryDTO } from '../../../../../../shared/model/history-query.model';
import { HistoryMetrics } from '../../../../../../shared/model/engine.model';
import { provideHttpClient } from '@angular/common/http';

@Component({
  template: `<oib-history-metrics
    [historyMetrics]="historyMetrics"
    [historyQuery]="historyQuery"
    [northManifest]="northManifest"
    [southManifest]="southManifest"
  ></oib-history-metrics>`,
  standalone: true,
  imports: [HistoryMetricsComponent]
})
class TestComponent {
  southManifest: SouthConnectorManifest = {
    id: 'mssql',
    category: 'database',
    name: 'SQL',
    description: 'SQL',
    settings: [
      {
        key: 'database',
        type: 'OibText',
        label: 'Database',
        validators: [{ key: 'required' }],
        displayInViewMode: true
      }
    ],
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
      lastPoint: false,
      forceMaxInstantPerItem: false
    }
  };
  northManifest: NorthConnectorManifest = {
    id: 'oianalytics',
    name: 'OIAnalytics',
    category: 'api',
    description: 'OIAnalytics description',
    modes: {
      files: true,
      points: true,
      items: false
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

  historyQuery: HistoryQueryDTO = {
    id: 'id1',
    name: 'History query',
    description: 'My History query description',
    status: 'RUNNING',
    history: {
      maxInstantPerItem: false,
      maxReadInterval: 0,
      readDelay: 200,
      overlap: 0
    },
    southType: 'OPCUA_HA',
    northType: 'OIConnect',
    startTime: '2023-01-01T00:00:00.000Z',
    endTime: '2023-01-01T00:00:00.000Z',
    southSettings: {
      database: 'my database'
    },
    southSharedConnection: false,
    northSettings: {
      host: 'localhost'
    },
    caching: {
      scanModeId: 'scanModeId1',
      retryInterval: 1000,
      retryCount: 3,
      groupCount: 1000,
      maxSendCount: 10000,
      sendFileImmediately: true,
      maxSize: 30
    },
    archive: {
      enabled: false,
      retentionDuration: 0
    }
  };
  historyMetrics: HistoryMetrics = {
    north: {
      numberOfValuesSent: 10,
      numberOfFilesSent: 0,
      lastValueSent: null,
      lastFileSent: null,
      cacheSize: 0,
      metricsStart: '2023-01-01T00:00:00.000Z',
      lastConnection: null,
      lastRunStart: null,
      lastRunDuration: null
    },
    south: {
      numberOfValuesRetrieved: 20,
      numberOfFilesRetrieved: 0,
      lastValueRetrieved: null,
      lastFileRetrieved: null,
      historyMetrics: {
        intervalProgress: 1
      }
    }
  } as HistoryMetrics;
}

class HistoryMetricsComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get title() {
    return this.element('#title')!;
  }
}

describe('HistoryMetricsComponent', () => {
  let tester: HistoryMetricsComponentTester;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), provideHttpClient()]
    });

    tester = new HistoryMetricsComponentTester();
  });

  it('should display a title', () => {
    tester.detectChanges();
    expect(tester.title).toContainText('metrics');
  });
});
