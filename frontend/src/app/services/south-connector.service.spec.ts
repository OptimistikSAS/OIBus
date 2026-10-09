import { HttpErrorResponse } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { firstValueFrom, Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import {
  SouthConnectorItemDTO,
  SouthConnectorItemTestResult,
  SouthExploreBrowseResult,
  SouthExploreStartResult,
  SouthItemLastValueResponse
} from '@oibus/shared/api/south-connector.model';
import { OIBusRecord } from '@oibus/shared/common/content.model';
import { SouthType } from '@oibus/shared/connector/south-manifest.model';
import { OIBusConnectionTestResult } from '@oibus/shared/domain/engine.model';
import { SouthConnectorItemTestingSettings } from '@oibus/shared/domain/south-connector.model';

import { buildSouthItemGroup, buildSouthItemGroupCommand } from '../../test/builders';
import { expectHttp } from '../../test/http-testing';
import testData from '../../test/test-data';
import { createMock, MockObject } from '../../test/vitest-create-mock';
import { SHOULD_IGNORE_ERROR_PREDICATE } from '../shared/error-interceptor.service';
import { toPage } from '../shared/utils/page.utils';
import { DownloadService } from './download.service';
import { SouthConnectorService } from './south-connector.service';

interface HttpCase {
  name: string;
  call: (service: SouthConnectorService) => Observable<unknown>;
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

const southTypes: Array<SouthType> = [
  { id: 'folder-scanner', category: 'file', modes: { subscription: false, lastPoint: false, lastFile: true, history: false } },
  { id: 'mqtt', category: 'iot', modes: { subscription: true, lastPoint: false, lastFile: false, history: false } }
];
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
const discoveredRows: Array<OIBusRecord> = [{ nodeId: 'ns=1;s=Reactor1', name: 'Reactor 1' }];
const exploreStartResult: SouthExploreStartResult = {
  sessionId: 'sessionId',
  entries: [{ id: 'root', name: 'Root', metadata: {}, hasChildren: true }]
};
const exploreBrowseResult: SouthExploreBrowseResult = {
  entries: [{ id: 'child', name: 'Child', metadata: { size: 12 }, hasChildren: false }]
};

describe('SouthConnectorService', () => {
  let http: HttpTestingController;
  let service: SouthConnectorService;
  let downloadService: MockObject<DownloadService>;

  beforeEach(() => {
    downloadService = createMock(DownloadService);
    TestBed.configureTestingModule({
      providers: [provideHttpClientTesting(), { provide: DownloadService, useValue: downloadService }]
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(SouthConnectorService);
  });

  afterEach(() => http.verify());

  const command = testData.south.command;
  const south = testData.south.list[0];
  const item: SouthConnectorItemDTO = south.items[0];
  const itemCommand = testData.south.itemCommand;
  const group = buildSouthItemGroup('groupId1', 'Group 1');
  const groupCommand = buildSouthItemGroupCommand(null, 'Group 1');
  const lastValue: SouthItemLastValueResponse = {
    itemLastValue: {
      itemId: item.id,
      itemName: item.name,
      groupId: null,
      groupName: '',
      queryTime: testData.constants.dates.DATE_1,
      value: 42,
      trackedInstant: testData.constants.dates.DATE_1
    },
    groupLastValue: null
  };

  test.each<HttpCase>([
    { name: 'get the South types', call: s => s.getSouthTypes(), method: 'GET', url: '/api/south/types', body: null, response: southTypes },
    {
      name: 'get a South manifest',
      call: s => s.getSouthManifest('folder-scanner'),
      method: 'GET',
      url: '/api/south/manifests/folder-scanner',
      body: null,
      response: testData.south.manifest
    },
    {
      name: 'list the South connectors',
      call: s => s.list(),
      method: 'GET',
      url: '/api/south',
      body: null,
      response: testData.south.listLight
    },
    { name: 'get a South connector', call: s => s.findById('id1'), method: 'GET', url: '/api/south/id1', body: null, response: south },
    {
      name: 'create a South connector',
      call: s => s.create(command, ''),
      method: 'POST',
      url: '/api/south',
      body: command,
      response: south
    },
    {
      name: 'create a South connector duplicated from another one',
      call: s => s.create(command, 'southId2'),
      method: 'POST',
      url: '/api/south?duplicate=southId2',
      body: command,
      response: south
    },
    {
      name: 'update a South connector',
      call: s => s.update('id1', command),
      method: 'PUT',
      url: '/api/south/id1',
      body: command,
      response: null
    },
    { name: 'delete a South connector', call: s => s.delete('id1'), method: 'DELETE', url: '/api/south/id1', body: null, response: null },
    { name: 'start a South connector', call: s => s.start('id1'), method: 'POST', url: '/api/south/id1/start', body: null, response: null },
    { name: 'stop a South connector', call: s => s.stop('id1'), method: 'POST', url: '/api/south/id1/stop', body: null, response: null },
    {
      name: 'reset the South metrics',
      call: s => s.resetMetrics('id1'),
      method: 'POST',
      url: '/api/south/id1/metrics/reset',
      body: null,
      response: null
    },
    {
      name: 'test a discovery query',
      call: s => s.testDiscoveryQuery('id1', 'opcua', command.settings, 'SELECT *'),
      method: 'POST',
      url: '/api/south/id1/test/discovery-query?southType=opcua',
      body: { southSettings: command.settings, query: 'SELECT *' },
      response: discoveredRows
    },
    {
      name: 'start an explore session',
      call: s => s.startExplore('id1', command.settings, command.type),
      method: 'POST',
      url: '/api/south/id1/explore?southType=folder-scanner',
      body: command.settings,
      response: exploreStartResult
    },
    {
      name: 'browse an explore session',
      call: s => s.browseExplore('id1', 'sessionId', 'root'),
      method: 'PUT',
      url: '/api/south/id1/explore/sessionId',
      body: { parentId: 'root' },
      response: exploreBrowseResult
    },
    {
      name: 'browse the root of an explore session',
      call: s => s.browseExplore('id1', 'sessionId', null),
      method: 'PUT',
      url: '/api/south/id1/explore/sessionId',
      body: { parentId: null },
      response: exploreStartResult
    },
    {
      name: 'close an explore session',
      call: s => s.closeExplore('id1', 'sessionId'),
      method: 'DELETE',
      url: '/api/south/id1/explore/sessionId',
      body: null,
      response: null
    },
    {
      name: 'search South items by name',
      call: s => s.searchItems('id1', { page: 2, name: 'item' }),
      method: 'GET',
      url: '/api/south/id1/items/search?page=2&name=item',
      body: null,
      response: toPage([item])
    },
    {
      name: 'search South items without name filter',
      call: s => s.searchItems('id1', { page: 0 }),
      method: 'GET',
      url: '/api/south/id1/items/search?page=0',
      body: null,
      response: toPage([item])
    },
    {
      name: 'get a South item',
      call: s => s.getItem('id1', 'itemId1'),
      method: 'GET',
      url: '/api/south/id1/items/itemId1',
      body: null,
      response: item
    },
    {
      name: 'get the last value of a South item',
      call: s => s.getItemLastValue('id1', 'itemId1'),
      method: 'GET',
      url: '/api/south/id1/items/itemId1/last-value',
      body: null,
      response: lastValue
    },
    {
      name: 'create a South item',
      call: s => s.createItem('id1', itemCommand),
      method: 'POST',
      url: '/api/south/id1/items',
      body: itemCommand,
      response: item
    },
    {
      name: 'update a South item',
      call: s => s.updateItem('id1', 'itemId1', itemCommand),
      method: 'PUT',
      url: '/api/south/id1/items/itemId1',
      body: itemCommand,
      response: null
    },
    {
      name: 'delete a South item',
      call: s => s.deleteItem('id1', 'itemId1'),
      method: 'DELETE',
      url: '/api/south/id1/items/itemId1',
      body: null,
      response: null
    },
    {
      name: 'enable a South item',
      call: s => s.enableItem('id1', 'itemId1'),
      method: 'POST',
      url: '/api/south/id1/items/itemId1/enable',
      body: null,
      response: null
    },
    {
      name: 'disable a South item',
      call: s => s.disableItem('id1', 'itemId1'),
      method: 'POST',
      url: '/api/south/id1/items/itemId1/disable',
      body: null,
      response: null
    },
    {
      name: 'enable South items',
      call: s => s.enableItems('id1', ['itemId1', 'itemId2']),
      method: 'POST',
      url: '/api/south/id1/items/enable',
      body: { itemIds: ['itemId1', 'itemId2'] },
      response: null
    },
    {
      name: 'disable South items',
      call: s => s.disableItems('id1', ['itemId1', 'itemId2']),
      method: 'POST',
      url: '/api/south/id1/items/disable',
      body: { itemIds: ['itemId1', 'itemId2'] },
      response: null
    },
    {
      name: 'delete South items',
      call: s => s.deleteItems('id1', ['itemId1', 'itemId2']),
      method: 'POST',
      url: '/api/south/id1/items/delete',
      body: { itemIds: ['itemId1', 'itemId2'] },
      response: null
    },
    {
      name: 'delete all South items',
      call: s => s.deleteAllItems('id1'),
      method: 'DELETE',
      url: '/api/south/id1/items',
      body: null,
      response: null
    },
    {
      name: 'get the item groups',
      call: s => s.getGroups('id1'),
      method: 'GET',
      url: '/api/south/id1/groups',
      body: null,
      response: [group]
    },
    {
      name: 'get an item group',
      call: s => s.getGroup('id1', 'groupId1'),
      method: 'GET',
      url: '/api/south/id1/groups/groupId1',
      body: null,
      response: group
    },
    {
      name: 'create an item group',
      call: s => s.createGroup('id1', groupCommand),
      method: 'POST',
      url: '/api/south/id1/groups',
      body: groupCommand,
      response: group
    },
    {
      name: 'update an item group',
      call: s => s.updateGroup('id1', 'groupId1', groupCommand),
      method: 'PUT',
      url: '/api/south/id1/groups/groupId1',
      body: groupCommand,
      response: null
    },
    {
      name: 'delete an item group',
      call: s => s.deleteGroup('id1', 'groupId1'),
      method: 'DELETE',
      url: '/api/south/id1/groups/groupId1',
      body: null,
      response: null
    },
    {
      name: 'move items to a group',
      call: s => s.moveItemsToGroup('id1', ['itemId1', 'itemId2'], 'groupId1'),
      method: 'POST',
      url: '/api/south/id1/items/move-to-group',
      body: { itemIds: ['itemId1', 'itemId2'], groupId: 'groupId1' },
      response: null
    },
    {
      name: 'remove items from their group',
      call: s => s.moveItemsToGroup('id1', ['itemId1'], null),
      method: 'POST',
      url: '/api/south/id1/items/move-to-group',
      body: { itemIds: ['itemId1'], groupId: null },
      response: null
    }
  ])('should $name', async ({ call, method, url, body, response }) => {
    const result = await expectHttp(http, call(service), { method, url }, { body, response });

    expect(result).toEqual(response);
  });

  test('should get the South metrics and only notify an expired session', async () => {
    const result = firstValueFrom(service.getMetrics('id1'));

    const request = http.expectOne({ method: 'GET', url: '/api/south/id1/metrics' });
    expectErrorsIgnoredUnlessUnauthorized(request);
    request.flush(testData.south.metrics);

    await expect(result).resolves.toEqual(testData.south.metrics);
  });

  test('should test a South connection and leave the error display to the caller', async () => {
    const result = firstValueFrom(service.testConnection('id1', command.settings, command.type));

    const request = http.expectOne({ method: 'POST', url: '/api/south/id1/test/connection?southType=folder-scanner' });
    expect(request.request.body).toEqual(command.settings);
    expectErrorsIgnoredUnlessUnauthorized(request);
    request.flush(connectionTestResult);

    await expect(result).resolves.toEqual(connectionTestResult);
  });

  test('should test a South item and leave the error display to the caller', async () => {
    const result = firstValueFrom(
      service.testItem('id1', 'folder-scanner', 'my item', command.settings, itemCommand.settings, testingSettings)
    );

    const request = http.expectOne({ method: 'POST', url: '/api/south/id1/items/test?southType=folder-scanner&itemName=my%20item' });
    expect(request.request.body).toEqual({ southSettings: command.settings, itemSettings: itemCommand.settings, testingSettings });
    expectErrorsIgnoredUnlessUnauthorized(request);
    request.flush(itemTestResult);

    await expect(result).resolves.toEqual(itemTestResult);
  });

  test('should convert items to a downloaded CSV file', async () => {
    const result = firstValueFrom(service.itemsToCsv('folder-scanner', [itemCommand], 'south.csv', ';'), { defaultValue: 'no emission' });

    const request = http.expectOne({ method: 'POST', url: '/api/south/folder-scanner/items/to-csv' });
    expect(request.request.responseType).toBe('blob');
    const body = formDataOf(request);
    await expect(jsonFileOf(body, 'items')).resolves.toEqual({ name: 'items.json', content: [itemCommand] });
    expect(body.get('delimiter')).toBe(';');
    const blob = new Blob(['csv']);
    request.flush(blob);

    await expect(result).resolves.toBeUndefined();
    expect(downloadService.download).toHaveBeenCalledWith(expect.objectContaining({ body: blob }), 'south.csv');
  });

  test('should export the items of a South connector to a downloaded CSV file', async () => {
    const result = firstValueFrom(service.exportItems('id1', 'south.csv', ';'), { defaultValue: 'no emission' });

    const request = http.expectOne({ method: 'POST', url: '/api/south/id1/items/export' });
    expect(request.request.body).toEqual({ delimiter: ';' });
    expect(request.request.responseType).toBe('blob');
    const blob = new Blob(['csv']);
    request.flush(blob);

    await expect(result).resolves.toBeUndefined();
    expect(downloadService.download).toHaveBeenCalledWith(expect.objectContaining({ body: blob }), 'south.csv');
  });

  test.each([
    { deleteItemsNotPresent: undefined, expected: 'false' },
    { deleteItemsNotPresent: true, expected: 'true' }
  ])('should check items to import (deleteItemsNotPresent: $deleteItemsNotPresent)', async ({ deleteItemsNotPresent, expected }) => {
    const file = new File(['name;enabled'], 'items.csv');
    const response = { items: [item], errors: [{ item: { name: 'bad item' }, error: 'Invalid scan mode' }] };

    const result = firstValueFrom(service.checkImportItems('folder-scanner', [item], file, ',', deleteItemsNotPresent));

    const request = http.expectOne({ method: 'POST', url: '/api/south/folder-scanner/items/import/check' });
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

    const request = http.expectOne({ method: 'POST', url: '/api/south/id1/items/import' });
    const body = formDataOf(request);
    await expect(jsonFileOf(body, 'items')).resolves.toEqual({ name: 'items.json', content: [itemCommand] });
    expect(body.get('deleteItemsNotPresent')).toBe(expected);
    request.flush(null);

    await expect(result).resolves.toBeNull();
  });
});
