import { HttpErrorResponse } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { firstValueFrom, Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { HistoryQueryItemDTO } from '@oibus/shared/api/history-query.model';
import { SouthConnectorItemTestResult, SouthExploreBrowseResult, SouthExploreStartResult } from '@oibus/shared/api/south-connector.model';
import {
  CacheContentUpdateCommand,
  CacheSearchResult,
  FileCacheContent,
  OIBusConnectionTestResult
} from '@oibus/shared/domain/engine.model';
import { SouthConnectorItemTestingSettings } from '@oibus/shared/domain/south-connector.model';

import { expectHttp } from '../../test/http-testing';
import testData from '../../test/test-data';
import { createMock, MockObject } from '../../test/vitest-create-mock';
import { SHOULD_IGNORE_ERROR_PREDICATE } from '../shared/error-interceptor.service';
import { toPage } from '../shared/utils/page.utils';
import { DownloadService } from './download.service';
import { HistoryQueryService } from './history-query.service';

interface HttpCase {
  name: string;
  call: (service: HistoryQueryService) => Observable<unknown>;
  method: string;
  url: string;
  body: unknown;
  response: unknown;
}

/** Background requests and inline-displayed errors must not be notified globally, except an expired session */
function expectErrorsIgnoredUnlessUnauthorized(request: TestRequest) {
  const shouldIgnore = request.request.context.get(SHOULD_IGNORE_ERROR_PREDICATE);
  expect(shouldIgnore(new HttpErrorResponse({ status: 500 }))).toBe(true);
  expect(shouldIgnore(new HttpErrorResponse({ status: 400 }))).toBe(true);
  expect(shouldIgnore(new HttpErrorResponse({ status: 401 }))).toBe(false);
}

function formDataOf(request: TestRequest): FormData {
  const body: unknown = request.request.body;
  if (!(body instanceof FormData)) {
    throw new Error('Expected a FormData body');
  }
  return body;
}

/** Reads a JSON file sent in a multipart body */
async function jsonFileOf(formData: FormData, key: string): Promise<{ name: string; content: unknown }> {
  const value = formData.get(key);
  if (!(value instanceof File)) {
    throw new Error(`Expected ${key} to be a file`);
  }
  return { name: value.name, content: JSON.parse(await value.text()) };
}

const connectionTestResult: OIBusConnectionTestResult = { items: [{ key: 'Connected', value: 'true' }] };
const itemTestResult: SouthConnectorItemTestResult = {
  raw: { type: 'any-content', content: 'raw' },
  transformed: null,
  connectionDuration: 1,
  queryDuration: 2
};
const testingSettings: SouthConnectorItemTestingSettings = {
  history: { startTime: testData.constants.dates.DATE_1, endTime: testData.constants.dates.DATE_2 }
};
const exploreStartResult: SouthExploreStartResult = {
  sessionId: 'sessionId',
  entries: [{ id: 'root', name: 'Root', metadata: {}, hasChildren: true }]
};
const exploreBrowseResult: SouthExploreBrowseResult = {
  entries: [{ id: 'child', name: 'Child', metadata: { size: 12 }, hasChildren: false }]
};
const cacheSearchResult: CacheSearchResult = {
  searchDate: testData.constants.dates.DATE_1,
  metrics: {
    lastConnection: null,
    lastRunStart: null,
    lastRunDuration: null,
    currentCacheSize: 10,
    currentErrorSize: 0,
    currentArchiveSize: 0
  },
  cache: [
    {
      filename: 'file1',
      metadata: {
        contentFile: 'file1.json',
        contentSize: 10,
        numberOfElement: 1,
        createdAt: testData.constants.dates.DATE_1,
        contentType: 'time-values'
      }
    }
  ],
  error: [],
  archive: []
};
const fileCacheContent: FileCacheContent = {
  content: '{}',
  contentFilename: 'file1.json',
  contentType: 'json',
  truncated: false,
  totalSize: 2
};
const updateCommand: CacheContentUpdateCommand = {
  cache: { remove: ['file1'], move: [{ filename: 'file2', to: 'archive' }] },
  error: { remove: [], move: [] },
  archive: { remove: [], move: [] }
};

describe('HistoryQueryService', () => {
  let http: HttpTestingController;
  let service: HistoryQueryService;
  let downloadService: MockObject<DownloadService>;

  beforeEach(() => {
    downloadService = createMock(DownloadService);
    TestBed.configureTestingModule({
      providers: [provideHttpClientTesting(), { provide: DownloadService, useValue: downloadService }]
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(HistoryQueryService);
  });

  afterEach(() => http.verify());

  const command = testData.historyQueries.command;
  const historyQuery = testData.historyQueries.list[0];
  const item: HistoryQueryItemDTO = historyQuery.items[0];
  const itemCommand = testData.historyQueries.itemCommand;
  const transformer = historyQuery.northTransformers[0];
  const southSettings = testData.south.command.settings;
  const northSettings = testData.north.command.settings;

  test.each<HttpCase>([
    {
      name: 'list the History queries',
      call: s => s.list(),
      method: 'GET',
      url: '/api/history',
      body: null,
      response: testData.historyQueries.listLight
    },
    {
      name: 'get a History query',
      call: s => s.findById('id1'),
      method: 'GET',
      url: '/api/history/id1',
      body: null,
      response: historyQuery
    },
    {
      name: 'create a History query',
      call: s => s.create(command, null, null, null),
      method: 'POST',
      url: '/api/history',
      body: command,
      response: historyQuery
    },
    {
      name: 'create a History query reusing the secrets of other connectors',
      call: s => s.create(command, 'southId1', 'northId1', 'historyId2'),
      method: 'POST',
      url: '/api/history?duplicate=historyId2&fromSouth=southId1&fromNorth=northId1',
      body: command,
      response: historyQuery
    },
    {
      name: 'update a History query and reset its cache',
      call: s => s.update('id1', command, true),
      method: 'PUT',
      url: '/api/history/id1?resetCache=true',
      body: command,
      response: null
    },
    {
      name: 'update a History query and keep its cache',
      call: s => s.update('id1', command, false),
      method: 'PUT',
      url: '/api/history/id1',
      body: command,
      response: null
    },
    { name: 'delete a History query', call: s => s.delete('id1'), method: 'DELETE', url: '/api/history/id1', body: null, response: null },
    { name: 'start a History query', call: s => s.start('id1'), method: 'POST', url: '/api/history/id1/start', body: null, response: null },
    { name: 'pause a History query', call: s => s.pause('id1'), method: 'POST', url: '/api/history/id1/pause', body: null, response: null },
    {
      name: 'start an explore session',
      call: s => s.startExplore('id1', southSettings, 'folder-scanner'),
      method: 'POST',
      url: '/api/history/id1/explore?southType=folder-scanner',
      body: southSettings,
      response: exploreStartResult
    },
    {
      name: 'start an explore session with the secrets of a South connector',
      call: s => s.startExplore('id1', southSettings, 'folder-scanner', 'southId1'),
      method: 'POST',
      url: '/api/history/id1/explore?fromSouth=southId1&southType=folder-scanner',
      body: southSettings,
      response: exploreStartResult
    },
    {
      name: 'browse an explore session',
      call: s => s.browseExplore('id1', 'sessionId', 'root'),
      method: 'PUT',
      url: '/api/history/id1/explore/sessionId',
      body: { parentId: 'root' },
      response: exploreBrowseResult
    },
    {
      name: 'close an explore session',
      call: s => s.closeExplore('id1', 'sessionId'),
      method: 'DELETE',
      url: '/api/history/id1/explore/sessionId',
      body: null,
      response: null
    },
    {
      name: 'search History query items by name',
      call: s => s.searchItems('id1', { page: 2, name: 'item' }),
      method: 'GET',
      url: '/api/history/id1/items/search?page=2&name=item',
      body: null,
      response: toPage([item])
    },
    {
      name: 'search History query items without filter',
      call: s => s.searchItems('id1', { name: undefined, enabled: undefined, page: 0 }),
      method: 'GET',
      url: '/api/history/id1/items/search?page=0',
      body: null,
      response: toPage([item])
    },
    {
      name: 'get a History query item',
      call: s => s.getItem('id1', 'itemId1'),
      method: 'GET',
      url: '/api/history/id1/items/itemId1',
      body: null,
      response: item
    },
    {
      name: 'create a History query item',
      call: s => s.createItem('id1', itemCommand),
      method: 'POST',
      url: '/api/history/id1/items',
      body: itemCommand,
      response: item
    },
    {
      name: 'update a History query item',
      call: s => s.updateItem('id1', 'itemId1', itemCommand),
      method: 'PUT',
      url: '/api/history/id1/items/itemId1',
      body: itemCommand,
      response: null
    },
    {
      name: 'delete a History query item',
      call: s => s.deleteItem('id1', 'itemId1'),
      method: 'DELETE',
      url: '/api/history/id1/items/itemId1',
      body: null,
      response: null
    },
    {
      name: 'enable a History query item',
      call: s => s.enableItem('id1', 'itemId1'),
      method: 'POST',
      url: '/api/history/id1/items/itemId1/enable',
      body: null,
      response: null
    },
    {
      name: 'disable a History query item',
      call: s => s.disableItem('id1', 'itemId1'),
      method: 'POST',
      url: '/api/history/id1/items/itemId1/disable',
      body: null,
      response: null
    },
    {
      name: 'enable History query items',
      call: s => s.enableItems('id1', ['itemId1', 'itemId2']),
      method: 'POST',
      url: '/api/history/id1/items/enable',
      body: { itemIds: ['itemId1', 'itemId2'] },
      response: null
    },
    {
      name: 'disable History query items',
      call: s => s.disableItems('id1', ['itemId1', 'itemId2']),
      method: 'POST',
      url: '/api/history/id1/items/disable',
      body: { itemIds: ['itemId1', 'itemId2'] },
      response: null
    },
    {
      name: 'delete History query items',
      call: s => s.deleteItems('id1', ['itemId1', 'itemId2']),
      method: 'POST',
      url: '/api/history/id1/items/delete',
      body: { itemIds: ['itemId1', 'itemId2'] },
      response: null
    },
    {
      name: 'delete all History query items',
      call: s => s.deleteAllItems('id1'),
      method: 'DELETE',
      url: '/api/history/id1/items',
      body: null,
      response: null
    },
    {
      name: 'add or edit a History query transformer',
      call: s => s.addOrEditTransformer('id1', transformer),
      method: 'POST',
      url: '/api/history/id1/transformers',
      body: transformer,
      response: transformer
    },
    {
      name: 'remove a History query transformer',
      call: s => s.removeTransformer('id1', 'transformerId'),
      method: 'DELETE',
      url: '/api/history/id1/transformers/transformerId',
      body: null,
      response: null
    },
    {
      name: 'search the cache content with every filter',
      call: s =>
        s.searchCacheContent('id1', {
          start: '2020-01-01T00:00:00.000Z',
          end: '2021-01-01T00:00:00.000Z',
          nameContains: 'file',
          maxNumberOfFilesReturned: 1000
        }),
      method: 'GET',
      url: '/api/history/id1/cache/search?maxNumberOfFilesReturned=1000&start=2020-01-01T00:00:00.000Z&end=2021-01-01T00:00:00.000Z&nameContains=file',
      body: null,
      response: cacheSearchResult
    },
    {
      name: 'search the cache content without optional filters',
      call: s => s.searchCacheContent('id1', { start: undefined, end: undefined, nameContains: undefined, maxNumberOfFilesReturned: 0 }),
      method: 'GET',
      url: '/api/history/id1/cache/search?maxNumberOfFilesReturned=0',
      body: null,
      response: cacheSearchResult
    },
    {
      name: 'get a cache file content',
      call: s => s.getCacheFileContent('id1', 'archive', 'file1'),
      method: 'GET',
      url: '/api/history/id1/cache/content/file1?folder=archive',
      body: null,
      response: fileCacheContent
    },
    {
      name: 'update the cache content',
      call: s => s.updateCacheContent('id1', updateCommand),
      method: 'POST',
      url: '/api/history/id1/cache/update',
      body: updateCommand,
      response: null
    }
  ])('should $name', async ({ call, method, url, body, response }) => {
    const result = await expectHttp(http, call(service), { method, url }, { body, response });

    expect(result).toEqual(response);
  });

  test('should get the History query metrics and only notify an expired session', async () => {
    const result = firstValueFrom(service.getMetrics('id1'));

    const request = http.expectOne({ method: 'GET', url: '/api/history/id1/metrics' });
    expectErrorsIgnoredUnlessUnauthorized(request);
    request.flush(testData.historyQueries.metrics);

    await expect(result).resolves.toEqual(testData.historyQueries.metrics);
  });

  test.each<Omit<HttpCase, 'method' | 'response'>>([
    {
      name: 'the North connection',
      call: s => s.testNorthConnection('id1', northSettings, 'file-writer'),
      url: '/api/history/id1/test/north?northType=file-writer',
      body: northSettings
    },
    {
      name: 'the North connection with the secrets of a North connector',
      call: s => s.testNorthConnection('id1', northSettings, 'file-writer', 'northId1'),
      url: '/api/history/id1/test/north?fromNorth=northId1&northType=file-writer',
      body: northSettings
    },
    {
      name: 'the South connection',
      call: s => s.testSouthConnection('id1', southSettings, 'folder-scanner'),
      url: '/api/history/id1/test/south?southType=folder-scanner',
      body: southSettings
    },
    {
      name: 'the South connection with the secrets of a South connector',
      call: s => s.testSouthConnection('id1', southSettings, 'folder-scanner', 'southId1'),
      url: '/api/history/id1/test/south?fromSouth=southId1&southType=folder-scanner',
      body: southSettings
    }
  ])('should test $name and leave the error display to the caller', async ({ call, url, body }) => {
    const result = firstValueFrom(call(service));

    const request = http.expectOne({ method: 'POST', url });
    expect(request.request.body).toEqual(body);
    expectErrorsIgnoredUnlessUnauthorized(request);
    request.flush(connectionTestResult);

    await expect(result).resolves.toEqual(connectionTestResult);
  });

  test.each([
    { fromSouth: null, url: '/api/history/id1/test/items?southType=mysql&itemName=my%20item' },
    { fromSouth: 'southId1', url: '/api/history/id1/test/items?fromSouth=southId1&southType=mysql&itemName=my%20item' }
  ])('should test an item (fromSouth: $fromSouth) and leave the error display to the caller', async ({ fromSouth, url }) => {
    const itemSettings = testData.south.itemCommand.settings;

    const result = firstValueFrom(service.testItem('id1', fromSouth, 'mysql', 'my item', southSettings, itemSettings, testingSettings));

    const request = http.expectOne({ method: 'POST', url });
    expect(request.request.body).toEqual({ southSettings, itemSettings, testingSettings });
    expectErrorsIgnoredUnlessUnauthorized(request);
    request.flush(itemTestResult);

    await expect(result).resolves.toEqual(itemTestResult);
  });

  test('should convert items to a downloaded CSV file', async () => {
    const result = firstValueFrom(service.itemsToCsv('mssql', [itemCommand], 'history.csv', ';'), { defaultValue: 'no emission' });

    const request = http.expectOne({ method: 'POST', url: '/api/history/mssql/items/to-csv' });
    expect(request.request.responseType).toBe('blob');
    const body = formDataOf(request);
    await expect(jsonFileOf(body, 'items')).resolves.toEqual({ name: 'items.json', content: [itemCommand] });
    expect(body.get('delimiter')).toBe(';');
    const blob = new Blob(['csv']);
    request.flush(blob);

    await expect(result).resolves.toBeUndefined();
    expect(downloadService.download).toHaveBeenCalledWith(expect.objectContaining({ body: blob }), 'history.csv');
  });

  test('should export the items of a History query to a downloaded CSV file', async () => {
    const result = firstValueFrom(service.exportItems('id1', 'history.csv', ';'), { defaultValue: 'no emission' });

    const request = http.expectOne({ method: 'POST', url: '/api/history/id1/items/export' });
    expect(request.request.body).toEqual({ delimiter: ';' });
    expect(request.request.responseType).toBe('blob');
    const blob = new Blob(['csv']);
    request.flush(blob);

    await expect(result).resolves.toBeUndefined();
    expect(downloadService.download).toHaveBeenCalledWith(expect.objectContaining({ body: blob }), 'history.csv');
  });

  test.each([
    { deleteItemsNotPresent: undefined, expected: 'false' },
    { deleteItemsNotPresent: true, expected: 'true' }
  ])('should check items to import (deleteItemsNotPresent: $deleteItemsNotPresent)', async ({ deleteItemsNotPresent, expected }) => {
    const file = new File(['name;enabled'], 'items.csv');
    const response = { items: [item], errors: [{ item, error: 'Invalid query' }] };

    const result = firstValueFrom(service.checkImportItems('mssql', [item], file, ',', deleteItemsNotPresent));

    const request = http.expectOne({ method: 'POST', url: '/api/history/mssql/items/import/check' });
    const body = formDataOf(request);
    expect(body.get('itemsToImport')).toBe(file);
    await expect(jsonFileOf(body, 'currentItems')).resolves.toEqual({ name: 'currentItems.json', content: [item] });
    expect(body.get('delimiter')).toBe(',');
    expect(body.get('deleteItemsNotPresent')).toBe(expected);
    request.flush(response);

    await expect(result).resolves.toEqual(response);
  });

  test.each([
    { deleteItemsNotPresent: undefined, expected: 'false' },
    { deleteItemsNotPresent: true, expected: 'true' }
  ])('should import items (deleteItemsNotPresent: $deleteItemsNotPresent)', async ({ deleteItemsNotPresent, expected }) => {
    const result = firstValueFrom(service.importItems('id1', [itemCommand], deleteItemsNotPresent));

    const request = http.expectOne({ method: 'POST', url: '/api/history/id1/items/import' });
    const body = formDataOf(request);
    await expect(jsonFileOf(body, 'items')).resolves.toEqual({ name: 'items.json', content: [itemCommand] });
    expect(body.get('deleteItemsNotPresent')).toBe(expected);
    request.flush(null);

    await expect(result).resolves.toBeNull();
  });
});
