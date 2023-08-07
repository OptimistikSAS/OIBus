import { TestBed } from '@angular/core/testing';

import { HistoryQueryListComponent } from './history-query-list.component';
import { ComponentTester, createMock, TestButton } from 'ngx-speculoos';
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
    historyQueryService.stopHistoryQuery.and.returnValue(of(undefined));

    tester = new HistoryQueryListComponentTester();
    tester.detectChanges();
  });

  it('should display title', () => {
    expect(tester.title).toContainText('History queries');
    expect(tester.historyQueryList.length).toBe(2);
    expect(tester.historyQueryList[0].elements('td')[1]).toContainText(historyQueries[0].name);
    expect(tester.historyQueryList[0].elements('td')[2]).toContainText(historyQueries[0].description);
    expect(tester.historyQueryList[0].elements('td')[3].elements('button').length).toBe(2);
    expect(tester.historyQueryList[0].elements('td')[3].elements('a').length).toBe(2);
    expect(tester.historyQueryList[1].elements('td')[1]).toContainText(historyQueries[1].name);
    expect(tester.historyQueryList[1].elements('td')[2]).toContainText(historyQueries[1].description);
    expect(tester.historyQueryList[1].elements('td')[3].elements('button').length).toBe(2);
    expect(tester.historyQueryList[1].elements('td')[3].elements('a').length).toBe(2);
  });

  it('should toggle history query', () => {
    const toggle1 = tester.historyQueryList[0].elements('td')[0].elements('.form-check-input')[0] as TestButton;
    toggle1.click();
    expect(historyQueryService.stopHistoryQuery).toHaveBeenCalledWith('id1');
    expect(notificationService.success).toHaveBeenCalledWith('history-query.stopped', { name: historyQueries[0].name });

    const toggle2 = tester.historyQueryList[1].elements('td')[0].elements('.form-check-input')[0] as TestButton;
    toggle2.click();
    expect(historyQueryService.startHistoryQuery).toHaveBeenCalledWith('id2');
    expect(notificationService.success).toHaveBeenCalledWith('history-query.started', { name: historyQueries[1].name });
  });
});
