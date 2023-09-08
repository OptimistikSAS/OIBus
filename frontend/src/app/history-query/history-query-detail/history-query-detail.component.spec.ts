import { TestBed } from '@angular/core/testing';

import { HistoryQueryDetailComponent } from './history-query-detail.component';
import { ComponentTester, createMock, stubRoute } from 'ngx-speculoos';
import { of } from 'rxjs';
import { provideHttpClient } from '@angular/common/http';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { HistoryQueryService } from '../../services/history-query.service';
import { HistoryQueryDTO } from '../../../../../shared/model/history-query.model';
import { SouthConnectorManifest } from '../../../../../shared/model/south-connector.model';
import { SouthConnectorService } from '../../services/south-connector.service';
import { NorthConnectorService } from '../../services/north-connector.service';
import { NorthConnectorManifest } from '../../../../../shared/model/north-connector.model';
import { ScanModeService } from '../../services/scan-mode.service';

class HistoryQueryDisplayComponentTester extends ComponentTester<HistoryQueryDetailComponent> {
  constructor() {
    super(HistoryQueryDetailComponent);
  }

  get title() {
    return this.element('#title');
  }

  get southSettings() {
    return this.elements('tbody.south-settings tr');
  }

  get northSettings() {
    return this.elements('tbody.north-settings tr');
  }

  get items() {
    return this.elements('tbody tr.south-item');
  }
}

describe('HistoryQueryDisplayComponent', () => {
  let tester: HistoryQueryDisplayComponentTester;
  let southConnectorService: jasmine.SpyObj<SouthConnectorService>;
  let northConnectorService: jasmine.SpyObj<NorthConnectorService>;
  let historyQueryService: jasmine.SpyObj<HistoryQueryService>;
  let scanModeService: jasmine.SpyObj<ScanModeService>;

  const southManifest: SouthConnectorManifest = {
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
  const northManifest: NorthConnectorManifest = {
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
  const historyQuery: HistoryQueryDTO = {
    id: 'id1',
    name: 'History query',
    description: 'My History query description',
    status: 'PENDING',
    history: {
      maxInstantPerItem: false,
      maxReadInterval: 0,
      readDelay: 200
    },
    southType: 'OPCUA_HA',
    northType: 'OIConnect',
    startTime: '2023-01-01T00:00:00.000Z',
    endTime: '2023-01-01T00:00:00.000Z',
    southSettings: {
      database: 'my database'
    },
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

  beforeEach(() => {
    southConnectorService = createMock(SouthConnectorService);
    northConnectorService = createMock(NorthConnectorService);
    historyQueryService = createMock(HistoryQueryService);
    scanModeService = createMock(ScanModeService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideRouter([]),
        provideHttpClient(),
        {
          provide: ActivatedRoute,
          useValue: stubRoute({
            params: {
              historyQueryId: 'id1'
            }
          })
        },
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: NorthConnectorService, useValue: northConnectorService },
        { provide: HistoryQueryService, useValue: historyQueryService },
        { provide: ScanModeService, useValue: scanModeService }
      ]
    });

    historyQueryService.get.and.returnValue(of(historyQuery));
    historyQueryService.startHistoryQuery.and.returnValue(of(undefined));
    historyQueryService.pauseHistoryQuery.and.returnValue(of(undefined));
    southConnectorService.getSouthConnectorTypeManifest.and.returnValue(of(southManifest));
    northConnectorService.getNorthConnectorTypeManifest.and.returnValue(of(northManifest));
    historyQueryService.listItems.and.returnValue(
      of([
        {
          id: 'id1',
          name: 'item1',
          enabled: true,
          connectorId: 'southId',
          scanModeId: 'scanModeId',
          settings: {
            query: 'sql'
          }
        }
      ])
    );
    scanModeService.list.and.returnValue(of([]));

    tester = new HistoryQueryDisplayComponentTester();
  });

  it('should display History query detail', () => {
    tester.detectChanges();
    expect(tester.title).toContainText(historyQuery.name);
    const southSettings = tester.southSettings;
    expect(southSettings.length).toBe(1);
    expect(southSettings[0]).toContainText('Database');
    expect(southSettings[0]).toContainText('my database');

    const northSettings = tester.northSettings;
    expect(northSettings.length).toBe(1);
    expect(northSettings[0]).toContainText('Host');
    expect(northSettings[0]).toContainText('localhost');
  });

  it('should display items', () => {
    tester.detectChanges();
    expect(tester.items.length).toBe(1);
    const item = tester.items[0];
    expect(item.elements('td')[1]).toContainText('item1');
    expect(item.elements('td')[2]).toContainText('sql');
  });
});
