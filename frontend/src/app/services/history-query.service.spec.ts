import { TestBed } from '@angular/core/testing';

import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { HistoryQueryService } from './history-query.service';
import {
  HistoryQueryCommandDTO,
  HistoryQueryDTO,
  HistoryQueryItemCommandDTO,
  HistoryQueryItemDTO,
  HistoryQueryLightDTO
} from '../../../../backend/shared/model/history-query.model';
import { toPage } from '../shared/test-utils';
import { Page } from '../../../../backend/shared/model/types';
import { SouthConnectorCommandDTO } from '../../../../backend/shared/model/south-connector.model';
import { DownloadService } from './download.service';
import { provideHttpClient } from '@angular/common/http';
import { NorthConnectorCommandDTO } from '../../../../backend/shared/model/north-connector.model';
import { SouthItemSettings, SouthSettings } from '../../../../backend/shared/model/south-settings.model';
import { NorthSettings } from '../../../../backend/shared/model/north-settings.model';

describe('HistoryQueryService', () => {
  let http: HttpTestingController;
  let service: HistoryQueryService;
  let downloadService: DownloadService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(HistoryQueryService);
    downloadService = TestBed.inject(DownloadService);
  });

  afterEach(() => http.verify());

  it('should get all History queries', () => {
    let expectedHistoryQueries: Array<HistoryQueryLightDTO> = [];
    service.list().subscribe(historyQueries => (expectedHistoryQueries = historyQueries));

    http.expectOne('/api/history-queries').flush([{ name: 'History query 1' }, { name: 'History query 2' }]);

    expect(expectedHistoryQueries.length).toBe(2);
  });

  it('should get a History query', () => {
    let expectedHistoryQuery: HistoryQueryDTO<SouthSettings, NorthSettings, SouthItemSettings> | null = null;
    const historyQuery = { id: 'id1' } as HistoryQueryDTO<SouthSettings, NorthSettings, SouthItemSettings>;

    service.get('id1').subscribe(c => (expectedHistoryQuery = c));

    http.expectOne({ url: '/api/history-queries/id1', method: 'GET' }).flush(historyQuery);
    expect(expectedHistoryQuery!).toEqual(historyQuery);
  });

  it('should create a History query', () => {
    let done = false;
    const command: HistoryQueryCommandDTO<SouthSettings, NorthSettings, SouthItemSettings> = {
      name: 'myHistoryQuery',
      description: 'a test history query',
      southType: 'SQL',
      northType: 'OIConnect'
    } as HistoryQueryCommandDTO<SouthSettings, NorthSettings, SouthItemSettings>;

    service.create(command, null, null, '').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'POST', url: '/api/history-queries' });
    expect(testRequest.request.body).toEqual(command);
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should update a History query', () => {
    let done = false;
    const command: HistoryQueryCommandDTO<SouthSettings, NorthSettings, SouthItemSettings> = {
      name: 'myHistoryQuery',
      description: 'a test history query',
      history: {
        maxInstantPerItem: false,
        maxReadInterval: 0,
        readDelay: 200
      },
      startTime: '2023-01-01T00:00:00.000Z',
      endTime: '2023-01-01T00:00:00.000Z',
      southType: 'SQL',
      northType: 'OIConnect',
      southSettings: {} as SouthSettings,
      northSettings: {} as NorthSettings,
      caching: {
        scanModeId: 'scanModeId1',
        scanModeName: null,
        retryInterval: 1000,
        retryCount: 3,
        maxSize: 30,
        oibusTimeValues: {
          groupCount: 1000,
          maxSendCount: 10000
        },
        rawFiles: {
          sendFileImmediately: true,
          archive: {
            enabled: false,
            retentionDuration: 0
          }
        }
      },
      items: []
    };

    service.update('id1', command, true).subscribe(() => (done = true));
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

  it('should search History query items', () => {
    let expectedItems: Page<HistoryQueryItemDTO<SouthItemSettings>> | null = null;
    const southConnectorItems = toPage<HistoryQueryItemDTO<SouthItemSettings>>([
      { id: 'itemId', name: 'MySouthItem', enabled: true, settings: {} as SouthItemSettings }
    ]);

    service.searchItems('id1', { page: 0 }).subscribe(c => (expectedItems = c));

    http.expectOne({ url: '/api/history-queries/id1/south-items?page=0', method: 'GET' }).flush(southConnectorItems);
    expect(expectedItems!).toEqual(southConnectorItems);
  });

  it('should get a History query item', () => {
    let expectedItem: object | null = null;
    const southConnectorItem = { id: 'itemId1' };

    service.getItem('id1', 'itemId1').subscribe(c => (expectedItem = c));

    http.expectOne({ url: '/api/history-queries/id1/south-items/itemId1', method: 'GET' }).flush(southConnectorItem);
    expect(expectedItem!).toEqual(southConnectorItem);
  });

  it('should create a History query item', () => {
    let done = false;
    const command: HistoryQueryItemCommandDTO<SouthItemSettings> = {
      id: null,
      name: 'myPointId',
      enabled: true,
      settings: {} as SouthItemSettings
    };

    service.createItem('id1', command).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'POST', url: '/api/history-queries/id1/south-items' });
    expect(testRequest.request.body).toEqual(command);
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should update a History query item', () => {
    let done = false;
    const command: HistoryQueryItemCommandDTO<SouthItemSettings> = {
      id: null,
      name: 'myPointId',
      enabled: false,
      settings: {} as SouthItemSettings
    };

    service.updateItem('id1', 'itemId1', command).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'PUT', url: '/api/history-queries/id1/south-items/itemId1' });
    expect(testRequest.request.body).toEqual(command);
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should delete a History query item', () => {
    let done = false;
    service.deleteItem('id1', 'itemId1').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'DELETE', url: '/api/history-queries/id1/south-items/itemId1' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should enable a History query item', () => {
    let done = false;
    service.enableItem('id1', 'historyItemId1').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'PUT', url: '/api/history-queries/id1/south-items/historyItemId1/enable' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should disable a History query item', () => {
    let done = false;
    service.disableItem('id1', 'historyItemId1').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'PUT', url: '/api/history-queries/id1/south-items/historyItemId1/disable' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should delete all South connector items', () => {
    let done = false;
    service.deleteAllItems('id1').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'DELETE', url: '/api/history-queries/id1/south-items/all' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should download csv items', () => {
    let downloaded = false;

    spyOn(downloadService, 'download');
    service.itemsToCsv([], 'historyQueryName', ';').subscribe(() => (downloaded = true));

    http
      .expectOne({
        method: 'PUT',
        url: '/api/history-queries/south-items/to-csv'
      })
      .flush(new Blob());

    expect(downloaded).toBe(true);
    expect(downloadService.download).toHaveBeenCalled();
  });

  it('should download history south items blob', () => {
    let downloaded = false;

    spyOn(downloadService, 'download');
    service.exportItems('id1', 'historyQueryName', ';').subscribe(() => (downloaded = true));

    http
      .expectOne({
        method: 'PUT',
        url: '/api/history-queries/id1/south-items/export'
      })
      .flush(new Blob());

    expect(downloaded).toBe(true);
    expect(downloadService.download).toHaveBeenCalled();
  });

  it('should check import history south items', () => {
    const file = new Blob() as File;
    const delimiter = ',';
    const expectedFormData = new FormData();
    expectedFormData.set('file', file);
    let actualImportation = false;

    service.checkImportItems('southType', 'historyId', [], file, delimiter).subscribe(() => {
      actualImportation = true;
    });

    const testRequest = http.expectOne({ method: 'POST', url: '/api/history-queries/southType/south-items/check-south-import/historyId' });
    expect(testRequest.request.body).toEqual(expectedFormData);
    testRequest.flush(true);

    expect(actualImportation).toBe(true);
  });

  it('should import history south items', () => {
    let actualImportation = false;

    service.importItems('id1', []).subscribe(() => {
      actualImportation = true;
    });

    const testRequest = http.expectOne({ method: 'POST', url: '/api/history-queries/id1/south-items/import' });
    expect(testRequest.request.body).toEqual({ items: [] });
    testRequest.flush(true);

    expect(actualImportation).toBe(true);
  });

  it('should start a History query', () => {
    let done = false;

    service.startHistoryQuery('id1').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'PUT', url: '/api/history-queries/id1/start' });
    expect(testRequest.request.body).toEqual(null);
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should stop a History query', () => {
    let done = false;

    service.pauseHistoryQuery('id1').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'PUT', url: '/api/history-queries/id1/pause' });
    expect(testRequest.request.body).toEqual(null);
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should test a History query North connector connection', () => {
    let done = false;
    const command: NorthConnectorCommandDTO<NorthSettings> = {
      type: 'Test',
      settings: {}
    } as NorthConnectorCommandDTO<NorthSettings>;

    service.testNorthConnection('id1', command).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'PUT', url: '/api/history-queries/id1/north/test-connection' });
    expect(testRequest.request.body).toEqual(command);
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should test a History query South connector connection', () => {
    let done = false;
    const command: SouthConnectorCommandDTO<SouthSettings, SouthItemSettings> = {
      type: 'Test',
      settings: {}
    } as SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>;

    service.testSouthConnection('id1', command).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'PUT', url: '/api/history-queries/id1/south/test-connection' });
    expect(testRequest.request.body).toEqual(command);
    testRequest.flush(null);
    expect(done).toBe(true);
  });
});
