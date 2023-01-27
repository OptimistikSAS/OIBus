import { TestBed } from '@angular/core/testing';

import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { HistoryQueryService } from './history-query.service';
import { HistoryQueryCommandDTO, HistoryQueryDTO } from '../model/history-query.model';

describe('HistoryQueryService', () => {
  let http: HttpTestingController;
  let service: HistoryQueryService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [HistoryQueryService]
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(HistoryQueryService);
  });

  afterEach(() => http.verify());

  it('should get all History queries', () => {
    let expectedHistoryQueries: Array<HistoryQueryDTO> = [];
    service.getHistoryQueries().subscribe(historyQueries => (expectedHistoryQueries = historyQueries));

    http.expectOne('/api/history-queries').flush([{ name: 'History query 1' }, { name: 'History query 2' }]);

    expect(expectedHistoryQueries.length).toBe(2);
  });

  it('should get a History query', () => {
    let expectedHistoryQuery: HistoryQueryDTO | null = null;
    const historyQuery = { id: 'id1' } as HistoryQueryDTO;

    service.getHistoryQuery('id1').subscribe(c => (expectedHistoryQuery = c));

    http.expectOne({ url: '/api/history-queries/id1', method: 'GET' }).flush(historyQuery);
    expect(expectedHistoryQuery!).toEqual(historyQuery);
  });

  it('should create a History query', () => {
    let done = false;
    const command: HistoryQueryCommandDTO = {
      name: 'myHistoryQuery',
      description: 'a test history query',
      enabled: true,
      startTime: '2023-01-01T00:00:00.000Z',
      endTime: '2023-01-01T00:00:00.000Z',
      southType: 'SQL',
      northType: 'OIConnect',
      southSettings: {},
      northSettings: {},
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

    service.createHistoryQuery(command).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'POST', url: '/api/history-queries' });
    expect(testRequest.request.body).toEqual(command);
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should update a History query', () => {
    let done = false;
    const command: HistoryQueryCommandDTO = {
      name: 'myHistoryQuery',
      description: 'a test history query',
      enabled: true,
      startTime: '2023-01-01T00:00:00.000Z',
      endTime: '2023-01-01T00:00:00.000Z',
      southType: 'SQL',
      northType: 'OIConnect',
      southSettings: {},
      northSettings: {},
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

    service.updateHistoryQuery('id1', command).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'PUT', url: '/api/history-queries/id1' });
    expect(testRequest.request.body).toEqual(command);
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should delete a History query', () => {
    let done = false;
    service.deleteHistoryQuery('id1').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'DELETE', url: '/api/history-queries/id1' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });
});
