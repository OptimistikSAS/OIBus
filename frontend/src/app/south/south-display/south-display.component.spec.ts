import { TestBed } from '@angular/core/testing';

import { SouthDisplayComponent } from './south-display.component';
import { ComponentTester, createMock, stubRoute } from 'ngx-speculoos';
import { SouthConnectorService } from '../../services/south-connector.service';
import { SouthConnectorDTO } from '../../model/south-connector.model';
import { of } from 'rxjs';
import { provideHttpClient } from '@angular/common/http';
import { provideTestingI18n } from '../../../i18n/mock-i18n';
import { ActivatedRoute, provideRouter } from '@angular/router';

class SouthDisplayComponentTester extends ComponentTester<SouthDisplayComponent> {
  constructor() {
    super(SouthDisplayComponent);
  }

  get title() {
    return this.element('#title');
  }

  get description() {
    return this.element('#description');
  }
}

describe('SouthDisplayComponent', () => {
  let tester: SouthDisplayComponentTester;
  let southConnectorService: jasmine.SpyObj<SouthConnectorService>;

  const southConnector: SouthConnectorDTO = {
    id: 'id1',
    type: 'Generic',
    name: 'South Connector',
    description: 'My South connector description',
    enabled: true,
    settings: {}
  };

  beforeEach(() => {
    southConnectorService = createMock(SouthConnectorService);
    TestBed.configureTestingModule({
      imports: [SouthDisplayComponent],
      providers: [
        provideTestingI18n(),
        provideRouter([]),
        provideHttpClient(),
        {
          provide: ActivatedRoute,
          useValue: stubRoute({
            params: {
              southId: 'id1'
            }
          })
        },
        { provide: SouthConnectorService, useValue: southConnectorService }
      ]
    });

    southConnectorService.getSouthConnector.and.returnValue(of(southConnector));
    tester = new SouthDisplayComponentTester();
    tester.detectChanges();
  });

  it('should display South connector description', () => {
    expect(tester.title).toContainText(southConnector.name);
    expect(tester.description).toContainText(southConnector.description);
  });
});
