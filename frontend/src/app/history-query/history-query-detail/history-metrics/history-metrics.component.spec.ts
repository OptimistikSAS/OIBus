import { TestBed } from '@angular/core/testing';

import { ComponentTester } from 'ngx-speculoos';
import { HistoryMetricsComponent } from './history-metrics.component';
import { Component } from '@angular/core';
import { NorthConnectorManifest } from '../../../../../../backend/shared/model/north-connector.model';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { SouthConnectorManifest } from '../../../../../../backend/shared/model/south-connector.model';
import { HistoryQueryDTO } from '../../../../../../backend/shared/model/history-query.model';
import { HistoryQueryMetrics } from '../../../../../../backend/shared/model/engine.model';
import { provideHttpClient } from '@angular/common/http';
import { SouthItemSettings, SouthSettings } from '../../../../../../backend/shared/model/south-settings.model';
import { NorthSettings } from '../../../../../../backend/shared/model/north-settings.model';

@Component({
  template: `<oib-history-metrics
    [historyMetrics]="historyMetrics"
    [historyQuery]="historyQuery"
    [northManifest]="northManifest"
    [southManifest]="southManifest"
  />`,
  imports: [HistoryMetricsComponent]
})
class TestComponent {
  southManifest: SouthConnectorManifest = {
    id: 'mssql',
    category: 'database',
    settings: [
      {
        key: 'database',
        type: 'OibText',
        translationKey: 'Database',
        validators: [{ key: 'required' }],
        displayInViewMode: true
      }
    ],
    items: {
      scanMode: 'POLL',
      settings: [
        {
          translationKey: 'query',
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
  northManifest: NorthConnectorManifest = {
    id: 'oianalytics',
    category: 'api',
    modes: {
      files: true,
      points: true
    },
    settings: [
      {
        key: 'host',
        type: 'OibText',
        translationKey: 'Host',
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

  historyQuery: HistoryQueryDTO<SouthSettings, NorthSettings, SouthItemSettings> = {
    id: 'id1',
    name: 'History query',
    description: 'My History query description',
    status: 'RUNNING',
    southType: 'opcua',
    northType: 'console',
    startTime: '2023-01-01T00:00:00.000Z',
    endTime: '2023-01-01T00:00:00.000Z',
    southSettings: {
      database: 'my database'
    } as SouthSettings,
    northSettings: {
      host: 'localhost'
    } as NorthSettings,
    caching: {
      trigger: {
        scanModeId: 'scanModeId1',
        numberOfElements: 1_000,
        numberOfFiles: 1
      },
      throttling: {
        runMinDelay: 200,
        maxSize: 30,
        maxNumberOfElements: 10_000
      },
      error: {
        retryInterval: 1_000,
        retryCount: 3,
        retentionDuration: 24
      },
      archive: {
        enabled: false,
        retentionDuration: 0
      }
    },
    items: []
  };
  historyMetrics: HistoryQueryMetrics = {
    metricsStart: '2020-01-01T00:00:00.000Z',
    south: {
      lastConnection: null,
      lastRunStart: null,
      lastRunDuration: null,
      numberOfValuesRetrieved: 11,
      numberOfFilesRetrieved: 11,
      lastValueRetrieved: null,
      lastFileRetrieved: null
    },
    north: {
      lastConnection: null,
      lastRunStart: null,
      lastRunDuration: null,
      lastContentSent: null,
      contentCachedSize: 11,
      contentErroredSize: 22,
      contentArchivedSize: 33,
      contentSentSize: 44,
      currentCacheSize: 10,
      currentErrorSize: 9,
      currentArchiveSize: 8
    },
    historyMetrics: {
      running: false,
      intervalProgress: 0,
      currentIntervalStart: null,
      currentIntervalEnd: null,
      currentIntervalNumber: 0,
      numberOfIntervals: 0
    }
  };
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
