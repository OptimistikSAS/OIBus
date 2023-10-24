import { discardPeriodicTasks, fakeAsync, TestBed, tick } from '@angular/core/testing';

import { LogsComponent } from './logs.component';
import { ComponentTester, createMock, stubRoute } from 'ngx-speculoos';
import { provideI18nTesting } from '../../i18n/mock-i18n';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { LogService } from '../services/log.service';
import { DEFAULT_TZ, Page } from '../../../../shared/model/types';
import { LogDTO } from '../../../../shared/model/logs.model';
import { of } from 'rxjs';
import { emptyPage, toPage } from '../shared/test-utils';
import { DateTime } from 'luxon';

class LogsComponentTester extends ComponentTester<LogsComponent> {
  constructor() {
    super(LogsComponent);
  }

  get emptyContainer() {
    return this.element('.empty');
  }

  get logs() {
    return this.elements('tbody tr');
  }
}
describe('LogsComponent', () => {
  let tester: LogsComponentTester;
  let logService: jasmine.SpyObj<LogService>;

  const emptyLogPage: Page<LogDTO> = emptyPage();
  const logPage: Page<LogDTO> = toPage([
    {
      timestamp: '2023-01-01T00:00:00.000Z',
      level: 'error',
      scopeType: 'data-stream',
      message: 'my log 1'
    },
    {
      timestamp: '2023-01-02T00:00:00.000Z',
      level: 'error',
      scopeType: 'south',
      scopeId: 'southId',
      scopeName: 'My South',
      message: 'my log 2'
    }
  ]);

  const route = stubRoute({
    queryParams: {
      start: DateTime.fromISO('2023-01-01T00:00', { zone: DEFAULT_TZ }).toUTC().toISO({ includeOffset: true }),
      end: DateTime.fromISO('2023-03-01T00:00', { zone: DEFAULT_TZ }).toUTC().toISO({ includeOffset: true }),
      levels: ['info', 'error'],
      page: '2'
    }
  });

  beforeEach(() => {
    logService = createMock(LogService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideRouter([]),
        provideHttpClient(),
        { provide: LogService, useValue: logService },
        { provide: ActivatedRoute, useValue: route }
      ]
    });

    tester = new LogsComponentTester();
  });

  it('should have empty page', () => {
    logService.searchLogs.and.returnValue(of(emptyLogPage));
    tester.detectChanges();

    expect(tester.emptyContainer).toContainText('No log found');
  });

  it('should have log page', fakeAsync(() => {
    logService.searchLogs.and.returnValue(of(logPage));
    tester.detectChanges();
    tick();
    tester.detectChanges();

    // Default timezone is Europe/Paris
    expect(logService.searchLogs).toHaveBeenCalledWith({
      messageContent: null,
      scopeTypes: [],
      scopeIds: [],
      start: '2022-12-31T23:00:00.000Z',
      end: '2023-02-28T23:00:00.000Z',
      levels: ['info', 'error'],
      page: 2
    });
    expect(tester.logs.length).toBe(2);

    expect(tester.logs[0].elements('td').length).toBe(5);
    expect(tester.logs[0].elements('td')[1]).toContainText('1 Jan 2023, 01:00:00');
    expect(tester.logs[0].elements('td')[2]).toContainText('Data stream engine');
    expect(tester.logs[0].elements('td')[3]).toHaveText('');
    expect(tester.logs[0].elements('td')[4]).toContainText('my log 1');

    expect(tester.logs[1].elements('td')[1]).toContainText('2 Jan 2023, 01:00:00');
    expect(tester.logs[1].elements('td')[2]).toContainText('South');
    expect(tester.logs[1].elements('td')[3]).toContainText('My South');
    expect(tester.logs[1].elements('td')[4]).toContainText('my log 2');
    discardPeriodicTasks();
  }));
});
