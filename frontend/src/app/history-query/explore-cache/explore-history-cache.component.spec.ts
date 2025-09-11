import { ExploreHistoryCacheComponent } from './explore-history-cache.component';
import { ComponentTester, createMock, stubRoute } from 'ngx-speculoos';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { provideHttpClient } from '@angular/common/http';
import { NorthSettings } from '../../../../../backend/shared/model/north-settings.model';
import { HistoryQueryService } from '../../services/history-query.service';
import { HistoryQueryDTO } from '../../../../../backend/shared/model/history-query.model';
import { SouthItemSettings, SouthSettings } from '../../../../../backend/shared/model/south-settings.model';
import testData from '../../../../../backend/src/tests/utils/test-data';

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

  const historyQuery: HistoryQueryDTO<SouthSettings, NorthSettings, SouthItemSettings> = {
    id: 'id1',
    status: 'PAUSED',
    southType: 'opcua',
    northType: 'file-writer',
    startTime: testData.constants.dates.DATE_1,
    endTime: testData.constants.dates.DATE_2,
    name: 'North Connector',
    description: 'My North connector description',
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
  } as HistoryQueryDTO<SouthSettings, NorthSettings, SouthItemSettings>;

  beforeEach(() => {
    historyQueryService = createMock(HistoryQueryService);

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
        { provide: HistoryQueryService, useValue: historyQueryService }
      ]
    });
    historyQueryService.get.and.returnValue(of(historyQuery));
    historyQueryService.searchCacheContent.and.returnValue(of([]));
    tester = new ExploreHistoryCacheComponentTester();
    tester.detectChanges();
  });

  it('should have a title, error and archive list components', () => {
    expect(tester.title).toContainText('Cache content for connector North Connector');
    expect(tester.cacheContent).toBeDefined();
    expect(tester.errorContent).toBeDefined();
    expect(tester.archiveContent).toBeDefined();
  });
});
