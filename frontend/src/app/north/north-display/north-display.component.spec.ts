import { TestBed } from '@angular/core/testing';

import { NorthDisplayComponent } from './north-display.component';
import { ComponentTester, createMock, stubRoute } from 'ngx-speculoos';
import { of } from 'rxjs';
import { provideHttpClient } from '@angular/common/http';
import { provideTestingI18n } from '../../../i18n/mock-i18n';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { NorthConnectorService } from '../../services/north-connector.service';
import { NorthConnectorDTO } from '../../../../../shared/model/north-connector.model';

class NorthDisplayComponentTester extends ComponentTester<NorthDisplayComponent> {
  constructor() {
    super(NorthDisplayComponent);
  }

  get title() {
    return this.element('#title');
  }

  get description() {
    return this.element('#description');
  }
}

describe('NorthDisplayComponent', () => {
  let tester: NorthDisplayComponentTester;
  let northConnectorService: jasmine.SpyObj<NorthConnectorService>;

  const northConnector: NorthConnectorDTO = {
    id: 'id1',
    type: 'Generic',
    name: 'North Connector',
    description: 'My North connector description',
    enabled: true,
    settings: {},
    caching: {
      scanModeId: 'scanModeId1',
      retryInterval: 1000,
      retryCount: 3,
      groupCount: 1000,
      maxSendCount: 10000,
      timeout: 30
    },
    archive: {
      enabled: false,
      retentionDuration: 0
    }
  };

  beforeEach(() => {
    northConnectorService = createMock(NorthConnectorService);
    TestBed.configureTestingModule({
      imports: [NorthDisplayComponent],
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
    tester = new NorthDisplayComponentTester();
    tester.detectChanges();
  });

  it('should display North connector description', () => {
    expect(tester.title).toContainText(northConnector.name);
    expect(tester.description).toContainText(northConnector.description);
  });
});
