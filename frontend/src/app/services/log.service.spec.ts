import { TestBed } from '@angular/core/testing';

import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { Page } from '../../../../shared/model/types';
import { toPage } from '../shared/test-utils';
import { LogService } from './log.service';
import { LogDTO } from '../../../../shared/model/logs.model';

describe('LogService', () => {
  let http: HttpTestingController;
  let service: LogService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [LogService]
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(LogService);
  });

  afterEach(() => http.verify());

  it('should search Logs', () => {
    let expectedLogs: Page<LogDTO> | null = null;
    const logs = toPage<LogDTO>([
      {
        timestamp: '2023-01-01T00:00:00.000Z',
        level: 'error',
        scope: 'engine',
        message: 'my log 1'
      },
      {
        timestamp: '2023-01-02T00:00:00.000Z',
        level: 'error',
        scope: 'engine',
        message: 'my log 2'
      }
    ]);

    service
      .searchLogs({
        page: 0,
        messageContent: 'messageContent',
        scope: 'myScope',
        start: '2023-01-01T00:00:00.000Z',
        end: '2023-01-02T00:00:00.000Z',
        levels: ['info', 'debug']
      })
      .subscribe(c => (expectedLogs = c));

    http
      .expectOne({
        url: '/api/logs?page=0&messageContent=messageContent&start=2023-01-01T00:00:00.000Z&end=2023-01-02T00:00:00.000Z&scope=myScope&levels=info&levels=debug',
        method: 'GET'
      })
      .flush(logs);
    expect(expectedLogs!).toEqual(logs);
  });
});
