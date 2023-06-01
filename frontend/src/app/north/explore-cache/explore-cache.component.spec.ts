import { ExploreCacheComponent } from './explore-cache.component';
import { ComponentTester, createMock, stubRoute } from 'ngx-speculoos';
import { TestBed } from '@angular/core/testing';
import { NorthConnectorService } from '../../services/north-connector.service';
import { of } from 'rxjs';
import { NorthConnectorDTO } from '../../../../../shared/model/north-connector.model';
import { By } from '@angular/platform-browser';
import { ErrorFilesComponent } from './error-files/error-files.component';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideTestingI18n } from '../../../i18n/mock-i18n';
import { provideHttpClient } from '@angular/common/http';

class ExploreCacheComponentTester extends ComponentTester<ExploreCacheComponent> {
  constructor() {
    super(ExploreCacheComponent);
  }

  get title() {
    return this.element('#title')!;
  }

  get errorFiles(): ErrorFilesComponent {
    return this.debugElement.query(By.directive(ErrorFilesComponent)).componentInstance! as ErrorFilesComponent;
  }
}

describe('ExploreCacheComponent', () => {
  let tester: ExploreCacheComponentTester;
  let northConnectorService: jasmine.SpyObj<NorthConnectorService>;

  const northConnector: NorthConnectorDTO = {
    id: 'id1',
    type: 'Generic',
    name: 'North Connector',
    description: 'My North connector description',
    enabled: true,
    caching: {
      scanModeId: 'scanModeId1',
      retryInterval: 1000,
      retryCount: 3,
      groupCount: 1000,
      maxSendCount: 10000,
      maxSize: 30
    }
  } as NorthConnectorDTO;

  beforeEach(() => {
    northConnectorService = createMock(NorthConnectorService);

    TestBed.configureTestingModule({
      imports: [ExploreCacheComponent, ErrorFilesComponent],
      providers: [
        provideTestingI18n(),
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
    northConnectorService.getNorthConnector.and.returnValue(of(northConnector));
    northConnectorService.getNorthConnectorCacheErrorFiles.and.returnValue(of([]));
    tester = new ExploreCacheComponentTester();
    tester.detectChanges();
  });

  it('should have a title and error list component', () => {
    expect(tester.title).toContainText('Cache content for connector North Connector');
    expect(tester.errorFiles).toBeDefined();
  });
});
