import { ExploreCacheComponent } from './explore-cache.component';
import { ComponentTester, createMock, stubRoute } from 'ngx-speculoos';
import { TestBed } from '@angular/core/testing';
import { NorthConnectorService } from '../../services/north-connector.service';
import { of } from 'rxjs';
import { NorthConnectorDTO } from '../../../../../backend/shared/model/north-connector.model';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { provideHttpClient } from '@angular/common/http';
import { NorthSettings } from '../../../../../backend/shared/model/north-settings.model';

class ExploreCacheComponentTester extends ComponentTester<ExploreCacheComponent> {
  constructor() {
    super(ExploreCacheComponent);
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

describe('ExploreCacheComponent', () => {
  let tester: ExploreCacheComponentTester;
  let northConnectorService: jasmine.SpyObj<NorthConnectorService>;

  const northConnector: NorthConnectorDTO<NorthSettings> = {
    id: 'id1',
    type: 'file-writer',
    name: 'North Connector',
    description: 'My North connector description',
    enabled: true,
    caching: {
      scanModeId: 'scanModeId1',
      retryInterval: 1000,
      retryCount: 3,
      maxSize: 30,
      oibusTimeValues: {
        groupCount: 1000,
        maxSendCount: 10000
      }
    }
  } as NorthConnectorDTO<NorthSettings>;

  beforeEach(() => {
    northConnectorService = createMock(NorthConnectorService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideRouter([]),
        provideHttpClient(),
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
    northConnectorService.get.and.returnValue(of(northConnector));
    northConnectorService.searchCacheContent.and.returnValue(of([]));
    tester = new ExploreCacheComponentTester();
    tester.detectChanges();
  });

  it('should have a title, error and archive list components', () => {
    expect(tester.title).toContainText('Cache content for connector North Connector');
    expect(tester.cacheContent).toBeDefined();
    expect(tester.errorContent).toBeDefined();
    expect(tester.archiveContent).toBeDefined();
  });
});
