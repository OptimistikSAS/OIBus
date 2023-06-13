import { TestBed } from '@angular/core/testing';

import { HomeComponent } from './home.component';
import { provideI18nTesting } from '../../i18n/mock-i18n';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { provideRouter } from '@angular/router';
import { SouthConnectorService } from '../services/south-connector.service';
import { NorthConnectorService } from '../services/north-connector.service';
import { HistoryQueryService } from '../services/history-query.service';
import { of } from 'rxjs';
import { SouthConnectorDTO } from '../../../../shared/model/south-connector.model';
import { NorthConnectorDTO } from '../../../../shared/model/north-connector.model';

class HomeComponentTester extends ComponentTester<HomeComponent> {
  constructor() {
    super(HomeComponent);
  }

  get souths() {
    return this.elements('tbody.south tr');
  }

  get norths() {
    return this.elements('tbody.north tr');
  }

  get historyQueries() {
    return this.elements('tbody.history-query tr');
  }
}

describe('HomeComponent', () => {
  let tester: HomeComponentTester;
  let southService: jasmine.SpyObj<SouthConnectorService>;
  let northService: jasmine.SpyObj<NorthConnectorService>;
  let historyQueryService: jasmine.SpyObj<HistoryQueryService>;

  beforeEach(() => {
    southService = createMock(SouthConnectorService);
    northService = createMock(NorthConnectorService);
    historyQueryService = createMock(HistoryQueryService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideRouter([]),
        { provide: SouthConnectorService, useValue: southService },
        { provide: NorthConnectorService, useValue: northService },
        { provide: HistoryQueryService, useValue: historyQueryService }
      ]
    });

    southService.list.and.returnValue(of([{ name: 'south1' }, { name: 'south2' }, { name: 'south3' }] as Array<SouthConnectorDTO>));

    northService.list.and.returnValue(of([{ name: 'north1' }, { name: 'north2' }] as Array<NorthConnectorDTO>));

    historyQueryService.list.and.returnValue(of([]));

    tester = new HomeComponentTester();
    tester.detectChanges();
  });

  it('should display souths', () => {
    expect(tester.souths.length).toBe(3);
    const first = tester.souths[0].elements('td')[0];
    expect(first).toContainText('south1');
  });

  it('should display norths', () => {
    expect(tester.norths.length).toBe(2);
    const first = tester.norths[0].elements('td')[0];
    expect(first).toContainText('north1');
  });

  it('should display history query', () => {
    expect(tester.historyQueries.length).toBe(0);
  });
});
