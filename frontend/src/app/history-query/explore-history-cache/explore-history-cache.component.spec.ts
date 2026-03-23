import { ExploreHistoryCacheComponent } from './explore-history-cache.component';
import { ComponentTester, createMock, stubRoute } from 'ngx-speculoos';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { NorthSettings } from '../../../../../backend/shared/model/north-settings.model';
import { HistoryQueryService } from '../../services/history-query.service';
import { HistoryQueryDTO } from '../../../../../backend/shared/model/history-query.model';
import { SouthSettings } from '../../../../../backend/shared/model/south-settings.model';
import testData from '../../../../../backend/src/tests/utils/test-data';
import { CacheSearchResult } from '../../../../../backend/shared/model/engine.model';

class ExploreHistoryCacheComponentTester extends ComponentTester<ExploreHistoryCacheComponent> {
  constructor() {
    super(ExploreHistoryCacheComponent);
  }

  get title() {
    return this.element('#title')!;
  }

  get cacheContent() {
    return this.element('#cache')!;
  }

  get errorContent() {
    return this.element('#error')!;
  }

  get archiveContent() {
    return this.element('#archive')!;
  }
}

describe('ExploreHistoryCacheComponent', () => {
  let tester: ExploreHistoryCacheComponentTester;
  let historyQueryService: jasmine.SpyObj<HistoryQueryService>;

  const historyQuery: HistoryQueryDTO = {
    id: 'id1',
    status: 'PAUSED',
    southType: 'opcua',
    northType: 'file-writer',
    queryTimeRange: {
      startTime: testData.constants.dates.DATE_1,
      endTime: testData.constants.dates.DATE_2,
      maxReadInterval: 3600,
      readDelay: 200
    },
    name: 'History query 1',
    description: 'My history query description',
    enabled: true,
    caching: {
      trigger: {
        scanMode: { id: 'scanModeId1', name: 'scan mode', description: '', cron: '* * * *' },
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
    northSettings: {} as NorthSettings,
    southSettings: {} as SouthSettings,
    items: [],
    northTransformers: []
  } as HistoryQueryDTO;
  const cacheSearchResult: CacheSearchResult = {
    searchDate: testData.constants.dates.DATE_3,
    metrics: {
      lastConnection: null,
      lastRunStart: null,
      lastRunDuration: 0,
      currentCacheSize: 0,
      currentErrorSize: 0,
      currentArchiveSize: 0
    },
    error: [],
    archive: [],
    cache: []
  };

  beforeEach(async () => {
    historyQueryService = createMock(HistoryQueryService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: stubRoute({
            params: {
              historyQueryId: 'id1'
            }
          })
        },
        { provide: HistoryQueryService, useValue: historyQueryService }
      ]
    });
    historyQueryService.findById.and.returnValue(of(historyQuery));
    historyQueryService.searchCacheContent.and.returnValue(of(cacheSearchResult));
    tester = new ExploreHistoryCacheComponentTester();
    await tester.change();
  });

  it('should have a title, error and archive list components', () => {
    expect(tester.title).toContainText('Cache of History query 1');
    expect(tester.cacheContent).toBeDefined();
    expect(tester.errorContent).toBeDefined();
    expect(tester.archiveContent).toBeDefined();
  });
});
