import { ExploreNorthCacheComponent } from './explore-north-cache.component';
import { ComponentTester, createMock, stubRoute } from 'ngx-speculoos';
import { TestBed } from '@angular/core/testing';
import { NorthConnectorService } from '../../services/north-connector.service';
import { of } from 'rxjs';
import { NorthConnectorDTO } from '../../../../../backend/shared/model/north-connector.model';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import testData from '../../../../../backend/src/tests/utils/test-data';
import { CacheSearchResult } from '../../../../../backend/shared/model/engine.model';

class ExploreNorthCacheComponentTester extends ComponentTester<ExploreNorthCacheComponent> {
  constructor() {
    super(ExploreNorthCacheComponent);
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

describe('ExploreNorthCacheComponent', () => {
  let tester: ExploreNorthCacheComponentTester;
  let northConnectorService: jasmine.SpyObj<NorthConnectorService>;

  const northConnector: NorthConnectorDTO = {
    id: 'id1',
    type: 'file-writer',
    name: 'North Connector',
    description: 'My North connector description',
    enabled: true,
    caching: {
      trigger: {
        scanMode: testData.scanMode.list[0],
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
    }
  } as NorthConnectorDTO;
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
    northConnectorService = createMock(NorthConnectorService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: stubRoute({
            params: {
              northId: 'id1'
            }
          })
        },
        { provide: NorthConnectorService, useValue: northConnectorService }
      ]
    });
    northConnectorService.findById.and.returnValue(of(northConnector));
    northConnectorService.searchCacheContent.and.returnValue(of(cacheSearchResult));
    tester = new ExploreNorthCacheComponentTester();
    await tester.change();
  });

  it('should have a title, error and archive list components', () => {
    expect(tester.title).toContainText('Cache of North Connector');
    expect(tester.cacheContent).toBeDefined();
    expect(tester.errorContent).toBeDefined();
    expect(tester.archiveContent).toBeDefined();
  });
});
