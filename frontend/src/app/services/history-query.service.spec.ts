import { TestBed } from '@angular/core/testing';

import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { HistoryQueryService } from './history-query.service';
import { HistoryQueryDTO, HistoryQueryItemDTO, HistoryQueryLightDTO } from '../../../../backend/shared/model/history-query.model';
import { toPage } from '../shared/test-utils';
import { Page } from '../../../../backend/shared/model/types';
import { DownloadService } from './download.service';
import { SouthFolderScannerItemSettings } from '../../../../backend/shared/model/south-settings.model';
import { CacheContentUpdateCommand, CacheSearchResult, FileCacheContent } from '../../../../backend/shared/model/engine.model';
import testData from '../../../../backend/src/tests/utils/test-data';
import { HistoryTransformerDTOWithOptions } from '../../../../backend/shared/model/transformer.model';

describe('HistoryQueryService', () => {
  let http: HttpTestingController;
  let service: HistoryQueryService;
  let downloadService: DownloadService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(HistoryQueryService);
    downloadService = TestBed.inject(DownloadService);
  });

  afterEach(() => http.verify());

  it('should get all History queries', () => {
    let expectedHistoryQueries: Array<HistoryQueryLightDTO> = [];
    service.list().subscribe(historyQueries => (expectedHistoryQueries = historyQueries));

    http.expectOne('/api/history').flush([{ name: 'History query 1' }, { name: 'History query 2' }]);

    expect(expectedHistoryQueries.length).toBe(2);
  });

  it('should get a History query', () => {
    let expectedHistoryQuery: HistoryQueryDTO | null = null;
    const historyQuery = { id: 'id1' } as HistoryQueryDTO;

    service.findById('id1').subscribe(c => (expectedHistoryQuery = c));

    http.expectOne({ url: '/api/history/id1', method: 'GET' }).flush(historyQuery);
    expect(expectedHistoryQuery!).toEqual(historyQuery);
  });

  it('should create a History query', () => {
    let done = false;
    const command = testData.historyQueries.command;

    service.create(command, null, null, '').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'POST', url: '/api/history' });
    expect(testRequest.request.body).toEqual(command);
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should update a History query', () => {
    let done = false;
    const command = testData.historyQueries.command;

    service.update('id1', command, true).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'PUT', url: '/api/history/id1?resetCache=true' });
    expect(testRequest.request.body).toEqual(command);
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should delete a History query', () => {
    let done = false;
    service.delete('id1').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'DELETE', url: '/api/history/id1' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should add or edit a History query transformer with options', () => {
    let done = false;
    service.addOrEditTransformer('id1', {} as HistoryTransformerDTOWithOptions).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'POST', url: '/api/history/id1/transformers' });
    testRequest.flush({});
    expect(done).toBe(true);
  });

  it('should remove a History query transformer', () => {
    let done = false;
    service.removeTransformer('id1', 'transformerId').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'DELETE', url: '/api/history/id1/transformers/transformerId' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should search History query items', () => {
    let expectedItems: Page<HistoryQueryItemDTO> | null = null;
    const southConnectorItems = toPage<HistoryQueryItemDTO>([
      {
        id: 'itemId',
        name: 'MySouthItem',
        enabled: true,
        settings: { regex: '*', minAge: 100, preserveFiles: true } as SouthFolderScannerItemSettings,
        createdBy: { id: '', friendlyName: '' },
        updatedBy: { id: '', friendlyName: '' },
        createdAt: '',
        updatedAt: ''
      } as unknown as HistoryQueryItemDTO
    ]);

    service.searchItems('id1', { name: undefined, enabled: undefined, page: 0 }).subscribe(c => (expectedItems = c));

    http.expectOne({ url: '/api/history/id1/items/search?page=0', method: 'GET' }).flush(southConnectorItems);
    expect(expectedItems!).toEqual(southConnectorItems);
  });

  it('should get a History query item', () => {
    let expectedItem: object | null = null;
    const southConnectorItem = { id: 'itemId1' };

    service.getItem('id1', 'itemId1').subscribe(c => (expectedItem = c));

    http.expectOne({ url: '/api/history/id1/items/itemId1', method: 'GET' }).flush(southConnectorItem);
    expect(expectedItem!).toEqual(southConnectorItem);
  });

  it('should create a History query item', () => {
    let done = false;
    const command = testData.historyQueries.itemCommand;

    service.createItem('id1', command).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'POST', url: '/api/history/id1/items' });
    expect(testRequest.request.body).toEqual(command);
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should update a History query item', () => {
    let done = false;
    const command = testData.historyQueries.itemCommand;

    service.updateItem('id1', 'itemId1', command).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'PUT', url: '/api/history/id1/items/itemId1' });
    expect(testRequest.request.body).toEqual(command);
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should delete a History query item', () => {
    let done = false;
    service.deleteItem('id1', 'itemId1').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'DELETE', url: '/api/history/id1/items/itemId1' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should enable a History query item', () => {
    let done = false;
    service.enableItem('id1', 'historyItemId1').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'POST', url: '/api/history/id1/items/historyItemId1/enable' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should disable a History query item', () => {
    let done = false;
    service.disableItem('id1', 'historyItemId1').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'POST', url: '/api/history/id1/items/historyItemId1/disable' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should enable History query items', () => {
    let done = false;
    service.enableItems('id1', ['historyItemId1', 'historyItemId2']).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'POST', url: '/api/history/id1/items/enable' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should disable History query items', () => {
    let done = false;
    service.disableItems('id1', ['historyItemId1', 'historyItemId2']).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'POST', url: '/api/history/id1/items/disable' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should delete History query items', () => {
    let done = false;
    service.deleteItems('id1', ['historyItemId1', 'historyItemId2']).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'POST', url: '/api/history/id1/items/delete' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should delete all South connector items', () => {
    let done = false;
    service.deleteAllItems('id1').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'DELETE', url: '/api/history/id1/items' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should download csv items', () => {
    let downloaded = false;

    spyOn(downloadService, 'download');
    service.itemsToCsv('southType', [], 'historyQueryName', ';').subscribe(() => (downloaded = true));

    http
      .expectOne({
        method: 'POST',
        url: '/api/history/southType/items/to-csv'
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
        method: 'POST',
        url: '/api/history/id1/items/export'
      })
      .flush(new Blob());

    expect(downloaded).toBe(true);
    expect(downloadService.download).toHaveBeenCalled();
  });

  it('should check import history south items', () => {
    const file = new Blob() as File;
    const delimiter = ',';
    const expectedFormData = new FormData();
    expectedFormData.set('itemsToImport', file);
    expectedFormData.set('currentItems', new Blob([JSON.stringify([])], { type: 'application/json' }), 'currentItems.json');
    expectedFormData.set('delimiter', delimiter);
    let actualImportation = false;

    service.checkImportItems('southType', [], file, delimiter).subscribe(() => {
      actualImportation = true;
    });

    const testRequest = http.expectOne({ method: 'POST', url: '/api/history/southType/items/import/check' });
    expect(testRequest.request.body).toEqual(expectedFormData);
    testRequest.flush(true);

    expect(actualImportation).toBe(true);
  });

  it('should import history south items', () => {
    const file = new Blob() as File;
    const expectedFormData = new FormData();
    expectedFormData.set('file', file);
    let actualImportation = false;

    service.importItems('id1', []).subscribe(() => {
      actualImportation = true;
    });

    const testRequest = http.expectOne({ method: 'POST', url: '/api/history/id1/items/import' });
    expect(testRequest.request.body).toEqual(expectedFormData);
    testRequest.flush(true);

    expect(actualImportation).toBe(true);
  });

  it('should start a History query', () => {
    let done = false;

    service.start('id1').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'POST', url: '/api/history/id1/start' });
    expect(testRequest.request.body).toEqual(null);
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should stop a History query', () => {
    let done = false;

    service.pause('id1').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'POST', url: '/api/history/id1/pause' });
    expect(testRequest.request.body).toEqual(null);
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should test a History query North connector connection', () => {
    let done = false;
    const command = testData.north.command;

    service.testNorthConnection('id1', command.settings, command.type).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'POST', url: '/api/history/id1/test/north?northType=file-writer' });
    expect(testRequest.request.body).toEqual(command.settings);
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should test a History query South connector connection', () => {
    let done = false;
    const command = testData.south.command;

    service.testSouthConnection('id1', command.settings, command.type).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'POST', url: '/api/history/id1/test/south?southType=folder-scanner' });
    expect(testRequest.request.body).toEqual(command.settings);
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should test a History query item', () => {
    let done = false;
    const itemSettings = testData.south.itemCommand.settings;
    const southSettings = testData.south.command.settings;
    const testingSettings = {
      history: {
        startTime: testData.constants.dates.DATE_1,
        endTime: testData.constants.dates.DATE_2
      }
    };
    service.testItem('id1', null, 'mysql', 'my item', southSettings, itemSettings, testingSettings).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'POST', url: '/api/history/id1/test/items?southType=mysql&itemName=my%20item' });
    expect(testRequest.request.body).toEqual({ southSettings, itemSettings, testingSettings });
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should search cache content', () => {
    let result: CacheSearchResult | null = null;
    const historyCacheFiles: CacheSearchResult = {} as CacheSearchResult;

    service
      .searchCacheContent('id1', {
        start: '2020-01-01T00:00:00.000Z',
        end: '2021-01-01T00:00:00.000Z',
        nameContains: 'file',
        maxNumberOfFilesReturned: 1000
      })
      .subscribe(c => (result = c));

    http
      .expectOne({
        url: '/api/history/id1/cache/search?maxNumberOfFilesReturned=1000&start=2020-01-01T00:00:00.000Z&end=2021-01-01T00:00:00.000Z&nameContains=file',
        method: 'GET'
      })
      .flush(historyCacheFiles);
    expect(result!).toEqual(historyCacheFiles);
  });

  it('should get cache file content', () => {
    let result: FileCacheContent | null = null;
    const historyCacheFileContent: FileCacheContent = {} as FileCacheContent;
    service.getCacheFileContent('id1', 'cache', 'file1').subscribe(c => (result = c));

    http
      .expectOne({
        url: '/api/history/id1/cache/content/file1?folder=cache',
        method: 'GET'
      })
      .flush(historyCacheFileContent);
    expect(result!).toEqual(historyCacheFileContent);
  });

  it('should update cache', () => {
    let done = false;
    const updateCommand = {} as CacheContentUpdateCommand;
    service.updateCacheContent('id1', updateCommand).subscribe(() => (done = true));
    const testRequest = http.expectOne({
      method: 'POST',
      url: '/api/history/id1/cache/update'
    });
    testRequest.flush(updateCommand);
    expect(done).toBe(true);
  });
});
