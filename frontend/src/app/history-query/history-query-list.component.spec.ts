import { TestBed } from '@angular/core/testing';

import { HistoryQueryListComponent } from './history-query-list.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { provideI18nTesting } from '../../i18n/mock-i18n';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { HistoryQueryDTO } from '../../../../shared/model/history-query.model';
import { HistoryQueryService } from '../services/history-query.service';
import { NotificationService } from '../shared/notification.service';

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
  let notificationService: jasmine.SpyObj<NotificationService>;

  const historyQueries: Array<HistoryQueryDTO> = [
    {
      id: 'id1',
      name: 'myHistoryQuery1',
      description: 'a test history query',
      status: 'RUNNING',
      startTime: '2020-02-02T02:02:02.222Z',
      endTime: '2022-02-02T02:02:02.222Z'
    } as HistoryQueryDTO,
    {
      id: 'id2',
      name: 'myHistoryQuery2',
      description: 'a test history query',
      status: 'PENDING',
      startTime: '2020-02-02T02:02:02.222Z',
      endTime: '2022-02-02T02:02:02.222Z'
    } as HistoryQueryDTO
  ];

  beforeEach(() => {
    historyQueryService = createMock(HistoryQueryService);
    notificationService = createMock(NotificationService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideRouter([]),
        provideHttpClient(),
        { provide: HistoryQueryService, useValue: historyQueryService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });

    historyQueryService.list.and.returnValue(of(historyQueries));
    historyQueryService.startHistoryQuery.and.returnValue(of(undefined));
    historyQueryService.pauseHistoryQuery.and.returnValue(of(undefined));

    tester = new HistoryQueryListComponentTester();
    tester.detectChanges();
  });

  it('should display title', () => {
    expect(tester.title).toContainText('History queries');
    expect(tester.historyQueryList.length).toBe(2);
    expect(tester.historyQueryList[0].elements('td')[1]).toContainText(historyQueries[0].name);
    expect(tester.historyQueryList[0].elements('td')[2]).toContainText('2 Feb 2020, 03:02 -> 2 Feb 2022, 03:02');
    expect(tester.historyQueryList[0].elements('td')[3]).toContainText(historyQueries[0].description);
    expect(tester.historyQueryList[0].elements('td')[4].elements('button').length).toBe(2);
    expect(tester.historyQueryList[0].elements('td')[4].elements('a').length).toBe(2);
    expect(tester.historyQueryList[1].elements('td')[1]).toContainText(historyQueries[1].name);
    expect(tester.historyQueryList[1].elements('td')[2]).toContainText('2 Feb 2020, 03:02 -> 2 Feb 2022, 03:02');
    expect(tester.historyQueryList[1].elements('td')[3]).toContainText(historyQueries[1].description);
    expect(tester.historyQueryList[1].elements('td')[4].elements('button').length).toBe(2);
    expect(tester.historyQueryList[1].elements('td')[4].elements('a').length).toBe(2);
  });
});
