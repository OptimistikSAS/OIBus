import { TestBed } from '@angular/core/testing';

import { HistoryQueryListComponent } from './history-query-list.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { provideTestingI18n } from '../../i18n/mock-i18n';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { HistoryQueryDTO } from '../../../../shared/model/history-query.model';
import { HistoryQueryService } from '../services/history-query.service';

class HistoryQueryListComponentTester extends ComponentTester<HistoryQueryListComponent> {
  constructor() {
    super(HistoryQueryListComponent);
  }

  get title() {
    return this.element('h1');
  }

  get historyQueryList() {
    return this.elements('tbody tr');
  }
}
describe('HistoryQueryListComponent', () => {
  let tester: HistoryQueryListComponentTester;
  let historyQueryService: jasmine.SpyObj<HistoryQueryService>;

  const historyQueries: Array<HistoryQueryDTO> = [
    {
      id: 'id1',
      name: 'myHistoryQuery1',
      description: 'a test history query',
      enabled: true
    } as HistoryQueryDTO,
    {
      id: 'id2',
      name: 'myHistoryQuery2',
      description: 'a test history query',
      enabled: false
    } as HistoryQueryDTO
  ];

  beforeEach(() => {
    historyQueryService = createMock(HistoryQueryService);

    TestBed.configureTestingModule({
      imports: [HistoryQueryListComponent],
      providers: [
        provideTestingI18n(),
        provideRouter([]),
        provideHttpClient(),
        { provide: HistoryQueryService, useValue: historyQueryService }
      ]
    });

    historyQueryService.getHistoryQueries.and.returnValue(of(historyQueries));

    tester = new HistoryQueryListComponentTester();
    tester.detectChanges();
  });

  it('should display title', () => {
    expect(tester.title).toContainText('History query list');
    expect(tester.historyQueryList.length).toBe(2);
    expect(tester.historyQueryList[0].elements('td')[0]).toContainText(historyQueries[0].name);
    expect(tester.historyQueryList[0].elements('td')[1]).toContainText(historyQueries[0].description);
    expect(tester.historyQueryList[0].elements('td')[2].elements('button').length).toBe(4);
    expect(tester.historyQueryList[1].elements('td')[0]).toContainText(historyQueries[1].name);
    expect(tester.historyQueryList[1].elements('td')[1]).toContainText(historyQueries[1].description);
    expect(tester.historyQueryList[1].elements('td')[2].elements('button').length).toBe(4);
  });
});
